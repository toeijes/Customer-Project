const fs = require('node:fs');
const path = require('node:path');
const { Client, InvalidCredentialsError, escapeFilter } = require('ldapts');

const DEFAULT_AREA_OU_MAP = Object.freeze(Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => {
    const area = String(index + 1);
    return [`Reg${area.padStart(2, '0')}`, area];
  })
));

const ATTRIBUTES = [
  'sAMAccountName', 'displayName', 'givenName', 'sn', 'mail', 'title',
  'employeeNumber', 'postOfficeBox', 'o', 'physicalDeliveryOfficeName',
  'division', 'department', 'company', 'distinguishedName'
];

class LdapAuthError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function normalizeUsername(value) {
  return String(value ?? '').trim().split('\\').pop().split('@')[0].trim();
}

function attribute(entry, name) {
  const key = Object.keys(entry).find(key => key.toLowerCase() === name.toLowerCase());
  const value = entry[key];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : '';
}

// Split DN components without treating escaped commas or plus signs as separators.
function splitDn(value) {
  const parts = [];
  let current = '';
  let escaped = false;
  for (const char of value) {
    if (!escaped && (char === ',' || char === '+')) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
  }
  parts.push(current.trim());
  return parts;
}

function areaFromDn(dn, areaOuMap = DEFAULT_AREA_OU_MAP) {
  const mapping = new Map(Object.entries(areaOuMap).map(([ou, area]) => [ou.toLowerCase(), String(area)]));
  const areas = new Set();
  for (const part of splitDn(dn)) {
    const match = /^OU\s*=\s*([^\\]+)$/i.exec(part);
    const area = match && mapping.get(match[1].trim().toLowerCase());
    if (area) areas.add(area);
  }
  // An unknown or conflicting OU must not retain access to a previous region.
  return areas.size === 1 ? [...areas][0] : null;
}

function mapProfile(entry, areaOuMap) {
  const username = attribute(entry, 'sAMAccountName');
  if (!username) throw new LdapAuthError('ldap_invalid_profile');
  return {
    username,
    firstname: attribute(entry, 'givenName'),
    lastname: attribute(entry, 'sn'),
    email: attribute(entry, 'mail'),
    position: attribute(entry, 'title'),
    level: attribute(entry, 'employeeNumber'),
    costcenter: attribute(entry, 'postOfficeBox'),
    ba: attribute(entry, 'o'),
    job_name: attribute(entry, 'physicalDeliveryOfficeName'),
    div_name: attribute(entry, 'division'),
    dep_name: attribute(entry, 'department'),
    org_name: attribute(entry, 'company'),
    area: areaFromDn(attribute(entry, 'distinguishedName') || attribute(entry, 'dn'), areaOuMap)
  };
}

function getConfig(env = process.env) {
  const url = env.LDAP_URL || 'ldaps://R06-DC01.pwa.local:636';
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'ldaps:' || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password) {
    throw new LdapAuthError('ldap_configuration_error');
  }
  const timeout = Number(env.LDAP_TIMEOUT_MS || 5000);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new LdapAuthError('ldap_configuration_error');
  const areaOuMap = env.LDAP_AREA_OU_MAP ? JSON.parse(env.LDAP_AREA_OU_MAP) : DEFAULT_AREA_OU_MAP;
  if (!areaOuMap || Array.isArray(areaOuMap) || typeof areaOuMap !== 'object'
      || Object.entries(areaOuMap).some(([ou, area]) => !ou || !/^[1-9]\d*$/.test(String(area)))) {
    throw new LdapAuthError('ldap_configuration_error');
  }
  const tlsOptions = { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: parsedUrl.hostname };
  if (env.LDAP_CA_FILE) {
    tlsOptions.ca = fs.readFileSync(path.resolve(__dirname, '..', env.LDAP_CA_FILE));
  }
  return {
    clientOptions: { url, timeout, connectTimeout: timeout, strictDN: false, tlsOptions },
    domain: env.LDAP_DOMAIN || 'PWA',
    baseDn: env.LDAP_BASE_DN || 'dc=PWA,dc=local',
    areaOuMap
  };
}

async function authenticateLdap(username, password, { env = process.env, createClient = options => new Client(options) } = {}) {
  const account = normalizeUsername(username);
  if (!account || typeof password !== 'string' || !password) throw new LdapAuthError('invalid_credentials');
  let client;
  let stage = 'configuration';
  try {
    const config = getConfig(env);
    client = createClient(config.clientOptions);
    stage = 'bind';
    await client.bind(`${config.domain}\\${account}`, password);
    stage = 'search';
    const { searchEntries } = await client.search(config.baseDn, {
      scope: 'sub',
      filter: escapeFilter`(&(objectCategory=person)(sAMAccountName=${account}))`,
      attributes: ATTRIBUTES,
      sizeLimit: 2,
      timeLimit: Math.max(1, Math.ceil(config.clientOptions.timeout / 1000))
    });
    if (searchEntries.length !== 1) throw new LdapAuthError('ldap_invalid_profile');
    return mapProfile(searchEntries[0], config.areaOuMap);
  } catch (error) {
    if (error instanceof LdapAuthError) throw error;
    if (stage === 'bind' && error instanceof InvalidCredentialsError) throw new LdapAuthError('invalid_credentials');
    throw new LdapAuthError(stage === 'configuration' ? 'ldap_configuration_error' : 'ldap_unavailable');
  } finally {
    if (client) await client.unbind().catch(() => {});
  }
}

module.exports = { authenticateLdap, normalizeUsername, mapProfile, areaFromDn, getConfig, LdapAuthError };
