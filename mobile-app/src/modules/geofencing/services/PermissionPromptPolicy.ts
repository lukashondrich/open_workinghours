const DAY_MS = 24 * 60 * 60 * 1000;

export type PermissionPromptContext = 'manual-clock-in';
export type PermissionPromptUserType = 'auto-user' | 'upgrade-candidate' | 'denied-all';
export type PermissionPromptVariant = 'upgrade' | 'denied-all';

export interface PermissionPromptPolicyInput {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  userDeclinedLocationPermission: boolean;
  firstDeclinedAt: string | null;
  promptCount: number;
  lastPromptedAt: string | null;
  permanentlyDismissed: boolean;
  context: PermissionPromptContext;
  now: Date;
}

export interface PermissionPromptDecision {
  shouldPrompt: boolean;
  userType: PermissionPromptUserType;
  variant?: PermissionPromptVariant;
  showDontAskAgain: boolean;
  reason?: string;
}

function daysBetween(from: string | null, to: Date): number | null {
  if (!from) {
    return null;
  }

  const fromTime = new Date(from).getTime();
  if (Number.isNaN(fromTime)) {
    return null;
  }

  return (to.getTime() - fromTime) / DAY_MS;
}

export function decidePermissionPrompt(input: PermissionPromptPolicyInput): PermissionPromptDecision {
  if (input.backgroundGranted) {
    return {
      shouldPrompt: false,
      userType: 'auto-user',
      showDontAskAgain: false,
      reason: 'background-granted',
    };
  }

  if (input.permanentlyDismissed) {
    return {
      shouldPrompt: false,
      userType: input.foregroundGranted ? 'upgrade-candidate' : 'denied-all',
      showDontAskAgain: false,
      reason: 'permanently-dismissed',
    };
  }

  if (input.context !== 'manual-clock-in') {
    return {
      shouldPrompt: false,
      userType: input.foregroundGranted ? 'upgrade-candidate' : 'denied-all',
      showDontAskAgain: false,
      reason: 'unsupported-context',
    };
  }

  if (input.foregroundGranted) {
    if (input.promptCount >= 3) {
      return {
        shouldPrompt: false,
        userType: 'upgrade-candidate',
        showDontAskAgain: false,
        reason: 'upgrade-cap-reached',
      };
    }

    return {
      shouldPrompt: true,
      userType: 'upgrade-candidate',
      variant: 'upgrade',
      showDontAskAgain: input.promptCount >= 1,
    };
  }

  if (!input.userDeclinedLocationPermission) {
    return {
      shouldPrompt: false,
      userType: 'denied-all',
      showDontAskAgain: false,
      reason: 'no-recorded-denial',
    };
  }

  if (input.promptCount >= 2) {
    return {
      shouldPrompt: false,
      userType: 'denied-all',
      showDontAskAgain: false,
      reason: 'denied-all-cap-reached',
    };
  }

  if (input.promptCount === 0) {
    const daysSinceDecline = daysBetween(input.firstDeclinedAt, input.now);
    if (daysSinceDecline === null || daysSinceDecline < 14) {
      return {
        shouldPrompt: false,
        userType: 'denied-all',
        showDontAskAgain: false,
        reason: 'denied-all-initial-wait',
      };
    }
  }

  if (input.promptCount === 1) {
    const daysSinceLastPrompt = daysBetween(input.lastPromptedAt, input.now);
    if (daysSinceLastPrompt === null || daysSinceLastPrompt < 30) {
      return {
        shouldPrompt: false,
        userType: 'denied-all',
        showDontAskAgain: false,
        reason: 'denied-all-repeat-wait',
      };
    }
  }

  return {
    shouldPrompt: true,
    userType: 'denied-all',
    variant: 'denied-all',
    showDontAskAgain: true,
  };
}
