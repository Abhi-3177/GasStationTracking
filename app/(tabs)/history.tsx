import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { Calendar, ChevronDown, ChevronUp, BookOpen, ClipboardList, Trash2 } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { DayBookRecord, DailyRecord } from '../../types/daybook';
import { calculateTotals } from '../../utils/calculations';
import { getAllRecords, getAllDailyRecords, deleteRecordsForDate } from '../../utils/database';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

interface HistoryItem {
  date: string;
  dayBook: DayBookRecord | null;
  dailyRecord: DailyRecord | null;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { dataVersion, refreshData } = useData();
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [calendarMonth, setCalendarMonth] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarVisible, setIsCalendarVisible] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [dayBookRecords, dailyRecords] = await Promise.all([
        getAllRecords(),
        getAllDailyRecords(),
      ]);

      const combinedData: { [date: string]: HistoryItem } = {};

      dayBookRecords.forEach(record => {
        if (!combinedData[record.date]) {
          combinedData[record.date] = { date: record.date, dayBook: null, dailyRecord: null };
        }
        combinedData[record.date].dayBook = record;
      });

      dailyRecords.forEach(record => {
        if (!combinedData[record.date]) {
          combinedData[record.date] = { date: record.date, dayBook: null, dailyRecord: null };
        }
        combinedData[record.date].dailyRecord = record;
      });

      const sortedHistory = Object.values(combinedData).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setHistoryItems(sortedHistory);
    } catch (error: any) {
      console.error('Error loading history:', error);
      Alert.alert('Error', error.message || 'Failed to load history.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  useEffect(() => {
    loadHistory();
  }, [dataVersion]);

  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};
    historyItems.forEach(item => {
      marks[item.date] = { marked: true, dotColor: '#2563eb' };
    });
    marks[selectedDate] = { 
      ...(marks[selectedDate] || {}), 
      selected: true, 
      selectedColor: '#2563eb',
    };
    return marks;
  }, [historyItems, selectedDate]);

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const handleEditRecord = (path: string, date: string) => {
    router.push({
      pathname: path,
      params: { date },
    });
  };

  const handleDeleteRecords = (date: string) => {
    Alert.alert(
      'Delete All Records for Date',
      `Are you sure you want to delete all records for ${format(new Date(date), 'PPP')}? This will delete the Day Book and Daily Record for this date.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecordsForDate(date);
              refreshData(); // Use the context to trigger a refresh
              Alert.alert('Success', 'Records for the selected date have been deleted.');
            } catch (error: any) {
              console.error('Error deleting records:', error);
              Alert.alert('Error', error.message || 'Failed to delete records.');
            }
          },
        },
      ]
    );
  };

  const renderHistoryCard = (item: HistoryItem) => {
    const { date, dayBook, dailyRecord } = item;
    const totals = dayBook ? calculateTotals(dayBook) : null;
    
    const recordDate = new Date(date);
    const timezoneOffset = recordDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(recordDate.getTime() + timezoneOffset);

    const totalBankSettled = dailyRecord?.bankReconciliation.reduce((sum, entry) => sum + entry.actual, 0) || 0;
    const totalPaymentsReceived = dailyRecord?.paymentsReceived.reduce((sum, p) => sum + p.amount, 0) || 0;
    
    return (
      <Card key={date} style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View style={styles.dateSection}>
            <Calendar size={20} color="#2563eb" />
            <Text style={styles.recordDate}>
              {format(adjustedDate, 'PPP')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteRecords(date)}
            style={styles.deleteButton}
          >
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.recordContent}>
          {dayBook && totals && (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeader}>
                <BookOpen size={16} color="#059669" />
                <Text style={styles.summaryTitle}>Day Book</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Day Balance:</Text>
                <Text style={[styles.dayBalanceValue, totals.dayBalance < 0 && styles.negativeBalance]}>
                  ₹{totals.dayBalance.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity style={styles.viewButton} onPress={() => handleEditRecord('/(tabs)', date)}>
                <Text style={styles.viewButtonText}>View / Edit Day Book</Text>
              </TouchableOpacity>
            </View>
          )}

          {dailyRecord && (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeader}>
                <ClipboardList size={16} color="#7c3aed" />
                <Text style={styles.summaryTitle}>Daily Record</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bank Settled:</Text>
                <Text style={styles.summaryValue}>₹{totalBankSettled.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payments Received:</Text>
                <Text style={styles.summaryValue}>₹{totalPaymentsReceived.toFixed(2)}</Text>
              </View>
              <TouchableOpacity style={styles.viewButton} onPress={() => handleEditRecord('/(tabs)/daily-record', date)}>
                <Text style={styles.viewButtonText}>View / Edit Daily Record</Text>
              </TouchableOpacity>
            </View>
          )}

          {!dayBook && !dailyRecord && (
            <Text style={styles.noDataText}>No summary data available.</Text>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Card>
              <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsCalendarVisible(!isCalendarVisible)}>
                <View style={styles.collapsibleTitleContainer}>
                    <Calendar size={20} color="#1f2937" />
                    <Text style={styles.collapsibleTitle}>Calendar</Text>
                </View>
                {isCalendarVisible ? <ChevronUp size={24} color="#2563eb" /> : <ChevronDown size={24} color="#2563eb" />}
              </TouchableOpacity>

              {isCalendarVisible && (
                <View style={styles.calendarContainer}>
                    <RNCalendar
                        current={calendarMonth}
                        onMonthChange={(month) => setCalendarMonth(month.dateString)}
                        onDayPress={onDayPress}
                        markedDates={markedDates}
                        theme={{
                          todayTextColor: '#2563eb',
                          arrowColor: '#2563eb',
                          'stylesheet.calendar.header': { week: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' } }
                        }}
                    />
                </View>
              )}
            </Card>

            <View style={styles.recordsHeader}>
              <Text style={styles.recordsTitle}>
                History ({historyItems.length})
              </Text>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color="#2563eb" />
            ) : historyItems.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>No records found.</Text>
              </Card>
            ) : (
              historyItems.map(renderHistoryCard)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collapsibleTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapsibleTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  calendarContainer: { paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  recordsHeader: { marginTop: 8 },
  recordsTitle: { fontSize: 20, fontWeight: '600', color: '#1f2937' },
  recordCard: { padding: 0, overflow: 'hidden' },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDate: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  deleteButton: { padding: 8, borderRadius: 8, backgroundColor: '#fef2f2' },
  recordContent: { padding: 16, gap: 16 },
  summarySection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  dayBalanceValue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  negativeBalance: { color: '#dc2626' },
  viewButton: {
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyCard: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
  noDataText: { fontSize: 14, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', paddingVertical: 8 },
});
