const STATUS_STYLES = {
  active: { text: 'ปกติ', colorClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  depositMeter: { text: 'ฝากมาตร', colorClass: 'bg-sky-100 text-sky-800 border border-sky-200' },
  temporarySuspension: { text: 'หยุดจ่ายน้ำ', colorClass: 'bg-amber-100 text-amber-800 border border-amber-200' },
  meterDisconnected: { text: 'ตัดมาตร', colorClass: 'bg-rose-100 text-rose-800 border border-rose-200' },
  permanentlyCancelled: { text: 'ยกเลิกถาวร', colorClass: 'bg-slate-200 text-slate-800 border border-slate-300' },
  pwaCancelled: { text: 'กปภ.ยกเลิก', colorClass: 'bg-purple-100 text-purple-800 border border-purple-200' },
  transferred: { text: 'โอนสิทธิ์', colorClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  inactive: { text: 'ยกเลิก/ระงับ', colorClass: 'bg-rose-100 text-rose-800 border border-rose-200' },
  unknown: { text: 'ไม่ระบุสถานะ', colorClass: 'bg-slate-100 text-slate-700 border border-slate-200' }
};

export const getCustomerStatusInfo = (status) => {
  const code = String(status ?? '').trim().toUpperCase();
  const statuses = {
    1: STATUS_STYLES.active,
    2: STATUS_STYLES.depositMeter,
    3: STATUS_STYLES.temporarySuspension,
    4: STATUS_STYLES.meterDisconnected,
    5: STATUS_STYLES.permanentlyCancelled,
    6: STATUS_STYLES.pwaCancelled,
    7: STATUS_STYLES.transferred,
    T: STATUS_STYLES.active,
    Y: STATUS_STYLES.active,
    F: STATUS_STYLES.inactive
  };

  return statuses[code] || STATUS_STYLES.unknown;
};
