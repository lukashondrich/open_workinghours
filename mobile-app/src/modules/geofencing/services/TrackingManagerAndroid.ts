import { Database } from './Database';
import { GeofenceEventData, IgnoreReason, TrackingSession, UserLocation } from '../types';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { t } from '@/lib/i18n';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { trackingEvents } from '@/lib/events/trackingEvents';
import * as ExitVerificationService from './ExitVerificationService';
import { serialized } from './SessionQueue';
import { classifyFix, type FixClass, type FixLike } from './geo';
import * as Location from 'expo-location';

// ============================================================================
// TrackingManagerAndroid — the ANDROID tracking core
// ============================================================================
//
// iOS stays on TrackingManagerIOS (the shipped production logic); see
// TrackingManager.ts for the platform selector and the reasons.
//
// Rebuilt 2026-09-28 (second session) after an adversarial review confirmed
// that the layered predecessor still wrote wrong records in eleven replayed
// stories, and after two platform facts were verified in expo-location's
// Android source:
//   (a) the keepalive foreground service is a HEARTBEAT: with distanceInterval
//       0 it delivers one fix about every 5 minutes (batched up to 5 minutes
//       in the background) whether or not the phone moves. Silence therefore
//       means the stream is DEAD (process killed, service stopped), never
//       "the user left". A real departure produces an outside fix within
//       minutes. `keepalive_last_ping_at` (app_preferences) records liveness.
//   (b) the exit-verification notifications only run while the UI process is
//       alive and can be delayed by doze; they are a bonus fix source, never
//       something a decision waits for. On Android their fixes are routed
//       through `handleFix` like any other fix.
//
// Every signal is ONE fix (coordinates + accuracy + fix time) judged by
// `classifyFix` (geo.ts): 'inside' / 'outside' / 'uncertain'. Exit judgements
// use the fence radius plus EXIT_MARGIN_METERS, so a GPS jump just past the
// edge is 'uncertain', not a departure. Decisions are made in FIX time (asOf),
// so a batch delivered late and the same fixes delivered live give the same
// record.
//
// Session rules (the invariants every entry point must respect):
//
// 1. A MANUAL session belongs to the user. No location signal may close or
//    convert it. It ends only by manual clock-out — or by the 24 h cap.
// 2. A fix older than the latest session boundary of its location (the open
//    session's clock-in / pending exit, or the last completed clock-out) is
//    STALE and ignored: never a negative duration, never a backdated overlap.
// 3. Every handler runs through ONE serialized queue (SessionQueue.ts), shared
//    with the verification service; keepalive payloads are chained too.
// 4. Any session still open MAX_SESSION_HOURS after clock-in is closed — at a
//    known pending-exit time if one stands, else at clock-in + cap — and the
//    user is told. This runs FIRST in every handler, so a stuck session can
//    never swallow today's arrival.
// 5. "No fix, no exit." A departure needs an OUTSIDE fix. An OS exit callback
//    whose own fix is outside is PROVEN; an OS exit without a usable fix, or a
//    single outside ping from the heartbeat, opens an UNPROVEN pending exit at
//    the fix time. A pending exit at time T is then resolved by the next fix at
//    time F:
//      inside,  F−T ≤ hysteresis (5 min)                → blip: cancelled
//      inside,  unproven, F−T ≤ GAP (4 h)                → phantom: cancelled
//      inside,  otherwise                                → confirmed at T, new
//                                                          session from F
//      outside, F−T ≤ CORROBORATION (20 min)             → proven
//      outside, later, stream alive after T+20 min       → the exit at T was a
//                                                          phantom; T is
//                                                          cancelled and the
//                                                          departure is F
//      outside, later, stream dead                       → proven at T
//    A proven pending exit is confirmed once the hysteresis has passed. An
//    unproven one is cancelled once the stream is known alive past T+20 min
//    without an outside fix, confirmed at T once GAP has passed with a dead
//    stream, and otherwise left pending for the next fix.
//    Immediate clock-out (no pending state) only for an OS exit with a tight
//    (< 50 m) outside fix — that is the instant "Clocked out" banner.
// 6. DEAD-STREAM rules. The heartbeat's liveness is two app_preferences
//    values: the latest fix time and the start of the current uninterrupted
//    run (a gap of more than STREAM_GAP_MS starts a new run). "Alive through
//    (a, b)" = the run started by a and reached b. When the stream was dead
//    since the session's last inside evidence, the departure time is unknown
//    and the record ends at that last evidence, with a notice to review:
//      - an OS enter after such a gap (longer than GAP) closes the old session
//        there and starts a new one (overnight must not merge two days);
//      - an outside fix (heartbeat, or the initial-trigger OS exit that Android
//        fires when the app re-registers its fences on every foreground) after
//        such a gap closes the session there;
//      - the 24 h cap closes an auto session there instead of at +24 h.
//    With the stream alive, a long stretch of uncertain fixes (basement) is
//    just that: no split, no early end.
// 7. After a MANUAL clock-out, neither heartbeat pings nor the initial-trigger
//    enter of an app open start a session at that location, until an outside
//    fix or an OS exit has been seen there or GAP has passed (staying for
//    dinner after clocking out is not a new shift). A headless OS enter (a
//    real arrival) is never suppressed.

const EXIT_HYSTERESIS_MINUTES = 5;
const HYSTERESIS_MS = EXIT_HYSTERESIS_MINUTES * 60 * 1000;

/** Exit judgements use radius + margin: a jump just past the edge is not a departure. */
export const EXIT_MARGIN_METERS = 50;

/** OS exit with a fix tighter than this AND outside → immediate clock-out. */
const IMMEDIATE_EXIT_ACCURACY_THRESHOLD = 50;

/** An outside fix within this of an unproven exit corroborates it (covers a 5-min heartbeat + 5-min batching + slack). */
export const CORROBORATION_WINDOW_MS = 20 * 60 * 1000;

/** Longer than any plausible basement stay; shorter than a night. */
export const GAP_HOURS = 4;
const GAP_MS = GAP_HOURS * 60 * 60 * 1000;

export const MAX_SESSION_HOURS = 24;
const CAP_MS = MAX_SESSION_HOURS * 60 * 60 * 1000;

const MIN_SESSION_MINUTES = 5;

// Rule 2 tolerance: device clock (manual actions) and GPS fix clocks can differ a little.
const STALE_TOLERANCE_MS = 30 * 1000;

const FOREGROUND_FETCH_TIMEOUT_MS = 8 * 1000;

/** app_preferences: latest heartbeat fix time (ISO) and the start of the current run. */
export const KEEPALIVE_LAST_PING_KEY = 'keepalive_last_ping_at';
export const KEEPALIVE_STREAM_SINCE_KEY = 'keepalive_stream_since';
/** A gap between heartbeat fixes longer than this means the stream was dead in
 *  between (tolerates doze-stretched intervals; tune with tester data). */
export const STREAM_GAP_MS = 35 * 60 * 1000;
/** app_preferences: when the fences were last (re)registered — Android then fires an
 *  initial-trigger enter/exit that is a fix, not a transition. */
export const GEOFENCES_REGISTERED_AT_KEY = 'geofences_registered_at';
const INITIAL_TRIGGER_WINDOW_MS = 2 * 60 * 1000;
const AUTO_ENTER_SUPPRESSED_PREFIX = 'auto_enter_suppressed:';

export type FixSource = 'keepalive' | 'verification';

/** A location fix as the core sees it. `timestamp` is the FIX time (ISO). */
export interface TrackingFix extends FixLike {
  timestamp: string;
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export class TrackingManagerAndroid {
  constructor(private db: Database) {}

  // --------------------------------------------------------------------------
  // Public API — every entry point is serialized
  // --------------------------------------------------------------------------

  /** OS geofence ENTER callback (App.tsx already dropped enters whose fix is confidently outside). */
  handleGeofenceEnter(event: GeofenceEventData): Promise<void> {
    return serialized(() => this.osEnterImpl(event));
  }

  /** OS geofence EXIT callback. */
  handleGeofenceExit(event: GeofenceEventData): Promise<void> {
    return serialized(() => this.osExitImpl(event));
  }

  /** A fix that is not an OS transition: a heartbeat ping or a verification check. */
  handleFix(locationId: string, fix: TrackingFix, source: FixSource): Promise<void> {
    return serialized(() => this.fixImpl(locationId, fix, source));
  }

  /** Foreground pass: one fetch (taken OUTSIDE the queue) applied to every pending exit, then resolve. */
  async processPendingExits(): Promise<void> {
    const pending = await this.db.getExpiredPendingExits(0, Date.now() + STALE_TOLERANCE_MS);
    const fix = pending.some((p) => p.trackingMethod !== 'manual') ? await this.fetchCurrentFix() : null;
    return serialized(() => this.foregroundPassImpl(fix));
  }

  /** Heartbeat liveness: called ONCE per delivered fix by the keepalive service, after every fence saw it. */
  noteHeartbeat(fixIso: string): Promise<void> {
    return serialized(() => this.noteHeartbeatImpl(fixIso));
  }

  clockIn(locationId: string): Promise<void> {
    return serialized(() => this.clockInImpl(locationId));
  }

  clockOut(locationId: string): Promise<void> {
    return serialized(() => this.clockOutImpl(locationId));
  }

  async getActiveSession(locationId: string) {
    return await this.db.getActiveSession(locationId);
  }

  async getHistory(locationId: string, limit: number = 50) {
    return await this.db.getSessionHistory(locationId, limit);
  }

  // --------------------------------------------------------------------------
  // OS enter
  // --------------------------------------------------------------------------

  private async osEnterImpl(event: GeofenceEventData): Promise<void> {
    console.log(`[TrackingManager] Enter event for ${event.locationId} at ${event.timestamp} (accuracy ${event.accuracy ?? 'n/a'}, ${event.accuracySource ?? 'none'})`);
    const asOf = toMs(event.timestamp);
    await this.closeOverlongSessions(asOf);

    const location = await this.db.getLocation(event.locationId);
    const session = await this.db.getActiveSession(event.locationId);

    const staleReason = await this.staleReason(event.locationId, session, asOf);
    if (staleReason) {
      console.log(`[TrackingManager] Ignoring enter - ${staleReason}`);
      await this.logEvent(event, true, 'stale_timestamp');
      return;
    }

    if (!session) {
      if ((await this.isInitialTrigger(asOf)) && (await this.isAutoEnterSuppressed(event.locationId, asOf))) {
        console.log('[TrackingManager] Initial-trigger enter after a manual clock-out - not starting a session (rule 7)');
        await this.logEvent(event, true, 'auto_enter_suppressed');
        return;
      }
      await this.logEvent(event, false, null);
      await this.startSession(event.locationId, event.timestamp, event.accuracy ?? null, location);
      await this.pass(asOf);
      return;
    }

    if (session.trackingMethod === 'manual') {
      console.log('[TrackingManager] Manual session - enter ignored (rule 1)');
      await this.logEvent(event, true, 'manual_session');
      return;
    }

    if (session.state === 'pending_exit') {
      await this.logEvent(event, false, null);
      await this.insideEvidence(session, event.timestamp, event.accuracy ?? null, location);
      await this.pass(asOf);
      return;
    }

    // Active auto session. Rule 6: if NOTHING has been heard (no inside fix, no
    // heartbeat ping at all) for longer than GAP, this arrival is a new day, not
    // a duplicate. With the heartbeat alive, hours of uncertain fixes are a
    // basement, not a gap.
    const lastInsideMs = toMs(session.lastInsideAt ?? session.clockIn);
    const { lastMs } = await this.heartbeat();
    const lastSeenMs = Math.max(lastInsideMs, lastMs ?? 0);
    if (asOf - lastSeenMs > GAP_MS) {
      console.log(`[TrackingManager] Enter after a ${Math.round((asOf - lastInsideMs) / 3600000)} h dead-stream gap - closing the stale session at its last inside evidence`);
      await this.logEvent(event, false, null);
      await this.closeAtLastSeen(session, lastInsideMs, location);
      await this.startSession(event.locationId, event.timestamp, event.accuracy ?? null, location);
      await this.pass(asOf);
      return;
    }

    console.log('[TrackingManager] Already clocked in, enter is inside evidence only');
    await this.logEvent(event, false, null);
    await this.db.updateLastInsideAt(session.id, event.timestamp);
    await this.pass(asOf);
  }

  // --------------------------------------------------------------------------
  // OS exit
  // --------------------------------------------------------------------------

  private async osExitImpl(event: GeofenceEventData): Promise<void> {
    console.log(`[TrackingManager] Exit event for ${event.locationId} at ${event.timestamp} (accuracy ${event.accuracy ?? 'n/a'}, ${event.accuracySource ?? 'none'})`);
    const asOf = toMs(event.timestamp);
    await this.closeOverlongSessions(asOf);

    const location = await this.db.getLocation(event.locationId);
    const session = await this.db.getActiveSession(event.locationId);
    const fixClass = this.classifyForExit(event, location);

    if (!session) {
      console.log('[TrackingManager] No active session, logging orphan exit event');
      await this.logEvent(event, true, 'no_session');
      await this.clearAutoEnterSuppression(event.locationId); // the OS says they left: rule 7 is over
      await this.pass(asOf);
      return;
    }

    if (session.trackingMethod === 'manual') {
      console.log('[TrackingManager] Manual session - ignoring location exit (rule 1)');
      await this.logEvent(event, true, 'manual_session');
      return;
    }

    if (asOf < toMs(session.clockIn) - STALE_TOLERANCE_MS) {
      console.log(`[TrackingManager] Ignoring exit - fix (${event.timestamp}) predates clock-in (${session.clockIn})`);
      await this.logEvent(event, true, 'stale_timestamp');
      return;
    }

    if (fixClass === 'inside') {
      // The OS said "exit" but its own fix puts the phone inside: a laggy or
      // false callback. If an exit is pending, this fix is the user being back.
      console.log('[TrackingManager] Exit with an inside fix - phantom');
      await this.logEvent(event, true, 'phantom_exit');
      if (session.state === 'pending_exit') {
        await this.insideEvidence(session, event.timestamp, event.accuracy ?? null, location);
      } else {
        await this.db.updateLastInsideAt(session.id, event.timestamp);
      }
      await this.pass(asOf);
      return;
    }

    await this.logEvent(event, false, null);

    if (session.state === 'pending_exit') {
      if (fixClass === 'outside') {
        await this.outsideEvidence(session, event.timestamp, event.accuracy ?? null, location, 'os_exit');
      } else {
        console.log('[TrackingManager] Pending exit already exists, duplicate exit without a fix');
      }
      await this.pass(asOf);
      return;
    }

    // Active session, OS exit. If this is the initial-trigger callback of an
    // app open and the stream has been dead since the last inside evidence,
    // the departure happened somewhere in that silence (rule 6).
    if (fixClass === 'outside' && (await this.isInitialTrigger(asOf))) {
      const lastSeen = await this.unknownDepartureEnd(session, asOf);
      if (lastSeen !== null) {
        await this.closeAtLastSeen(session, lastSeen, location);
        return;
      }
    }
    if (
      fixClass === 'outside' &&
      event.accuracy !== undefined &&
      event.accuracy < IMMEDIATE_EXIT_ACCURACY_THRESHOLD
    ) {
      console.log(`[TrackingManager] Confident exit (outside, ${event.accuracy}m) - immediate clock-out`);
      await this.db.clockOut(session.id, event.timestamp);
      trackingEvents.emit('tracking-changed');
      await this.notifyClockOut(session.id, event.locationId, location?.name);
      return;
    }

    await this.openPendingExit(session, event.timestamp, event.accuracy ?? null, fixClass === 'outside' ? 'outside' : 'uncertain', location);
    await this.pass(asOf);
  }

  // --------------------------------------------------------------------------
  // Heartbeat pings and verification fixes
  // --------------------------------------------------------------------------

  private async fixImpl(locationId: string, fix: TrackingFix, source: FixSource): Promise<void> {
    const asOf = toMs(fix.timestamp);
    {
      await this.closeOverlongSessions(asOf);
      const location = await this.db.getLocation(locationId);
      if (!location) return;
      const session = await this.db.getActiveSession(locationId);

      if (session?.trackingMethod === 'manual') return; // rule 1, silently

      if (!session) {
        // Starting a session needs the plain fence (well inside), and only the heartbeat does it.
        const enterClass = classifyFix(fix, location);
        if (this.classifyForExit(fix, location) === 'outside') {
          await this.clearAutoEnterSuppression(locationId); // clearly outside (with margin): rule 7 is over
        } else if (enterClass === 'inside' && source === 'keepalive') {
          const staleReason = await this.staleReason(locationId, null, asOf);
          if (staleReason) {
            console.log(`[TrackingManager] Ignoring inside ping - ${staleReason}`);
            await this.logEvent(this.eventFromFix('enter', locationId, fix), true, 'stale_timestamp');
            return;
          }
          if (await this.isAutoEnterSuppressed(locationId, asOf)) {
            console.log('[TrackingManager] Inside ping after a manual clock-out - not starting a session (rule 7)');
            return;
          }
          await this.logEvent(this.eventFromFix('enter', locationId, fix), false, null);
          await this.startSession(locationId, fix.timestamp, fix.accuracy ?? null, location);
        }
        await this.pass(asOf);
        return;
      }

      const fixClass = this.classifyForExit(fix, location);
      if (fixClass === 'uncertain') {
        await this.pass(asOf);
        return;
      }

      if (session.state === 'active') {
        if (asOf < toMs(session.clockIn) - STALE_TOLERANCE_MS) return;
        if (fixClass === 'inside') {
          await this.db.updateLastInsideAt(session.id, fix.timestamp);
        } else if (source === 'verification') {
          // A verification check only ever judges the pending exit it was
          // scheduled for; if that exit is gone, its fix is not a new departure.
          console.log('[TrackingManager] Verification fix on an active session - nothing pending, ignored');
        } else if (session.lastInsideAt && asOf <= toMs(session.lastInsideAt)) {
          // Rule 2: the user was placed inside AFTER this fix was taken.
          console.log('[TrackingManager] Outside fix older than the last inside evidence - stale, ignored');
        } else if ((await this.unknownDepartureEnd(session, asOf)) !== null) {
          // First fix after a dead stretch, and it is outside: the departure
          // happened somewhere in the silence (rule 6).
          await this.closeAtLastSeen(session, (await this.unknownDepartureEnd(session, asOf))!, location);
        } else {
          // One outside fix from a stream is a weak claim: unproven pending exit at the fix time.
          console.log(`[TrackingManager] Outside ${source} fix on an active session - opening an unproven pending exit`);
          await this.logEvent(this.eventFromFix('exit', locationId, fix), false, null);
          await this.openPendingExit(session, fix.timestamp, fix.accuracy ?? null, 'uncertain', location);
        }
        await this.pass(asOf);
        return;
      }

      // Pending exit
      if (fixClass === 'inside') {
        await this.insideEvidence(session, fix.timestamp, fix.accuracy ?? null, location);
      } else {
        await this.outsideEvidence(session, fix.timestamp, fix.accuracy ?? null, location, source);
      }
      await this.pass(asOf);
    }
  }

  // --------------------------------------------------------------------------
  // Pending-exit resolution (rule 5)
  // --------------------------------------------------------------------------

  /** Inside evidence at fix time F on a pending exit at T. */
  private async insideEvidence(
    session: TrackingSession,
    fixIso: string,
    accuracy: number | null,
    location: UserLocation | null
  ): Promise<void> {
    const T = toMs(session.pendingExitAt ?? session.clockIn);
    const F = toMs(fixIso);
    if (F < T - STALE_TOLERANCE_MS) {
      console.log('[TrackingManager] Inside fix predates the pending exit - ignored (rule 2)');
      return;
    }
    const age = F - T;
    const blip = age <= HYSTERESIS_MS;
    const phantom = session.exitEvidence !== 'outside' && age <= GAP_MS;
    if (blip || phantom) {
      console.log(`[TrackingManager] Inside fix ${Math.round(age / 60000)} min after the pending exit - ${blip ? 'blip' : 'phantom'}, session continues`);
      await this.db.cancelPendingExit(session.id);
      await ExitVerificationService.cancelVerification(session.id, 'returned');
      await this.db.updateLastInsideAt(session.id, fixIso);
      trackingEvents.emit('tracking-changed');
      return;
    }
    // A real departure (proven, or unproven but longer ago than any basement
    // stay): it ended then, and the user is back now.
    console.log(`[TrackingManager] Inside fix ${Math.round(age / 60000)} min after the pending exit - confirming it and starting a new session`);
    await this.confirmExit(session, location?.name);
    await this.startSession(session.locationId, fixIso, accuracy, location);
  }

  /** Outside evidence at fix time F on a pending exit at T. */
  private async outsideEvidence(
    session: TrackingSession,
    fixIso: string,
    accuracy: number | null,
    location: UserLocation | null,
    source: FixSource | 'os_exit' | 'foreground'
  ): Promise<void> {
    const T = toMs(session.pendingExitAt ?? session.clockIn);
    const F = toMs(fixIso);
    if (F < T - STALE_TOLERANCE_MS) return; // rule 2
    if (session.exitEvidence === 'outside') return; // already proven

    const corroborates = F - T <= CORROBORATION_WINDOW_MS || !(await this.streamAliveThrough(T, T + CORROBORATION_WINDOW_MS));
    if (corroborates) {
      console.log(`[TrackingManager] Outside ${source} fix proves the pending exit at ${session.pendingExitAt}`);
      await this.db.upgradePendingExitEvidence(session.id, accuracy);
      return;
    }

    // The heartbeat kept reporting after the exit and never said "outside" until
    // now: the exit at T was a phantom and the departure is happening now.
    console.log(`[TrackingManager] Outside ${source} fix ${Math.round((F - T) / 60000)} min after an unproven exit with a live stream - the departure is now`);
    await this.db.cancelPendingExit(session.id);
    await ExitVerificationService.cancelVerification(session.id, 'no-evidence');
    const fresh = await this.db.getSession(session.id);
    if (!fresh) return;
    await this.openPendingExit(fresh, fixIso, accuracy, source === 'os_exit' ? 'outside' : 'uncertain', location);
  }

  /**
   * Resolve pending exits as of a moment in fix time. Also restores legacy
   * manual rows stuck in pending_exit (rule 1).
   */
  private async pass(asOfMs: number): Promise<void> {
    const pending = await this.db.getExpiredPendingExits(0, asOfMs + STALE_TOLERANCE_MS);
    for (const session of pending) {
      if (session.trackingMethod === 'manual') {
        console.log(`[TrackingManager] Restoring manual session ${session.id} from legacy pending_exit`);
        await this.db.cancelPendingExit(session.id);
        await ExitVerificationService.cancelVerification(session.id, 'manual-restore');
        trackingEvents.emit('tracking-changed');
        continue;
      }
      const T = toMs(session.pendingExitAt ?? session.clockIn);
      const age = asOfMs - T;

      if (session.exitEvidence === 'outside') {
        if (age >= HYSTERESIS_MS) await this.confirmExit(session, session.locationName);
        continue;
      }

      // Unproven
      if (age > CORROBORATION_WINDOW_MS && (await this.streamAliveThrough(T, T + CORROBORATION_WINDOW_MS))) {
        console.log(`[TrackingManager] Unproven exit ${session.id}: the stream stayed alive and never saw the user outside - cancelled (no fix, no exit)`);
        await this.db.cancelPendingExit(session.id);
        await ExitVerificationService.cancelVerification(session.id, 'no-evidence');
        trackingEvents.emit('tracking-changed');
        continue;
      }
      if (age > GAP_MS) {
        console.log(`[TrackingManager] Unproven exit ${session.id} older than ${GAP_HOURS} h with a dead stream - it stands`);
        await this.confirmExit(session, session.locationName);
        continue;
      }
      // Otherwise: leave it for the next fix.
    }
  }

  private async foregroundPassImpl(fix: TrackingFix | null): Promise<void> {
    const now = Date.now();
    await this.closeOverlongSessions(now);
    const pending = await this.db.getExpiredPendingExits(0, now + STALE_TOLERANCE_MS);
    for (const session of pending) {
      if (session.trackingMethod === 'manual') continue; // pass() restores it
      const location = await this.db.getLocation(session.locationId);
      if (!location || !fix) continue;
      const fixClass = this.classifyForExit(fix, location);
      if (fixClass === 'inside') await this.insideEvidence(session, fix.timestamp, fix.accuracy ?? null, location);
      else if (fixClass === 'outside') await this.outsideEvidence(session, fix.timestamp, fix.accuracy ?? null, location, 'foreground');
    }
    await this.pass(now);
  }

  // --------------------------------------------------------------------------
  // 24 h cap (rule 4)
  // --------------------------------------------------------------------------

  /** Returns the location ids whose session was closed by the cap. */
  private async closeOverlongSessions(asOfMs: number): Promise<string[]> {
    const open = await this.db.getOpenSessions();
    const capped: string[] = [];

    for (const session of open) {
      const clockInMs = toMs(session.clockIn);
      if (asOfMs - clockInMs < CAP_MS) continue;

      const capAtMs = clockInMs + CAP_MS;
      let endMs = capAtMs;
      if (session.state === 'pending_exit' && session.pendingExitAt) {
        const T = toMs(session.pendingExitAt);
        const stands =
          session.exitEvidence === 'outside' || !(await this.streamAliveThrough(T, T + CORROBORATION_WINDOW_MS));
        if (stands) endMs = Math.min(T, capAtMs);
      } else if (session.trackingMethod !== 'manual') {
        // Rule 6: an auto session whose heartbeat died is closed where the user
        // was last seen, not 24 h after it began.
        const lastSeen = await this.unknownDepartureEnd(session, asOfMs);
        if (lastSeen !== null) endMs = Math.min(lastSeen, capAtMs);
      }
      const hitCap = endMs === capAtMs;
      const endIso = new Date(endMs).toISOString();
      console.log(`[TrackingManager] Session ${session.id} open for more than ${MAX_SESSION_HOURS}h - closing at ${endIso}${hitCap ? ' (cap)' : ' (pending exit)'}`);

      await ExitVerificationService.cancelVerification(session.id, 'capped');
      await this.db.clockOut(session.id, endIso);
      trackingEvents.emit('tracking-changed');
      capped.push(session.locationId);

      const location = await this.db.getLocation(session.locationId);
      if (hitCap) {
        await this.sendNotification(
          t('tracking.notifications.title'),
          t('tracking.notifications.autoClosedAfterCap', {
            location: location?.name ?? 'Work Location',
            hours: MAX_SESSION_HOURS,
          }),
          { sessionId: session.id, autoClosed: true }
        );
      } else if (session.state !== 'pending_exit') {
        await this.sendNotification(
          t('tracking.notifications.title'),
          t('tracking.notifications.closedAtLastSeen', { location: location?.name ?? 'Work Location' }),
          { sessionId: session.id, autoClosed: true, lastSeen: true }
        );
      } else {
        await this.notifyClockOut(session.id, session.locationId);
      }
    }
    return capped;
  }

  // --------------------------------------------------------------------------
  // Manual clock-in / clock-out (rule 1, rule 7)
  // --------------------------------------------------------------------------

  private async clockInImpl(locationId: string): Promise<void> {
    await this.closeOverlongSessions(Date.now());
    const activeSession = await this.db.getActiveSession(locationId);
    if (activeSession) {
      throw new Error('Already clocked in at this location');
    }

    const session = await this.db.clockIn(locationId, new Date().toISOString(), 'manual', null);
    const location = await this.db.getLocation(locationId);
    await this.sendNotification(
      t('tracking.notifications.title'),
      t('tracking.notifications.manualClockIn', { location: location?.name ?? 'Work Location' }),
      { sessionId: session.id }
    );
    trackingEvents.emit('tracking-changed');
  }

  private async clockOutImpl(locationId: string): Promise<void> {
    const capped = await this.closeOverlongSessions(Date.now());
    const activeSession = await this.db.getActiveSession(locationId);
    if (!activeSession) {
      if (capped.includes(locationId)) return; // the cap just closed it and told the user
      throw new Error('No active session at this location');
    }

    await ExitVerificationService.cancelVerification(activeSession.id, 'manual');
    await this.db.clockOut(activeSession.id, new Date().toISOString());
    // Rule 7: the user said "done" — pings must not restart a session while they linger.
    await this.db.setPreference(AUTO_ENTER_SUPPRESSED_PREFIX + locationId, new Date().toISOString());
    trackingEvents.emit('tracking-changed');
    await this.notifyClockOut(activeSession.id, locationId, undefined, { manual: true });
  }

  // --------------------------------------------------------------------------
  // Session writes shared by the paths above
  // --------------------------------------------------------------------------

  private async startSession(
    locationId: string,
    clockInIso: string,
    accuracy: number | null,
    location: UserLocation | null
  ): Promise<void> {
    const session = await this.db.clockIn(locationId, clockInIso, 'geofence_auto', accuracy);
    await this.sendNotification('Clocked In', `Clocked in at ${location?.name ?? 'Work Location'}`, { sessionId: session.id });
    trackingEvents.emit('tracking-changed');
  }

  private async openPendingExit(
    session: TrackingSession,
    exitIso: string,
    accuracy: number | null,
    evidence: 'outside' | 'uncertain',
    location: UserLocation | null
  ): Promise<void> {
    console.log(`[TrackingManager] Pending exit (${evidence}) at ${exitIso} for session ${session.id}`);
    await this.db.markPendingExit(session.id, exitIso, accuracy, evidence);
    trackingEvents.emit('tracking-changed');
    if (location) {
      await ExitVerificationService.scheduleVerificationChecks({
        sessionId: session.id,
        locationId: session.locationId,
        geofenceCenter: { latitude: location.latitude, longitude: location.longitude },
        geofenceRadius: location.radiusMeters,
        pendingExitTime: exitIso,
        core: 'android',
      });
    }
  }

  private async confirmExit(session: TrackingSession, knownLocationName?: string): Promise<void> {
    console.log(`[TrackingManager] Confirming pending exit for session ${session.id} at ${session.pendingExitAt}`);
    await this.db.confirmPendingExit(session.id);
    await ExitVerificationService.cancelVerification(session.id, 'expired');
    trackingEvents.emit('tracking-changed');
    await this.notifyClockOut(session.id, session.locationId, knownLocationName);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Inside = the whole error circle within the plain fence; outside = the whole
   * error circle beyond the fence PLUS the margin; anything else uncertain. The
   * margin only ever makes "outside" harder, never "inside" easier.
   */
  private classifyForExit(fix: FixLike, location: UserLocation | null): FixClass {
    if (!location) return 'uncertain';
    if (classifyFix(fix, location) === 'inside') return 'inside';
    if (classifyFix(fix, { ...location, radiusMeters: location.radiusMeters + EXIT_MARGIN_METERS }) === 'outside') return 'outside';
    return 'uncertain';
  }

  /**
   * Rule 6: for an ACTIVE auto session, the time it should end when an outside
   * fix / a cap / an arrival comes after the heartbeat has been dead since the
   * last inside evidence — or null when the stream was alive (the departure is
   * then now) or the heartbeat never ran during this session (nothing to say).
   */
  private async unknownDepartureEnd(session: TrackingSession, asOfMs: number): Promise<number | null> {
    if (session.state !== 'active' || session.trackingMethod === 'manual') return null;
    const lastInsideMs = toMs(session.lastInsideAt ?? session.clockIn);
    const { lastMs } = await this.heartbeat();
    if (lastMs === null || lastMs <= toMs(session.clockIn)) return null; // heartbeat never ran this session
    const silentForMs = asOfMs - Math.max(lastInsideMs, lastMs);
    if (silentForMs <= STREAM_GAP_MS) return null; // the stream was alive: the departure is now
    return lastInsideMs;
  }

  private async closeAtLastSeen(session: TrackingSession, endMs: number, location: UserLocation | null): Promise<void> {
    const endIso = new Date(endMs).toISOString();
    console.log(`[TrackingManager] Heartbeat was dead since the last inside evidence - closing session ${session.id} at ${endIso}`);
    await ExitVerificationService.cancelVerification(session.id, 'expired');
    await this.db.clockOut(session.id, endIso);
    trackingEvents.emit('tracking-changed');
    await this.sendNotification(
      t('tracking.notifications.title'),
      t('tracking.notifications.closedAtLastSeen', { location: location?.name ?? 'Work Location' }),
      { sessionId: session.id, autoClosed: true, lastSeen: true }
    );
  }

  /** Was this OS callback the initial trigger of a fence (re)registration (an app open)? */
  private async isInitialTrigger(asOfMs: number): Promise<boolean> {
    const registered = await this.db.getPreference(GEOFENCES_REGISTERED_AT_KEY);
    if (registered === null) return false;
    const delta = asOfMs - toMs(registered);
    return delta >= -STALE_TOLERANCE_MS && delta <= INITIAL_TRIGGER_WINDOW_MS;
  }

  /** Rule 2: is a fix at `fixMs` older than the latest session boundary? */
  private async staleReason(locationId: string, session: TrackingSession | null, fixMs: number): Promise<string | null> {
    if (session) {
      if (session.state === 'pending_exit' && session.pendingExitAt && fixMs < toMs(session.pendingExitAt) - STALE_TOLERANCE_MS) {
        return `fix predates pending exit (${session.pendingExitAt})`;
      }
      return null;
    }
    const lastClockOut = await this.db.getLastClockOut(locationId);
    if (lastClockOut && fixMs < toMs(lastClockOut) - STALE_TOLERANCE_MS) {
      return `fix before last clock-out (${lastClockOut})`;
    }
    return null;
  }

  private async heartbeat(): Promise<{ lastMs: number | null; sinceMs: number | null }> {
    const last = await this.db.getPreference(KEEPALIVE_LAST_PING_KEY);
    const since = await this.db.getPreference(KEEPALIVE_STREAM_SINCE_KEY);
    return { lastMs: last ? toMs(last) : null, sinceMs: since ? toMs(since) : null };
  }

  /**
   * Was the heartbeat running without interruption from `fromMs` to `toMs`?
   * True when the current run started no later than `fromMs` (plus one gap of
   * tolerance) and its latest fix reached `toMs`.
   */
  private async streamAliveThrough(fromMs: number, toMs_: number): Promise<boolean> {
    const { lastMs, sinceMs } = await this.heartbeat();
    if (lastMs === null || sinceMs === null) return false;
    return sinceMs <= fromMs + STREAM_GAP_MS && lastMs >= toMs_;
  }

  private async noteHeartbeatImpl(fixIso: string): Promise<void> {
    const fixMs = toMs(fixIso);
    const last = await this.db.getPreference(KEEPALIVE_LAST_PING_KEY);
    const lastMs = last === null ? null : toMs(last);
    if (lastMs !== null && fixMs <= lastMs) return; // liveness only moves forward
    if (lastMs === null || fixMs - lastMs > STREAM_GAP_MS) {
      await this.db.setPreference(KEEPALIVE_STREAM_SINCE_KEY, fixIso); // a new run
    }
    await this.db.setPreference(KEEPALIVE_LAST_PING_KEY, fixIso);
  }

  private async isAutoEnterSuppressed(locationId: string, asOfMs: number): Promise<boolean> {
    const since = await this.db.getPreference(AUTO_ENTER_SUPPRESSED_PREFIX + locationId);
    if (!since) return false;
    return asOfMs - toMs(since) <= GAP_MS; // expires on its own after GAP
  }

  private async clearAutoEnterSuppression(locationId: string): Promise<void> {
    const since = await this.db.getPreference(AUTO_ENTER_SUPPRESSED_PREFIX + locationId);
    if (since) await this.db.setPreference(AUTO_ENTER_SUPPRESSED_PREFIX + locationId, '');
  }

  /** One bounded fetch for the foreground pass; null on any failure. */
  private async fetchCurrentFix(): Promise<TrackingFix | null> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('active fetch timed out')), FOREGROUND_FETCH_TIMEOUT_MS);
      });
      const fix = (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeout,
      ])) as Location.LocationObject | undefined;
      if (!fix?.coords) return null;
      return {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy,
        timestamp: new Date(fix.timestamp || Date.now()).toISOString(),
      };
    } catch (error) {
      console.warn('[TrackingManager] Foreground fetch failed:', error);
      return null;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private eventFromFix(type: 'enter' | 'exit', locationId: string, fix: TrackingFix): GeofenceEventData {
    return {
      eventType: type,
      locationId,
      timestamp: fix.timestamp,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy ?? undefined,
      accuracySource: 'keepalive',
    };
  }

  private async logEvent(event: GeofenceEventData, ignored: boolean, ignoreReason: IgnoreReason): Promise<void> {
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      accuracySource: event.accuracySource,
      ignored,
      ignoreReason,
    });
  }

  /** One place for the clock-out notification (short-session variant included). */
  private async notifyClockOut(
    sessionId: string,
    locationId: string,
    knownLocationName?: string,
    options: { manual?: boolean } = {}
  ): Promise<void> {
    const completed = await this.db.getSession(sessionId);
    const durationMinutes = completed?.durationMinutes ?? 0;
    const locationName = knownLocationName ?? (await this.db.getLocation(locationId))?.name ?? 'Work Location';

    if (durationMinutes < MIN_SESSION_MINUTES) {
      console.log(`[TrackingManager] Short session (${durationMinutes} min) - keeping for review`);
      await this.sendNotification(
        'Short session recorded',
        `${durationMinutes} min session at ${locationName} saved - you can adjust it in the calendar`,
        { sessionId, shortSession: true }
      );
      return;
    }
    await this.sendNotification(
      'Clocked Out',
      `${options.manual ? 'Manually clocked out from' : 'Clocked out from'} ${locationName}. Worked ${formatDuration(durationMinutes)}.`,
      { sessionId }
    );
  }

  private async sendNotification(title: string, body: string, data: Record<string, unknown> = {}): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: null,
        ...(Platform.OS === 'android' && { channelId: 'alerts' }),
      });
    } catch (error) {
      console.error('[TrackingManager] Failed to send notification:', error);
    }
  }
}
