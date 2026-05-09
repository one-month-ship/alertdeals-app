/**
 * Parse a string to int (default) or float, returning null for empty/missing values.
 */
export const customParseInt = (
  val: string | null | undefined,
  parseToFloat = false,
): number | null => {
  if (!val) return null;
  return parseToFloat ? parseFloat(val) : parseInt(val);
};
