// Re-applies CJS fix for @thaiandev/injection-req-res-sdk.
// Upstream 0.0.1 ships dist as CJS but package.json `exports` only declares
// the `import` condition, so Node's CJS loader (nest start/build) throws
// ERR_PACKAGE_PATH_NOT_EXPORTED. Jest is unaffected (moduleNameMapper
// bypasses to dist/index.js directly).
// Idempotent: safe to run on every postinstall.
const fs = require('node:fs');
const path = require('node:path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@thaiandev',
  'injection-req-res-sdk',
  'package.json',
);

try {
  const raw = fs.readFileSync(target, 'utf8');
  const pkg = JSON.parse(raw);
  const dot = pkg?.exports?.['.'];
  if (!dot || typeof dot !== 'object') {
    console.log('[fix-sdk-exports] skip: unexpected exports shape');
    process.exit(0);
  }
  let changed = false;
  for (const [k, v] of Object.entries({
    require: './dist/index.js',
    default: './dist/index.js',
  })) {
    if (dot[k] !== v) {
      dot[k] = v;
      changed = true;
    }
  }
  if (!changed) {
    console.log('[fix-sdk-exports] already ok');
    process.exit(0);
  }
  fs.writeFileSync(target, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[fix-sdk-exports] patched require/default -> ./dist/index.js');
} catch (e) {
  // node_modules may not exist in CI lint-only runs — warn, don't fail install.
  console.warn(`[fix-sdk-exports] skip: ${e.message}`);
}
