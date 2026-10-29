/**
 * The work's own result, or `fallback` once `ms` have passed. `onTimeout` runs only when the time
 * limit wins. The timer is cleared as soon as the work settles: left running, it logged
 * "[AI DOWN] … timed out" 45 s after every reply that had already arrived in time (29 Oct 2026),
 * which hid what the tag is there to catch.
 */
export function withTimeout<T>(promise: Promise<T>, fallback: T, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      onTimeout?.();
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}
