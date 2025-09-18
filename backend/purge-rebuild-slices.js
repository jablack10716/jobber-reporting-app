#!/usr/bin/env node
/**
 * purge-rebuild-slices.js
 *
 * Utility to purge cached monthly plumber slices (disk + in-memory) and optionally trigger regeneration.
 *
 * Features:
 *  - Filter by plumber name(s), year(s), and month(s).
 *  - Supports wildcard all plumbers or all months.
 *  - Optionally trigger regeneration by calling the running backend HTTP endpoints (/api/reports/plumber).
 *  - Dry-run mode to preview deletions.
 *  - Safe skip if file already removed between scan and delete.
 *
 * Usage examples:
 *   node purge-rebuild-slices.js --plumber Wes --year 2025 --month 08 --regen
 *   node purge-rebuild-slices.js --plumber Wes --year 2025 --months 07,08,09 --regen
 *   node purge-rebuild-slices.js --all --year 2025 --regen
 *   node purge-rebuild-slices.js --all --years 2024,2025 --dry
 *   node purge-rebuild-slices.js --plumbers Lorin,Wes --year 2025 --dry
 *
 * Arguments:
 *   --plumber NAME            Single plumber (can repeat or combine with --plumbers)
 *   --plumbers A,B,C          Comma list of plumbers
 *   --all                     Target all plumbers (overrides specific plumber filters)
 *   --year 2025              Single year (can repeat or combine with --years)
 *   --years 2024,2025        Comma list of years
 *   --month 08               Single month (MM) (can repeat or combine with --months)
 *   --months 07,08,09        Comma list of months (MM)
 *   --regen                  After purge, call backend to regenerate missing months (requires server running, USE_REAL_DATA=true)
 *   --base-url URL           Base URL for backend (default http://localhost:3000)
 *   --refresh                Add refresh=1 when regenerating (forces bypass of any in-memory cache)
 *   --dry                    Dry-run (no deletions, just report what would happen)
 *   --verbose                Extra logging
 *
 * Exit codes:
 *   0 success
 *   1 argument / validation error
 *   2 regeneration failures occurred
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const cacheDir = path.join(__dirname, 'cache', 'reports');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    plumberSet: new Set(),
    yearSet: new Set(),
    monthSet: new Set(),
    all: false,
    regen: false,
    refresh: false,
    dry: false,
    verbose: false,
    baseUrl: 'http://localhost:3000'
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '--plumber':
        opts.plumberSet.add(args[++i]);
        break;
      case '--plumbers':
        args[++i].split(',').map(s => s.trim()).filter(Boolean).forEach(p => opts.plumberSet.add(p));
        break;
      case '--all':
        opts.all = true;
        break;
      case '--year':
        opts.yearSet.add(args[++i]);
        break;
      case '--years':
        args[++i].split(',').map(s => s.trim()).filter(Boolean).forEach(y => opts.yearSet.add(y));
        break;
      case '--month':
        opts.monthSet.add(args[++i]);
        break;
      case '--months':
        args[++i].split(',').map(s => s.trim()).filter(Boolean).forEach(m => opts.monthSet.add(m));
        break;
      case '--regen':
        opts.regen = true;
        break;
      case '--refresh':
        opts.refresh = true;
        break;
      case '--dry':
        opts.dry = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--base-url':
        opts.baseUrl = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(module.exports ? '' : ''); // fall through to usage
        printUsage();
        process.exit(0);
      default:
        console.error('Unknown arg:', a);
        printUsage();
        process.exit(1);
    }
  }
  return opts;
}

function printUsage() {
  console.log(`Usage: node purge-rebuild-slices.js [options]\n`);
  console.log(`See script header for detailed examples.`);
}

function listCacheFiles() {
  if (!fs.existsSync(cacheDir)) return [];
  return fs.readdirSync(cacheDir)
    .filter(f => /.+-\d{4}-\d{2}\.json$/.test(f))
    .map(f => ({ file: f, fullPath: path.join(cacheDir, f) }));
}

function matchTargets(files, opts) {
  const months = opts.monthSet.size ? opts.monthSet : null; // set of MM
  const years = opts.yearSet.size ? opts.yearSet : null; // set of YYYY
  return files.filter(({ file }) => {
    const m = file.match(/^(.*)-(\d{4})-(\d{2})\.json$/);
    if (!m) return false;
    const plumber = m[1];
    const year = m[2];
    const month = m[3];
    if (!opts.all && opts.plumberSet.size && !opts.plumberSet.has(plumber)) return false;
    if (years && !years.has(year)) return false;
    if (months && !months.has(month)) return false;
    return true;
  }).map(r => {
    const parts = r.file.split('-');
    return { ...r, plumber: parts[0], year: parts[1], month: parts[2].replace('.json','') };
  });
}

async function deleteFiles(targets, dry, verbose) {
  const removed = [];
  for (const t of targets) {
    if (!fs.existsSync(t.fullPath)) continue;
    if (dry) {
      if (verbose) console.log('[DRY] would delete', t.fullPath);
      removed.push({ ...t, dry: true });
      continue;
    }
    try {
      fs.unlinkSync(t.fullPath);
      removed.push(t);
      if (verbose) console.log('[DEL]', t.fullPath);
    } catch (e) {
      console.warn('[WARN] failed to delete', t.fullPath, e.message);
    }
  }
  return removed;
}

function unique(arr) { return Array.from(new Set(arr)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
  });
}

async function regenerate(removed, opts) {
  const failures = [];
  // Group by plumber-year to minimize duplicate fetches (report fetch returns YTD so includes all months)
  const groups = {};
  for (const r of removed) {
    const key = `${r.plumber}-${r.year}`;
    groups[key] = groups[key] || { plumber: r.plumber, year: r.year };
  }
  const groupList = Object.values(groups);
  for (const g of groupList) {
    const url = `${opts.baseUrl}/api/reports/plumber?name=${encodeURIComponent(g.plumber)}&year=${g.year}${opts.refresh ? '&refresh=1' : ''}`;
    if (opts.verbose) console.log('[REGEN] GET', url);
    try {
      const resp = await httpGet(url);
      if (resp.statusCode !== 200) {
        console.error('[REGEN][FAIL]', g.plumber, g.year, 'status', resp.statusCode);
        failures.push({ ...g, statusCode: resp.statusCode });
      } else if (opts.verbose) {
        console.log('[REGEN][OK]', g.plumber, g.year);
      }
    } catch (e) {
      console.error('[REGEN][ERR]', g.plumber, g.year, e.message);
      failures.push({ ...g, error: e.message });
    }
  }
  return failures;
}

(async function main(){
  const opts = parseArgs();
  if (!opts.all && !opts.plumberSet.size) {
    console.error('Must specify at least one plumber via --plumber/--plumbers or use --all');
    printUsage();
    process.exit(1);
  }
  if (!opts.yearSet.size) {
    console.error('Must specify at least one year via --year/--years');
    printUsage();
    process.exit(1);
  }
  if (!fs.existsSync(cacheDir)) {
    console.log('Cache directory does not exist, nothing to purge:', cacheDir);
    process.exit(0);
  }

  const files = listCacheFiles();
  const targets = matchTargets(files, opts);
  if (!targets.length) {
    console.log('No matching slice files found for given filters.');
    process.exit(0);
  }

  console.log('Target slice files:', targets.map(t => path.basename(t.fullPath)).join(', '));
  const removed = await deleteFiles(targets, opts.dry, opts.verbose);
  console.log(opts.dry ? '[DRY] Files that would be removed:' : 'Removed files:', removed.map(r => path.basename(r.fullPath)).join(', ') || '(none)');

  if (opts.regen && !opts.dry) {
    console.log('Triggering regeneration (one fetch per plumber-year)...');
    const failures = await regenerate(removed, opts);
    if (failures.length) {
      console.error('Some regenerations failed:', failures);
      process.exit(2);
    } else {
      console.log('Regeneration completed successfully for all plumber-year groups.');
    }
  } else if (opts.regen && opts.dry) {
    console.log('[DRY] Skipping regeneration (would have been triggered).');
  }

  // Summary
  const plumberList = opts.all ? '(all plumbers)' : unique(Array.from(opts.plumberSet)).join(', ');
  console.log('Summary:');
  console.log('  Plumbers:', plumberList);
  console.log('  Years:', unique(Array.from(opts.yearSet)).join(', '));
  console.log('  Months filter:', opts.monthSet.size ? unique(Array.from(opts.monthSet)).join(', ') : '(all)');
  console.log('  Regen:', opts.regen ? (opts.dry ? 'planned (dry-run)' : 'performed') : 'no');
  console.log('  Refresh flag on regen:', opts.refresh ? 'yes' : 'no');
  console.log('Done.');
})();
