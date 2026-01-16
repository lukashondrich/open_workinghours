import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { startOfWeek, parseISO } from 'date-fns';
import { CalendarProvider, useCalendar } from '@/lib/calendar/calendar-context';
import { ZoomProvider } from '@/lib/calendar/zoom-context';
import CalendarHeader from '../components/CalendarHeader';
import WeekView from '../components/WeekView';
import MonthView from '../components/MonthView';
import TemplatePanel from '../components/TemplatePanel';
import CalendarFAB from '../components/CalendarFAB';
import type { MainTabParamList } from '@/navigation/AppNavigator';

type CalendarScreenRouteProp = RouteProp<MainTabParamList, 'Calendar'>;

function CalendarLayout({ targetDate }: { targetDate?: string }) {
  const { state, dispatch } = useCalendar();

  // Navigate to target date's week if provided
  useEffect(() => {
    if (targetDate) {
      try {
        const date = parseISO(targetDate);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        dispatch({ type: 'SET_WEEK', date: weekStart });
      } catch (error) {
        console.error('[CalendarScreen] Failed to parse targetDate:', error);
      }
    }
  }, [targetDate, dispatch]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <CalendarHeader />
        {state.view === 'week' ? <WeekView /> : <MonthView />}
        <TemplatePanel />
        <CalendarFAB />
      </View>
    </SafeAreaView>
  );
}

export default function CalendarScreen() {
  const route = useRoute<CalendarScreenRouteProp>();
  const targetDate = route.params?.targetDate;

  return (
    <CalendarProvider>
      <ZoomProvider>
        <CalendarLayout targetDate={targetDate} />
      </ZoomProvider>
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
});
