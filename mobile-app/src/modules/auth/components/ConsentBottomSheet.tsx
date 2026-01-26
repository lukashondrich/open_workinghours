/**
 * ConsentBottomSheet - GDPR consent collection
 *
 * Shows Terms of Service and Privacy Policy links with key points summary.
 * User must check the checkbox and tap "I Agree" to proceed.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import { FileText, Shield, Check, ChevronRight } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { Button, Checkbox } from '@/components/ui';
import { t } from '@/lib/i18n';

interface ConsentBottomSheetProps {
  visible: boolean;
  onAccept: () => void;
  onCancel: () => void;
  mode?: 'initial' | 'update';
  loading?: boolean;
}

// Policy URLs - use device locale to determine language
const getTermsUrl = (locale: string) =>
  locale.startsWith('de')
    ? 'https://openworkinghours.org/de/terms'
    : 'https://openworkinghours.org/terms';

const getPrivacyUrl = (locale: string) =>
  locale.startsWith('de')
    ? 'https://openworkinghours.org/de/app-privacy-policy'
    : 'https://openworkinghours.org/app-privacy-policy';

export function ConsentBottomSheet({
  visible,
  onAccept,
  onCancel,
  mode = 'initial',
  loading = false,
}: ConsentBottomSheetProps) {
  const sheetRef = useRef<RBSheet>(null);
  const [accepted, setAccepted] = useState(false);

  // Get current locale for URL selection
  const locale = t('_locale') || 'en';

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const handleClose = () => {
    setAccepted(false);
    onCancel();
  };

  const handleAccept = () => {
    if (!accepted || loading) return;
    onAccept();
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('[ConsentBottomSheet] Failed to open URL:', error);
    }
  };

  return (
    <RBSheet
      ref={sheetRef}
      height={520}
      openDuration={250}
      closeDuration={200}
      onClose={handleClose}
      customStyles={{
        container: styles.sheetContainer,
        draggableIcon: styles.dragHandle,
      }}
      draggable={false}
      closeOnPressMask={false}
    >
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>
          {mode === 'initial' ? t('consent.title') : t('consent.updateTitle')}
        </Text>

        {mode === 'update' && (
          <Text style={styles.subtitle}>{t('consent.updateSubtitle')}</Text>
        )}

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Policy Links */}
          <TouchableOpacity
            style={styles.policyCard}
            onPress={() => openUrl(getTermsUrl(locale))}
            activeOpacity={0.7}
            testID="consent-terms-link"
          >
            <View style={styles.policyIcon}>
              <FileText size={24} color={colors.primary[500]} />
            </View>
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>{t('consent.terms.title')}</Text>
              <Text style={styles.policySubtitle}>{t('consent.terms.subtitle')}</Text>
            </View>
            <ChevronRight size={20} color={colors.grey[400]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.policyCard}
            onPress={() => openUrl(getPrivacyUrl(locale))}
            activeOpacity={0.7}
            testID="consent-privacy-link"
          >
            <View style={styles.policyIcon}>
              <Shield size={24} color={colors.primary[500]} />
            </View>
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>{t('consent.privacy.title')}</Text>
              <Text style={styles.policySubtitle}>{t('consent.privacy.subtitle')}</Text>
            </View>
            <ChevronRight size={20} color={colors.grey[400]} />
          </TouchableOpacity>

          {/* Key Points */}
          <View style={styles.keyPointsSection}>
            <Text style={styles.keyPointsTitle}>{t('consent.keyPoints.title')}</Text>

            <View style={styles.keyPoint}>
              <View style={styles.keyPointIcon}>
                <Check size={16} color={colors.primary[500]} strokeWidth={3} />
              </View>
              <Text style={styles.keyPointText}>{t('consent.keyPoints.aggregation')}</Text>
            </View>

            <View style={styles.keyPoint}>
              <View style={styles.keyPointIcon}>
                <Check size={16} color={colors.primary[500]} strokeWidth={3} />
              </View>
              <Text style={styles.keyPointText}>{t('consent.keyPoints.gpsLocal')}</Text>
            </View>

            <View style={styles.keyPoint}>
              <View style={styles.keyPointIcon}>
                <Check size={16} color={colors.primary[500]} strokeWidth={3} />
              </View>
              <Text style={styles.keyPointText}>{t('consent.keyPoints.deletion')}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Footer */}
        <View style={styles.footer}>
          {/* Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.7}
            testID="consent-checkbox"
          >
            <Checkbox
              checked={accepted}
              onPress={() => setAccepted(!accepted)}
              size="md"
            />
            <Text style={styles.checkboxText}>{t('consent.checkbox')}</Text>
          </TouchableOpacity>

          {/* Buttons */}
          <Button
            onPress={handleAccept}
            disabled={!accepted}
            loading={loading}
            fullWidth
            size="lg"
            testID="consent-accept-button"
          >
            {t('consent.accept')}
          </Button>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            activeOpacity={0.7}
            testID="consent-cancel-button"
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RBSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    backgroundColor: colors.background.paper,
  },
  dragHandle: {
    backgroundColor: colors.grey[300],
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  scrollView: {
    flex: 1,
    marginBottom: spacing.md,
  },

  // Policy Cards
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.grey[50],
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  policyText: {
    flex: 1,
  },
  policyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  policySubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Key Points
  keyPointsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  keyPointsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  keyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  keyPointIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  keyPointText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },

  // Footer
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkboxText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  cancelText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
});
