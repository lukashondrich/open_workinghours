/**
 * WelcomeScreen - Entry point for unauthenticated users
 *
 * Social-first layout: platform-native social button on top, email as
 * a full-width outlined button below a divider. App icon for branding.
 *
 * Design rules followed:
 * - Apple HIG: native AppleAuthenticationButton, CONTINUE type, ≥44pt, visible without scroll
 * - Google branding: custom button with official multi-color G, white bg + grey border
 * - All buttons: same height (50px), same corner radius (12px), full width
 * - App Store §4.8: Apple shown on iOS (no third-party social on iOS → compliant)
 */

import React, { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { AuthService } from '../services/AuthService';
import { useAuth } from '@/lib/auth/auth-context';
import { openTermsUrl, openPrivacyUrl } from '@/lib/utils/legalUrls';
import type { SocialAuthStartResponse } from '@/lib/auth/auth-types';

// Platform-conditional native imports — avoid loading modules that aren't
// linked on the other platform (Google Sign-In is Android-only, Apple Auth is iOS-only).
const AppleAuthentication = Platform.OS === 'ios'
  ? require('expo-apple-authentication')
  : null;
const GoogleSignin = Platform.OS === 'android'
  ? require('@react-native-google-signin/google-signin').GoogleSignin
  : null;
const GoogleLogo = Platform.OS === 'android'
  ? require('../components/GoogleLogo').default
  : null;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const appIcon = require('../../../../assets/icon.png');

const BUTTON_HEIGHT = 50;
const BUTTON_RADIUS = borderRadius.lg; // 12px — matches card style

function getSocialAuthErrorMessage(error: any, fallback: string): string {
  const details = [
    error?.code ? `Code: ${String(error.code)}` : null,
    error?.message ? `Message: ${String(error.message)}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? `${fallback}\n\n${details.join('\n')}`
    : fallback;
}

interface WelcomeScreenProps {
  onLoginPress: () => void;
  /** @deprecated No longer shown as a separate button; kept for navigator compat */
  onRegisterPress?: () => void;
  onSocialRegistrationRequired: (token: string) => void;
}

export default function WelcomeScreen({
  onLoginPress,
  onSocialRegistrationRequired,
}: WelcomeScreenProps) {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios' && AppleAuthentication) {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

  const handleSocialAuthResponse = async (response: SocialAuthStartResponse) => {
    if (response.status === 'authenticated') {
      if (!response.access_token || !response.expires_at || !response.user_id) {
        throw new Error('Incomplete auth response');
      }

      let user;
      if (response.user) {
        user = {
          userId: response.user.user_id,
          hospitalId: response.user.hospital_id,
          specialty: response.user.specialty,
          roleLevel: response.user.role_level,
          stateCode: response.user.state_code,
          createdAt: response.user.created_at,
          profession: response.user.profession,
          seniority: response.user.seniority,
          departmentGroup: response.user.department_group,
          specializationCode: response.user.specialization_code,
          hospitalRefId: response.user.hospital_ref_id,
          termsAcceptedVersion: response.user.terms_accepted_version,
          privacyAcceptedVersion: response.user.privacy_accepted_version,
          consentAcceptedAt: response.user.consent_accepted_at,
        };
      } else {
        user = await AuthService.getCurrentUser(response.access_token);
      }

      await signIn(user, response.access_token, new Date(response.expires_at));
    } else if (response.status === 'registration_required') {
      if (!response.social_registration_token) {
        throw new Error('Missing social registration token');
      }
      onSocialRegistrationRequired(response.social_registration_token);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const response = await AuthService.loginWithApple(credential.identityToken);
      await handleSocialAuthResponse(response);
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') return;

      console.error('[WelcomeScreen] Apple sign-in failed:', error);
      Alert.alert(
        t('auth.social.error') || 'Sign-In Failed',
        t('auth.social.tryAgain') || 'Please try again or use email sign-in.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const webClientId = Constants.expoConfig?.extra?.googleWebClientId || '';
      GoogleSignin.configure({ webClientId });
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      if (userInfo.type === 'cancelled') {
        return;
      }

      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const response = await AuthService.loginWithGoogle(idToken);
      await handleSocialAuthResponse(response);
    } catch (error: any) {
      if (error?.code === 'SIGN_IN_CANCELLED') return;

      console.error('[WelcomeScreen] Google sign-in failed:', error);
      Alert.alert(
        t('auth.social.error') || 'Sign-In Failed',
        getSocialAuthErrorMessage(
          error,
          t('auth.social.tryAgain') || 'Please try again or use email sign-in.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* ── Branding ── */}
        <View style={styles.header}>
          <Image source={appIcon} style={styles.appIcon} />
          <Text style={styles.title}>{t('welcome.title')}</Text>
          <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        </View>

        {/* ── Auth buttons ── */}
        <View style={styles.buttons}>
          {/* Social button — platform-native */}
          {Platform.OS === 'ios' && appleAuthAvailable && AppleAuthentication && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={BUTTON_RADIUS}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              testID="apple-signin-button"
            />
          )}
          {/* DEV ONLY: mock Apple button for simulator visual inspection */}
          {__DEV__ && Platform.OS === 'ios' && !appleAuthAvailable && (
            <View style={styles.mockAppleButton} testID="apple-signin-button-mock">
              <Ionicons name="logo-apple" size={20} color={colors.white} />
              <Text style={styles.mockAppleButtonText}>
                {t('auth.social.appleButton')}
              </Text>
            </View>
          )}

          {Platform.OS === 'android' && GoogleLogo && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.7}
              testID="google-signin-button"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('auth.social.googleButton')}
            >
              <GoogleLogo size={20} />
              <Text style={styles.socialButtonText}>
                {t('auth.social.googleButton')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider — only show when a social button is visible above */}
          {(Platform.OS === 'ios' || Platform.OS === 'android') && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.social.or')}</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Email — full-width outlined button, same dimensions as social */}
          <TouchableOpacity
            style={[styles.emailButton, loading && styles.emailButtonDisabled]}
            onPress={onLoginPress}
            disabled={loading}
            activeOpacity={0.7}
            testID="email-signin-button"
            accessible={true}
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={20} color={colors.text.primary} />
            <Text style={styles.emailButtonText}>
              {t('auth.social.emailLink')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading overlay */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
          </View>
        )}

        {/* Legal footer with linked docs */}
        <Text style={styles.legal}>
          {t('auth.social.legalPrefix')}
          <Text style={styles.legalLink} onPress={openTermsUrl}>
            {t('auth.social.termsLink')}
          </Text>
          {t('auth.social.legalJoin')}
          <Text style={styles.legalLink} onPress={openPrivacyUrl}>
            {t('auth.social.privacyLink')}
          </Text>
          {t('auth.social.legalSuffix')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },

  /* ── Branding ── */
  header: {
    alignItems: 'center',
    marginBottom: spacing.section,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* ── Buttons ── */
  buttons: {
    gap: spacing.md,
  },
  appleButton: {
    width: '100%',
    height: BUTTON_HEIGHT,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
    ...shadows.sm,
  },
  socialButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  mockAppleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: colors.black,
    gap: spacing.sm,
  },
  mockAppleButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
    ...shadows.sm,
  },
  emailButtonDisabled: {
    opacity: 0.5,
  },
  emailButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },

  /* ── Divider ── */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
  dividerText: {
    marginHorizontal: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },

  /* ── Loading ── */
  loadingRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },

  /* ── Legal ── */
  legal: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xxxl,
    lineHeight: 18,
  },
  legalLink: {
    color: colors.primary[500],
    textDecorationLine: 'underline',
  },
});
