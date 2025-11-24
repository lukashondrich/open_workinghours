import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingsItem {
  id: string;
  title: string;
  icon: string;
  screen: keyof RootStackParamList;
}

const settingsItems: SettingsItem[] = [
  {
    id: '1',
    title: 'Work Locations',
    icon: '📍',
    screen: 'LocationsList',
  },
  {
    id: '2',
    title: 'Notifications',
    icon: '🔔',
    screen: 'Notifications',
  },
  {
    id: '3',
    title: 'Permissions',
    icon: '🔒',
    screen: 'Permissions',
  },
  {
    id: '4',
    title: 'Data & Privacy',
    icon: '🗑️',
    screen: 'DataPrivacy',
  },
];

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const handleItemPress = (screen: keyof RootStackParamList) => {
    // @ts-ignore - Navigation type checking is complex with mixed params
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {settingsItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.settingsItem}
            onPress={() => handleItemPress(item.screen)}
          >
            <View style={styles.itemLeft}>
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <Text style={styles.itemTitle}>{item.title}</Text>
            </View>
            <Text style={styles.itemChevron}>›</Text>
          </TouchableOpacity>
        ))}
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
  settingsItem: {
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
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000',
  },
  itemChevron: {
    fontSize: 28,
    color: '#C0C0C0',
  },
});
