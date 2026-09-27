export const isValidInteger = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;

  const raw = String(value).trim();
  if (raw === '') return false;

  // Prevent floats and non-numeric
  if (!/^[+-]?\d+$/.test(raw)) return false;

  const num = Number(raw);
  return Number.isInteger(num);
}
