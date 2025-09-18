<#
.SYNOPSIS
  Resilient run loop for backend/server.js. Auto-restarts if the process exits unexpectedly (e.g., external SIGINT)

.DESCRIPTION
  Launches Node server, timestamps each start/stop, captures exit code & duration.
  Will stop only if a sentinel file named stop-loop.txt is placed beside this script OR if user presses Ctrl+C twice quickly.

.NOTES
  Safe for development only. Do not use in production; prefer a proper process manager (PM2, systemd, Docker healthcheck).
#>

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$node = 'node'
$target = Join-Path $scriptDir 'server.js'

if (-not (Test-Path $target)) {
  Write-Host "ERROR: server.js not found at $target" -ForegroundColor Red
  exit 1
}

$stopFile = Join-Path $scriptDir 'stop-loop.txt'
$restartDelay = 3
$maxRapidRestarts = 5
$rapidWindowSeconds = 30
$recentExits = @()

Write-Host "=== Backend Run Loop Starting ($(Get-Date -Format o)) ===" -ForegroundColor Cyan
Write-Host "Script: $($MyInvocation.MyCommand.Path)"
Write-Host "Node:   $node" 
Write-Host "Target: $target"
Write-Host "Stop by creating: $stopFile OR Ctrl+C twice quickly" -ForegroundColor Yellow

$lastCtrlC = $null

$invocationCount = 0
while ($true) {
  if (Test-Path $stopFile) {
    Write-Host "Stop file detected ($stopFile). Exiting loop." -ForegroundColor Yellow
    break
  }

  $invocationCount++
  $startTime = Get-Date
  Write-Host "\n[$invocationCount] Launching server at $(Get-Date -Format o)" -ForegroundColor Green

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = 'server.js'
  $psi.WorkingDirectory = $scriptDir
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $null = $proc.Start()

  # Asynchronous output reader
  $stdOutHandler = [System.Diagnostics.DataReceivedEventHandler] { param($s,$e) if ($e.Data) { Write-Host "[OUT] $($e.Data)" } }
  $stdErrHandler = [System.Diagnostics.DataReceivedEventHandler] { param($s,$e) if ($e.Data) { Write-Host "[ERR] $($e.Data)" -ForegroundColor Red } }
  $proc.add_OutputDataReceived($stdOutHandler)
  $proc.add_ErrorDataReceived($stdErrHandler)
  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()

  # Monitor process until exit or user abort
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 1
    if ([console]::KeyAvailable) {
      $key = [console]::ReadKey($true)
      if ($key.Key -eq 'C' -and $key.Modifiers -band [ConsoleModifiers]::Control) {
        $now = Get-Date
        if ($lastCtrlC -and ($now - $lastCtrlC).TotalSeconds -lt 1.25) {
          # Second quick Ctrl+C -> exit entire loop
          Write-Host "Ctrl+C detected twice rapidly - stopping loop." -ForegroundColor Yellow
          try { if (-not $proc.HasExited) { $proc.Kill() } } catch {}
          break 2
        } else {
          Write-Host "Ctrl+C detected (press again quickly to exit loop). Forwarding INT to child..." -ForegroundColor Yellow
          try { $proc.CloseMainWindow() | Out-Null } catch {}
          $lastCtrlC = $now
        }
      }
    }
  }

  $endTime = Get-Date
  $duration = ($endTime - $startTime).TotalSeconds
  $exitCode = $proc.ExitCode
  Write-Host "[$invocationCount] Server exited code=$exitCode after {0:N1}s" -f $duration

  # Track rapid restarts to avoid infinite churn
  $recentExits += $endTime
  $recentExits = $recentExits | Where-Object { ($endTime - $_).TotalSeconds -lt $rapidWindowSeconds }
  if ($recentExits.Count -gt $maxRapidRestarts) {
    Write-Host "Too many rapid restarts within $rapidWindowSeconds seconds ($($recentExits.Count)). Exiting loop." -ForegroundColor Red
    break
  }

  Write-Host "Restarting in $restartDelay seconds... (create stop-loop.txt to abort)" -ForegroundColor DarkCyan
  Start-Sleep -Seconds $restartDelay
}

Write-Host "Run loop terminated $(Get-Date -Format o)" -ForegroundColor Cyan
