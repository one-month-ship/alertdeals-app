/**
 * Rejects if `task` outlives `timeoutMs`, otherwise settles exactly like it.
 *
 * Guards any job whose `await` could never settle (dead DB socket, unbounded
 * network call, mapper bug). A rejection lets BullMQ fail — then retry — the
 * job instead of leaving it `active` forever and stalling everything behind it.
 * The timer is always cleared so a settled task never keeps the event loop
 * alive.
 */
export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${timeoutMs}ms — aborting`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
