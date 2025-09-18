#!/usr/bin/env node
/**
 * Cleanup File Layout (Dry-run by default)
 *
 * Goals:
 * - Propose moving test/debug/demo/alt-server scripts into organized subfolders under backend/scripts/
 * - Never touch critical runtime files (server.js, JobberAPIService.js, jobber-queries.js, graphql-queries.js)
 * - Provide --apply to actually move files, and --restore to undo last apply via a manifest
 * - Log a clear summary of actions
 *
 * Usage:
 *   node tools/cleanup-file-layout.js           # dry-run (default)
 *   node tools/cleanup-file-layout.js --apply   # perform moves
 *   node tools/cleanup-file-layout.js --restore # restore last applied moves
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(BACKEND_DIR, '.cleanup-manifest.json');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const RESTORE = args.has('--restore');

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function listBackendFiles() {
  // Only consider top-level files in backend (not directories)
  const entries = fs.readdirSync(BACKEND_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.js'))
    .map(e => path.join(BACKEND_DIR, e.name));
}

const CRITICAL = new Set([
  'server.js',
  'jobber-queries.js',
  'graphql-queries.js',
  'JobberAPIService.js',
  'refresh-data.js',
]);

// Destination buckets inside backend/scripts
const DEST = {
  tests: 'scripts/tests',
  debug: 'scripts/debug',
  demo: 'scripts/demo',
  servers: 'scripts/servers',
  exports: 'scripts/exports',
  oauth: 'scripts/oauth',
  tools: 'scripts/tools',
  other: 'scripts/other',
};

function classify(filename) {
  const base = path.basename(filename);
  const lower = base.toLowerCase();

  if (CRITICAL.has(base)) return null; // never move

  if (lower.startsWith('test-') || lower.endsWith('-test.js')) return DEST.tests;
  if (lower.startsWith('debug-')) return DEST.debug;
  if (lower.startsWith('demo-')) return DEST.demo;
  if (lower.startsWith('export-') || lower.includes('validate-invoices')) return DEST.exports;
  if (lower.startsWith('oauth-') || lower.includes('generate-oauth')) return DEST.oauth;
  if (['mini-server.js', 'simple-server.js', 'server-simple.js', 'server-working.js', 'server-clean.js', 'server.js.backup', 'server.js.broken', 'server.js.complex'].includes(base)) return DEST.servers;
  if (['final-verification.js', 'report-mismatches.js', 'refresh-and-debug.js', 'test-real-api.js', 'test-real-data.js', 'test-real-simple.js'].includes(base)) return DEST.tools;

  // Likely application/dev runners that are okay to retain in root
  if (['server-error.log', 'config.ru', 'Procfile', 'Rakefile', 'simple_api.rb', 'webrick_api.rb', 'run-loop.ps1'].includes(base)) return null;

  // graphql-queries.js and other core files should stay (handled by CRITICAL)
  return null; // by default, do not move
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { appliedAt: null, moves: [] };
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); } catch { return { appliedAt: null, moves: [] }; }
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function restoreManifest(manifest) {
  let ok = true;
  for (const { from, to } of manifest.moves.slice().reverse()) {
    try {
      if (fs.existsSync(to)) {
        ensureDir(path.dirname(from));
        fs.renameSync(to, from);
        console.log(`Restored: ${path.basename(to)} -> ${path.relative(BACKEND_DIR, from)}`);
      } else {
        console.warn(`Skip restore (missing): ${path.relative(BACKEND_DIR, to)}`);
      }
    } catch (e) {
      ok = false;
      console.error(`Restore failed for ${to}: ${e.message}`);
    }
  }
  return ok;
}

function main() {
  if (RESTORE) {
    const manifest = loadManifest();
    if (!manifest.moves || manifest.moves.length === 0) {
      console.log('Nothing to restore. Manifest is empty.');
      return;
    }
    console.log('Restoring previous cleanup operation...');
    const ok = restoreManifest(manifest);
    if (ok) {
      console.log('✔ Restore complete.');
      saveManifest({ appliedAt: null, moves: [] });
    } else {
      console.log('⚠ Restore completed with warnings.');
    }
    return;
  }

  // Build plan
  const files = listBackendFiles();
  const plan = [];
  for (const file of files) {
    const destFolderRel = classify(file);
    if (!destFolderRel) continue;
    const destFolderAbs = path.join(BACKEND_DIR, destFolderRel);
    ensureDir(destFolderAbs);
    const basename = path.basename(file);
    const destPath = path.join(destFolderAbs, basename);
    plan.push({ from: file, to: destPath });
  }

  if (plan.length === 0) {
    console.log('No files to move. Backend root looks tidy.');
    return;
  }

  console.log('Cleanup plan:');
  const summary = {};
  for (const p of plan) {
    const bucket = path.relative(BACKEND_DIR, path.dirname(p.to));
    summary[bucket] = (summary[bucket] || 0) + 1;
    console.log(` - ${path.basename(p.from)} -> ${path.relative(BACKEND_DIR, p.to)}`);
  }
  console.log('\nSummary by destination:');
  Object.entries(summary).forEach(([k, v]) => console.log(` * ${k}: ${v}`));

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to perform moves.');
    return;
  }

  // Apply moves safely
  const manifest = { appliedAt: new Date().toISOString(), moves: [] };
  let failures = 0;
  for (const { from, to } of plan) {
    try {
      if (!fs.existsSync(from)) {
        console.warn(`Skip (source missing): ${path.relative(BACKEND_DIR, from)}`);
        continue;
      }
      ensureDir(path.dirname(to));
      if (fs.existsSync(to)) {
        const parsed = path.parse(to);
        const alt = path.join(parsed.dir, `${parsed.name}.${Date.now()}${parsed.ext}`);
        console.warn(`Destination exists, using: ${path.relative(BACKEND_DIR, alt)}`);
        fs.renameSync(from, alt);
        manifest.moves.push({ from, to: alt });
      } else {
        fs.renameSync(from, to);
        manifest.moves.push({ from, to });
      }
      console.log(`Moved: ${path.basename(from)} -> ${path.relative(BACKEND_DIR, to)}`);
    } catch (e) {
      failures++;
      console.error(`Failed to move ${path.basename(from)}: ${e.message}`);
    }
  }

  saveManifest(manifest);
  if (failures === 0) {
    console.log('\n✔ Cleanup applied successfully. You can undo with: node tools/cleanup-file-layout.js --restore');
  } else {
    console.log(`\n⚠ Cleanup completed with ${failures} failures. Check logs. You can try to restore using the manifest.`);
  }
}

main();
