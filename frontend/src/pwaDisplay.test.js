import { expect, it } from 'vitest';
import { formatPwaBranch, formatPwaZone } from './pwaDisplay';

it('formats valid PWA zones and rejects invalid zones', () => {
  expect(formatPwaZone(6)).toMatch(/6$/);
  expect(formatPwaZone(11)).toBe('');
});

it('trims a plain branch name', () => {
  expect(formatPwaBranch('  Example Branch  ')).toBe('Example Branch');
});
