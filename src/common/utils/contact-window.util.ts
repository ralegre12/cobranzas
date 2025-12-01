export function canContactNow(d = new Date()): boolean {
  const day = d.getDay(); // 0..6 (dom..sab)
  const hour = d.getHours();
  const allowedDays = (process.env.ALLOWED_CONTACT_DAYS || '1,2,3,4,5,6').split(',').map(Number);
  const start = Number(process.env.ALLOWED_CONTACT_HOUR_START || 9);
  const end = Number(process.env.ALLOWED_CONTACT_HOUR_END || 20);
  const satEnd = Number(process.env.ALLOWED_CONTACT_SAT_END || 13);
  if (!allowedDays.includes(day)) return false;
  const realEnd = day === 6 ? satEnd : end;
  return hour >= start && hour < realEnd;
}
