const { uniqueProjectCustomers, assertCustomerDatesConsistent } = require('../utils/customerIdentity');

describe('water user identity across meter replacements', () => {
  it('counts one user per project regardless of meter, size, month or duplicate source row', () => {
    const rows = [
      { project_code: 'A', custcode: '001', meter_no: 'old', month: 1 },
      { project_code: 'A', custcode: '001', meter_no: 'new', month: 2 },
      { project_code: 'A', custcode: '001', meter_no: 'new', month: 2 },
      { project_code: 'B', custcode: '001', meter_no: 'new', month: 2 },
      { project_code: 'A', custcode: '002', meter_no: 'new', month: 2 },
    ];
    const unique = uniqueProjectCustomers(rows);
    expect(unique).toEqual([rows[0], rows[3], rows[4]]);
    expect(rows).toHaveLength(5);
  });

  it('uses the same identity rule for customer-detail API column names', () => {
    expect(uniqueProjectCustomers([
      { project_code: 'A', cus_code: '001' },
      { project_code: 'A', cus_code: '001' },
      { project_code: 'B', cus_code: '001' },
    ], { customerKey: 'cus_code' })).toHaveLength(2);
  });

  it('does not count blank user codes or merge distinct codes with leading zeros', () => {
    expect(uniqueProjectCustomers([
      { custcode: null }, { custcode: '' }, { custcode: ' ' },
      { custcode: '001' }, { custcode: '1' },
    ]).map(row => row.custcode)).toEqual(['001', '1']);
  });

  it('requires source correction instead of choosing an installation date from conflicting history', async () => {
    const query = vi.fn().mockResolvedValue([{ cus_code: '001' }]);
    await expect(assertCustomerDatesConsistent(query)).rejects.toMatchObject({ code: 'CUSTOMER_DATE_CONFLICT' });
    query.mockResolvedValue([]);
    await expect(assertCustomerDatesConsistent(query)).resolves.toBeUndefined();
  });
});
