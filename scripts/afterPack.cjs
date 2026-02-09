/**
 * electron-builder afterPack hook
 * Copies cli-bundle/node_modules to the packaged app on all platforms.
 * This is needed because electron-builder respects .gitignore which excludes node_modules.
 */
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, electronPlatformName } = context;
  
  const projectRoot = path.resolve(__dirname, '..');
  const sourceDir = path.join(projectRoot, 'cli-bundle', 'node_modules');

  // Determine resources path based on platform
  let targetDir;
  if (electronPlatformName === 'darwin') {
    // macOS: .app/Contents/Resources/cli-bundle/node_modules
    const appName = context.packager.appInfo.productFilename;
    targetDir = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources', 'cli-bundle', 'node_modules');
  } else {
    // Windows/Linux: resources/cli-bundle/node_modules
    targetDir = path.join(appOutDir, 'resources', 'cli-bundle', 'node_modules');
  }
  
  console.log('[afterPack] Copying cli-bundle/node_modules...');
  console.log('[afterPack] Source:', sourceDir);
  console.log('[afterPack] Target:', targetDir);
  
  if (!fs.existsSync(sourceDir)) {
    console.error('[afterPack] ERROR: Source directory not found:', sourceDir);
    return;
  }
  
  // Copy recursively
  copyDirSync(sourceDir, targetDir);
  
  console.log('[afterPack] Done copying node_modules');
};

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
