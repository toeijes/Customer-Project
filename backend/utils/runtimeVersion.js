// Keep this baseline aligned with package.json engines and .node-version.
module.exports = function assertSecureNode() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
    throw new Error(`Node.js 24.x >=24.22.1 is required for security fixes; found ${process.version}. See SECURITY_UPDATE_2026-10.md.`);
  }
};
