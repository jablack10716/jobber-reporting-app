// Development runtime guard to prevent multiple concurrent backend server instances.
// Creates a simple lock file with the current PID. If another live process holds the lock, exit early.
// Override / disable behaviors:
//   DISABLE_LOCK=1   -> disables the guard entirely
//   FORCE_START=1    -> ignores existing lock and overwrites (use if stale lock not auto-cleaned)
//   LOCK_FILE_PATH   -> custom absolute path for lock file (default: backend/.server.lock)

const fs = require('fs');
const path = require('path');

if (process.env.DISABLE_LOCK === '1') {
  console.log('[DEV-GUARD] Disabled via DISABLE_LOCK=1');
  return; // eslint-disable-line
}

const lockPath = process.env.LOCK_FILE_PATH || path.join(__dirname, '.server.lock');

function pidAlive(pid) {
  if (!pid || isNaN(pid)) return false;
  try {
    process.kill(pid, 0); // does not actually kill, just test signal
    return true;
  } catch (e) {
    return false;
  }
}

function readExisting() {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) { return null; }
}

const existing = readExisting();
if (existing && existing.pid && existing.pid !== process.pid) {
  const alive = pidAlive(existing.pid);
  if (alive && process.env.FORCE_START !== '1') {
    console.log(`[DEV-GUARD] Another backend instance appears to be running (pid=${existing.pid}).`);
    console.log('[DEV-GUARD] Refusing to start a second server. Set FORCE_START=1 to override or delete the lock file.');
    console.log(`[DEV-GUARD] Lock file: ${lockPath}`);
    process.exit(0); // graceful no-op exit
  } else if (alive && process.env.FORCE_START === '1') {
    console.log(`[DEV-GUARD] FORCE_START=1 provided. Overwriting existing active lock (previous pid=${existing.pid}).`);
  } else {
    console.log('[DEV-GUARD] Stale lock detected (pid not alive). Reclaiming lock.');
  }
}

// Write/overwrite lock file
const lockData = { pid: process.pid, startedAt: new Date().toISOString() };
try {
  fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));
  console.log(`[DEV-GUARD] Lock acquired pid=${process.pid} (${lockPath})`);
} catch (e) {
  console.warn('[DEV-GUARD] Failed to write lock file (continuing anyway):', e.message);
}

function clearLock() {
  try {
    const current = readExisting();
    if (current && current.pid === process.pid && fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      console.log('[DEV-GUARD] Lock released');
    }
  } catch (e) {
    console.warn('[DEV-GUARD] Failed to remove lock file:', e.message);
  }
}

process.once('exit', clearLock);
process.once('SIGINT', () => { clearLock(); process.exit(0); });
process.once('SIGTERM', () => { clearLock(); process.exit(0); });
process.once('SIGHUP', () => { clearLock(); process.exit(0); });
