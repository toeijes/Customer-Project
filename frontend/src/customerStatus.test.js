import { describe, expect, it } from 'vitest';
import { getCustomerStatusInfo } from './customerStatus';

describe('getCustomerStatusInfo', () => {
  it.each([
    ['1', 'ปกติ'],
    ['2', 'ฝากมาตร'],
    ['3', 'หยุดจ่ายน้ำ'],
    ['4', 'ตัดมาตร'],
    ['5', 'ยกเลิกถาวร'],
    ['6', 'กปภ.ยกเลิก'],
    ['7', 'โอนสิทธิ์'],
    ['T', 'ปกติ'],
    ['Y', 'ปกติ'],
    ['F', 'ยกเลิก/ระงับ'],
    ['unexpected-code', 'ไม่ระบุสถานะ']
  ])('translates %s into a meaningful label', (code, label) => {
    expect(getCustomerStatusInfo(code).text).toBe(label);
  });
});
