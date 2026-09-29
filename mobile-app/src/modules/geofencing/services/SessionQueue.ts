/**
 * Session queue — ONE serialized lane for every write to tracking sessions.
 *
 * Geofence task callbacks, keepalive replays, foreground fallbacks, exit
 * verification notifications and the manual buttons all mutate the same
 * session rows. Running each of them through this queue guarantees that
 * "read state → decide → write state" never interleaves between two of them
 * (session rule 3, see TrackingManager.ts).
 *
 * The queue is module-level so it is shared by every TrackingManager instance
 * in the JS runtime. A job must NOT call `serialized()` again from inside
 * itself (it would wait on its own completion) — internal calls go to the
 * un-queued implementation instead.
 *
 * Scope: ONE JS runtime. expo-task-manager's headless tasks run in the app's
 * React instance (one runtime per process on both platforms), so in practice
 * there is one queue. If that ever changes (separate headless host), the only
 * remaining protection is single-statement SQLite atomicity plus the partial
 * unique index on open sessions.
 */

let queueTail: Promise<void> = Promise.resolve();

export function serialized<T>(work: () => Promise<T>): Promise<T> {
  // queueTail never rejects (see below), so a plain .then is enough.
  const run = queueTail.then(() => work());
  // Keep the chain alive regardless of the outcome of this job; the caller
  // still receives the rejection through `run`.
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
