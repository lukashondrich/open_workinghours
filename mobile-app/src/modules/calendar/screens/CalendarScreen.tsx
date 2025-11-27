import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarProvider, useCalendar } from '@/lib/calendar/calendar-context';
import CalendarHeader from '../components/CalendarHeader';
import WeekView from '../components/WeekView';
import MonthView from '../components/MonthView';
import TemplatePanel from '../components/TemplatePanel';

function CalendarLayout() {
  const { state } = useCalendar();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <CalendarHeader />
      {state.view === 'week' ? <WeekView /> : <MonthView />}
        <TemplatePanel />
      </View>
    </SafeAreaView>
  );
}

export default function CalendarScreen() {
  return (
    <CalendarProvider>
      <CalendarLayout />
    </CalendarProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
