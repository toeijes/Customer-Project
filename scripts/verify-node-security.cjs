// Benign runtime regression checks; no exploit payloads or external services.
const assert = require('node:assert/strict');
const dns = require('node:dns').promises;
const tls = require('node:tls');

async function main() {
  require('../backend/utils/runtimeVersion')();
  await assert.rejects(async () => dns.resolve4('example.invalid\0.trusted.invalid'), TypeError);
  // These certificates intentionally contain identities that must not be used
  // to authenticate ambiguous/non-canonical IPv4 hostnames.
  for (const [host, subjectaltname] of [
    ['\uff11\uff12\uff17.0.0.1', 'DNS:127.0.0.1'],
    ['0127.0.0.1', 'IP Address:87.0.0.1'],
    ['127.1', 'DNS:127.0.0.1']
  ]) {
    assert(tls.checkServerIdentity(host, { subjectaltname }) instanceof Error,
      `TLS must reject ambiguous IP identity: ${host}`);
  }
  assert.equal(tls.checkServerIdentity('service.example', { subjectaltname: 'DNS:service.example' }), undefined);
  console.log(`PASS ${process.version}: runtime baseline, DNS NUL rejection and TLS IP identity checks`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
