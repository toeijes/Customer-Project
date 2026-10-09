// Checks DNS, connectivity and trusted TLS without sending any credentials.
require('dotenv').config();
const tls = require('node:tls');
const { getConfig } = require('./utils/ldapAuth');

try {
  const { clientOptions } = getConfig();
  const url = new URL(clientOptions.url);
  let verified = false;
  const socket = tls.connect({
    ...clientOptions.tlsOptions,
    host: url.hostname,
    port: Number(url.port || 636)
  }, () => {
    verified = true;
    const certificate = socket.getPeerCertificate();
    console.log(JSON.stringify({
      host: url.hostname,
      tlsAuthorized: socket.authorized,
      certificateExpires: certificate.valid_to
    }));
    socket.destroy();
  });
  socket.setTimeout(clientOptions.connectTimeout, () => socket.destroy(new Error('LDAPS connection timed out')));
  socket.on('error', error => {
    if (verified) return;
    console.error('LDAPS verification failed:', error.code || error.message);
    process.exitCode = 1;
  });
} catch (error) {
  console.error('LDAPS configuration failed:', error.code || error.message);
  process.exitCode = 1;
}
