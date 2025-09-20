// Cross-platform copy of ../frontend/build to ./build
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../frontend/build');
const dest = path.resolve(__dirname, '../build');

function copyDirSync(srcDir, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(srcPath);
      try { fs.symlinkSync(link, destPath); } catch { fs.copyFileSync(srcPath, destPath); }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(src)) {
  console.error(`[copy-frontend-build] Source not found: ${src}`);
  process.exit(1);
}

// Remove existing dest if present
if (fs.existsSync(dest)) {
  // Recursively remove
  const rm = (p) => {
    if (fs.lstatSync(p).isDirectory()) {
      for (const e of fs.readdirSync(p)) rm(path.join(p, e));
      fs.rmdirSync(p);
    } else {
      fs.unlinkSync(p);
    }
  };
  rm(dest);
}

copyDirSync(src, dest);
console.log(`[copy-frontend-build] Copied ${src} -> ${dest}`);
