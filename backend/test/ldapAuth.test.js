const { InvalidCredentialsError } = require('ldapts');
const { authenticateLdap, normalizeUsername, mapProfile, areaFromDn, getConfig } = require('../utils/ldapAuth');

const entry = {
  sAMAccountName: '15818', givenName: 'ธนพร ', sn: 'เจษฎาเมธาขจร ',
  mail: 'employee@pwa.co.th ', title: 'นักวิชาการคอมพิวเตอร์ ', employeeNumber: '7 ',
  postOfficeBox: '101932 ', o: '01059 ', physicalDeliveryOfficeName: 'งานประมวลข้อมูล ',
  division: 'กองเทคโนโลยีสารสนเทศ ', department: ' ', company: 'สายงานรองผู้ว่าการ (ปฏิบัติการ 2) ',
  dn: 'CN=Employee,OU=R06_DPS,OU=Reg06,OU=PWA,DC=pwa,DC=local'
};

describe('LDAP profile and authentication', () => {
  it('maps confirmed attributes, trims whitespace and preserves leading zeros', () => {
    expect(mapProfile(entry)).toEqual({
      username: '15818', firstname: 'ธนพร', lastname: 'เจษฎาเมธาขจร', email: 'employee@pwa.co.th',
      position: 'นักวิชาการคอมพิวเตอร์', level: '7', costcenter: '101932', ba: '01059',
      job_name: 'งานประมวลข้อมูล', div_name: 'กองเทคโนโลยีสารสนเทศ', dep_name: '',
      org_name: 'สายงานรองผู้ว่าการ (ปฏิบัติการ 2)', area: '6'
    });
    expect(mapProfile({ SAMACCOUNTNAME: ['15818'], DISTINGUISHEDNAME: [entry.dn] }).area).toBe('6');
  });

  it('accepts bare, domain-prefixed and UPN usernames', () => {
    for (const input of ['15818', 'PWA\\15818', '15818@pwa.local']) expect(normalizeUsername(input)).toBe('15818');
  });

  it('matches only actual OU components and fails closed for unknown or conflicting regions', () => {
    expect(areaFromDn('CN=Employee,ou=reg06,DC=pwa,DC=local')).toBe('6');
    expect(areaFromDn('CN=Employee\\,OU=Reg06,OU=Other,DC=pwa,DC=local')).toBeNull();
    expect(areaFromDn('CN=Employee,OU=Reg060,DC=pwa,DC=local')).toBeNull();
    expect(areaFromDn('CN=Employee,OU=Reg11,DC=pwa,DC=local')).toBeNull();
    expect(areaFromDn('CN=Employee,OU=Reg06,OU=Reg07,DC=pwa,DC=local', { Reg06: '6', Reg07: '7' })).toBeNull();
  });

  it.each(Array.from({ length: 10 }, (_, index) => index + 1))('maps regional OU for area %i using the default configuration', area => {
    const ou = `Reg${String(area).padStart(2, '0')}`;
    const dn = `CN=Employee,OU=Staff,OU=${ou},OU=PWA,DC=pwa,DC=local`;
    expect(areaFromDn(dn)).toBe(String(area));
    expect(mapProfile({ ...entry, dn }, getConfig({}).areaOuMap).area).toBe(String(area));
  });

  it('keeps an explicit environment mapping authoritative', () => {
    const config = getConfig({ LDAP_AREA_OU_MAP: '{"Reg06":"6"}' });
    expect(areaFromDn('CN=Employee,OU=Reg07,DC=pwa,DC=local', config.areaOuMap)).toBeNull();
    expect(areaFromDn('CN=Employee,OU=Reg06,DC=pwa,DC=local', config.areaOuMap)).toBe('6');
    expect(areaFromDn('CN=Employee,OU=Reg06,OU=Reg07,DC=pwa,DC=local')).toBeNull();
  });

  function client() {
    return { bind: vi.fn().mockResolvedValue(), search: vi.fn().mockResolvedValue({ searchEntries: [entry] }), unbind: vi.fn().mockResolvedValue() };
  }

  it('binds over verified TLS, escapes search input and releases the connection', async () => {
    const fake = client();
    const createClient = vi.fn(() => fake);
    await authenticateLdap('PWA\\15818*', 'secret', { env: {}, createClient });
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      url: 'ldaps://R06-DC01.pwa.local:636', timeout: 5000,
      tlsOptions: expect.objectContaining({ rejectUnauthorized: true, servername: 'R06-DC01.pwa.local' })
    }));
    expect(fake.bind).toHaveBeenCalledWith('PWA\\15818*', 'secret');
    expect(fake.search.mock.calls[0][1].filter).toContain('sAMAccountName=15818\\2a');
    expect(fake.unbind).toHaveBeenCalledOnce();
  });

  it('does not bind empty passwords or use unencrypted LDAP', async () => {
    const createClient = vi.fn();
    await expect(authenticateLdap('15818', '', { env: {}, createClient })).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(authenticateLdap('15818', 'secret', { env: { LDAP_URL: 'ldap://dc' }, createClient })).rejects.toMatchObject({ code: 'ldap_configuration_error' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('distinguishes wrong credentials from unavailable AD and omits diagnostic secrets', async () => {
    const fake = client();
    fake.bind.mockRejectedValue(new InvalidCredentialsError('sensitive diagnostic'));
    await expect(authenticateLdap('15818', 'secret', { env: {}, createClient: () => fake })).rejects.toMatchObject({ code: 'invalid_credentials', message: 'invalid_credentials' });
    expect(fake.search).not.toHaveBeenCalled();
    expect(fake.unbind).toHaveBeenCalledOnce();
    fake.bind.mockRejectedValue(new Error('certificate verification failed'));
    await expect(authenticateLdap('15818', 'secret', { env: {}, createClient: () => fake })).rejects.toMatchObject({ code: 'ldap_unavailable' });
  });

  it('rejects missing or ambiguous accounts and cleans up after search failures', async () => {
    const fake = client();
    for (const entries of [[], [entry, entry], [{ dn: entry.dn }]]) {
      fake.search.mockResolvedValue({ searchEntries: entries });
      await expect(authenticateLdap('15818', 'secret', { env: {}, createClient: () => fake })).rejects.toMatchObject({ code: 'ldap_invalid_profile' });
    }
    fake.search.mockRejectedValue(new Error('network timeout'));
    await expect(authenticateLdap('15818', 'secret', { env: {}, createClient: () => fake })).rejects.toMatchObject({ code: 'ldap_unavailable' });
    expect(fake.unbind).toHaveBeenCalledTimes(4);
  });
});
