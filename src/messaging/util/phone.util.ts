export function normalizePhone(input: string): string {
  if (!input) return input;
  const s = input.trim();
  if (s.startsWith('whatsapp:')) return s;
  const plus = s.startsWith('+') ? '+' : '';
  const digits = s.replace(/[^\d]/g, '');
  return plus + digits;
}
