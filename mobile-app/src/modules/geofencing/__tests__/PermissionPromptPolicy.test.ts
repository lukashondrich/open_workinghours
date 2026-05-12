import { decidePermissionPrompt } from '../services/PermissionPromptPolicy';

const now = new Date('2026-04-16T12:00:00.000Z');

describe('PermissionPromptPolicy', () => {
  const baseInput = {
    foregroundGranted: true,
    backgroundGranted: false,
    userDeclinedLocationPermission: false,
    firstDeclinedAt: null,
    promptCount: 0,
    lastPromptedAt: null,
    permanentlyDismissed: false,
    context: 'manual-clock-in' as const,
    now,
  };

  it('does not prompt when background permission is already granted', () => {
    const decision = decidePermissionPrompt({
      ...baseInput,
      backgroundGranted: true,
    });

    expect(decision).toMatchObject({
      shouldPrompt: false,
      userType: 'auto-user',
      reason: 'background-granted',
    });
  });

  it('prompts foreground-only users on manual clock-in until the cap is reached', () => {
    expect(decidePermissionPrompt(baseInput)).toMatchObject({
      shouldPrompt: true,
      userType: 'upgrade-candidate',
      variant: 'upgrade',
      showDontAskAgain: false,
    });

    expect(decidePermissionPrompt({ ...baseInput, promptCount: 1 })).toMatchObject({
      shouldPrompt: true,
      showDontAskAgain: true,
    });

    expect(decidePermissionPrompt({ ...baseInput, promptCount: 3 })).toMatchObject({
      shouldPrompt: false,
      reason: 'upgrade-cap-reached',
    });
  });

  it('waits 14 days before prompting denied-all users', () => {
    const decision = decidePermissionPrompt({
      ...baseInput,
      foregroundGranted: false,
      userDeclinedLocationPermission: true,
      firstDeclinedAt: '2026-04-05T12:00:00.000Z',
    });

    expect(decision).toMatchObject({
      shouldPrompt: false,
      userType: 'denied-all',
      reason: 'denied-all-initial-wait',
    });
  });

  it('prompts denied-all users after the initial wait and shows a permanent dismiss option', () => {
    const decision = decidePermissionPrompt({
      ...baseInput,
      foregroundGranted: false,
      userDeclinedLocationPermission: true,
      firstDeclinedAt: '2026-04-01T12:00:00.000Z',
    });

    expect(decision).toMatchObject({
      shouldPrompt: true,
      userType: 'denied-all',
      variant: 'denied-all',
      showDontAskAgain: true,
    });
  });

  it('waits 30 days before repeating denied-all prompts', () => {
    expect(decidePermissionPrompt({
      ...baseInput,
      foregroundGranted: false,
      userDeclinedLocationPermission: true,
      firstDeclinedAt: '2026-03-01T12:00:00.000Z',
      promptCount: 1,
      lastPromptedAt: '2026-04-01T12:00:00.000Z',
    })).toMatchObject({
      shouldPrompt: false,
      reason: 'denied-all-repeat-wait',
    });

    expect(decidePermissionPrompt({
      ...baseInput,
      foregroundGranted: false,
      userDeclinedLocationPermission: true,
      firstDeclinedAt: '2026-03-01T12:00:00.000Z',
      promptCount: 1,
      lastPromptedAt: '2026-03-01T12:00:00.000Z',
    })).toMatchObject({
      shouldPrompt: true,
      variant: 'denied-all',
    });
  });

  it('honors permanent dismissal', () => {
    const decision = decidePermissionPrompt({
      ...baseInput,
      permanentlyDismissed: true,
    });

    expect(decision).toMatchObject({
      shouldPrompt: false,
      reason: 'permanently-dismissed',
    });
  });
});
