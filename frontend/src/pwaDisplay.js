export const PWA_ZONES = Object.freeze(
  Array.from({ length: 10 }, (_, index) => String(index + 1))
);

export const formatPwaZone = (zone) => {
  const normalizedZone = String(zone ?? '').trim();
  return PWA_ZONES.includes(normalizedZone) ? `เขต ${normalizedZone}` : '';
};

export const formatPwaBranch = (branchName) => String(branchName ?? '')
  .trim()
  .replace(/^การประปาส่วนภูมิภาค\s*สาขา\s*/, '')
  .replace(/^กปภ\.?\s*สาขา\s*/, '')
  .replace(/^สาขา\s*/, '')
  .replace(/\s*\(ข\.\s*\d+\)\s*/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
