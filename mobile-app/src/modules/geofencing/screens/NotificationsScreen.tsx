import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';

export default function NotificationsScreen() {
  const [checkInNotifications, setCheckInNotifications] = useState(true);
  const [checkOutNotifications, setCheckOutNotifications] = useState(true);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Check-in notifications</Text>
          <Switch
            value={checkInNotifications}
            onValueChange={setCheckInNotifications}
            trackColor={{ false: '#D0D0D0', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Check-out notifications</Text>
          <Switch
            value={checkOutNotifications}
            onValueChange={setCheckOutNotifications}
            trackColor={{ false: '#D0D0D0', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.hint}>
          Receive notifications when you automatically check in or out of your work locations
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    lineHeight: 20,
  },
});
