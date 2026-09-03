const { calculateCompletionYear, sanitizeContractNo } = require('../utils/planMasterSync');

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
});
