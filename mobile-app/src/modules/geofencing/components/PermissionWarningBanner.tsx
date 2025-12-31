import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { t } from '@/lib/i18n';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  visible: boolean;
}

export default function PermissionWarningBanner({ visible }: Props) {
  const navigation = useNavigation<NavigationProp>();

  if (!visible) {
    return null;
  }

  const handleGoToSettings = () => {
    navigation.navigate('Permissions');
  };

  return (
    <View style={styles.container}>
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
