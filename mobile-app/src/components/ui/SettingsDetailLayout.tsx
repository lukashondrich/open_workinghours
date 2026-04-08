import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { t } from '@/lib/i18n';

interface SettingsDetailLayoutProps {
  title: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export function SettingsDetailLayout({
  title,
  children,
  contentStyle,
}: SettingsDetailLayoutProps) {
  const navigation = useNavigation();

  if (Platform.OS !== 'android') {
    return <View style={[styles.content, contentStyle]}>{children}</View>;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('navigation.back')}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={colors.primary[500]} />
          </TouchableOpacity>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
      </SafeAreaView>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  headerSafeArea: {
    backgroundColor: colors.background.paper,
  },
  header: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.section,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    position: 'absolute',
    left: spacing.sm,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
});
