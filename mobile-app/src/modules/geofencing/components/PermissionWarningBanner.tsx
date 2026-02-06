import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { t } from '@/lib/i18n';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  visible: boolean;
  onDismiss?: () => void;
}

export default function PermissionWarningBanner({ visible, onDismiss }: Props) {
  const navigation = useNavigation<NavigationProp>();

  if (!visible) {
    return null;
  }

  const handleGoToSettings = () => {
    navigation.navigate('Permissions');
  };

  return (
    <View style={styles.container}>
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color="#C62828" />
        </TouchableOpacity>
      )}
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{t('permissionWarning.title')}</Text>
          <Text style={styles.message}>
            {t('permissionWarning.message')}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleGoToSettings}>
        <Text style={styles.buttonText}>{t('permissionWarning.goToSettings')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 8,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#C62828',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#F44336',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
