const { calculateCompletionYear, equalValues, sanitizeContractNo, synchronizePlanMaster } = require('../utils/planMasterSync');

describe('plan master synchronization helpers', () => {
  it.each([
    ['30/09/2568', 2568, 2568],
    ['01/10/2568', 2568, 2569],
    ['', 2568, 2568],
    [null, 2569, 2569]
  ])('calculates completion year for %s', (completedDate, startYear, expected) => {
    expect(calculateCompletionYear(completedDate, startYear)).toBe(expected);
  });

  it('normalizes spaces and the zero placeholder in contract numbers', () => {
    expect(sanitizeContractNo(' กปภ.ข.6 / 1 / 2569 ')).toBe('กปภ.ข.6/1/2569');
    expect(sanitizeContractNo('0')).toBe('');
  });

  it('treats equivalent numeric database values as unchanged', () => {
    expect(equalValues('3352000.00', 3352000, true)).toBe(true);
  });

  it('accepts building water supply projects from the master plan', async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([[]])
        .mockResolvedValueOnce([[{
          proj_no: 'BUILDING-5', contract_no: 'BUILDING/2569', branch: 'Test branch',
          proj_name: 'Building water supply', type_proj: '5', proj_year: 2569,
          completed_date: '01/10/2569', budget: 100000, target: 100
        }]])
    };
    const result = await synchronizePlanMaster({ connection, dryRun: true });
    expect(result).toMatchObject({ source_rows: 1, inserted_rows: 1, conflict_rows: 0 });
  });
});
