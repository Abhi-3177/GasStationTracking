import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { Calendar, ChevronDown, ChevronUp, BookOpen, ClipboardList, Trash2, TrendingUp, TrendingDown, Wallet, CreditCard, HandCoins, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DayBookRecord, DailyRecord, BankReconciliationEntry, CalculatedTotals } from '../../types/daybook';
import { getAllRecords, getAllDailyRecords, deleteRecordsForDate } from '../../utils/database';
import { calculateTotals } from '../../utils/calculations';
import { formatIndianCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

interface HistoryItem {
  date: string;
  dayBook: DayBookRecord | null;
  dailyRecord: DailyRecord | null;
  calculatedTotals?: CalculatedTotals | null;
}

const RECONCILIATION_TYPES_TO_SHOW: Array<BankReconciliationEntry['type']> = [
    'atmSale',
    'phonePeSale',
    'directPnbTransfer',
    'ioclCardSale',
];

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { showNotification } = useNotification();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [calendarMonth, setCalendarMonth] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [dayBookRecords, dailyRecords] = await Promise.all([
        getAllRecords(),
        getAllDailyRecords(),
      ]);

      const dayBookMap = new Map(dayBookRecords.map(r => [r.date, r]));
      const dailyRecordMap = new Map(dailyRecords.map(r => [r.date, r]));
      
      const allDates = new Set([...dayBookMap.keys(), ...dailyRecordMap.keys()]);
      const combinedDataUnsorted: HistoryItem[] = [];

      for (const date of allDates) {
        const dayBook = dayBookMap.get(date) || null;
        let dailyRecord = dailyRecordMap.get(date) || null;
        
        if (dailyRecord && dayBook) {
            const prevDate = format(subDays(new Date(date), 1), 'yyyy-MM-dd');
            const prevDayBook = dayBookMap.get(prevDate);
            
            const prevCashDepositTotal = prevDayBook?.payments.cashDeposits?.reduce((sum, entry) => sum + entry.amount, 0) || 0;
            const prevPayments = {
                atmSale: prevDayBook?.payments.atmSale || 0,
                phonePeSale: prevDayBook?.payments.phonePeSale || 0,
                paytmSale: prevDayBook?.payments.paytmSale || 0,
                directPnbTransfer: prevDayBook?.payments.directPnbTransfer || 0,
                ioclCardSale: prevDayBook?.payments.ioclCardSale || 0,
                cashDeposit: prevCashDepositTotal,
            };

            const actualsMap = new Map(dailyRecord.bankReconciliation.map(e => [e.type, e.actual]));

            const newReconciliationTemplate: BankReconciliationEntry[] = [
                { type: 'atmSale', expected: prevPayments.atmSale, actual: 0, matched: false },
                { type: 'phonePeSale', expected: prevPayments.phonePeSale, actual: 0, matched: false },
                { type: 'directPnbTransfer', expected: prevPayments.directPnbTransfer, actual: 0, matched: false },
                { type: 'ioclCardSale', expected: prevPayments.ioclCardSale, actual: 0, matched: false },
                { type: 'cashDeposit', expected: prevPayments.cashDeposit, actual: 0, matched: false },
                { type: 'paytmSale', expected: prevPayments.paytmSale, actual: 0, matched: false },
            ];

            const mergedReconciliation = newReconciliationTemplate.map(entry => {
                const actual = actualsMap.get(entry.type) || 0;
                const isMatched = Math.abs(actual - entry.expected) <= 1;
                return { ...entry, actual, matched: isMatched };
            });

            dailyRecord = { ...dailyRecord, bankReconciliation: mergedReconciliation };
        }
        
        combinedDataUnsorted.push({
            date,
            dayBook,
            dailyRecord,
        });
      }

      // Sort oldest to newest to calculate running balance
      const sortedForCalculation = combinedDataUnsorted.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let carryForwardForNextDay = 0;
      const historyWithBalances = sortedForCalculation.map(item => {
        if (!item.dayBook) {
          return { ...item, calculatedTotals: null };
        }
        
        // Use the carry-forward from the previous iteration
        const totals = calculateTotals(item.dayBook, carryForwardForNextDay);
        
        // Determine the carry-forward for the *next* iteration
        carryForwardForNextDay = item.dayBook.cashCollected ? 0 : totals.dayBalance;

        return { ...item, calculatedTotals: totals };
      });

      // Now sort newest to oldest for display
      const finalHistoryItems = historyWithBalances.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setHistoryItems(finalHistoryItems);
    } catch (error: any) {
      console.error('Error loading history:', error);
      showNotification(error.message || 'Failed to load history.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

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

  const handleNavigate = (path: string, date: string) => {
    router.push({
      pathname: path,
      params: { date },
    });
  };

  const handleDeleteRecords = (date: string) => {
    setDateToDelete(date);
  };
  
  const performDelete = async () => {
    if (!dateToDelete) return;
    
    setDeletingDate(dateToDelete);
    setDateToDelete(null);

    try {
      await deleteRecordsForDate(dateToDelete);
      showNotification('Records for the selected date have been deleted.', 'success');
      await loadHistory();
    } catch (error: any) {
        const errorMessage = `Deletion failed. This may be due to a database security policy or a network issue.`;
        console.error('Error deleting records:', error);
        showNotification(errorMessage, 'error');
    } finally {
      setDeletingDate(null);
    }
  };

  const renderHistoryCard = ({ item }: { item: HistoryItem }) => {
    const { date, dayBook, dailyRecord, calculatedTotals } = item;
    const recordDate = new Date(date);
    const timezoneOffset = recordDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(recordDate.getTime() + timezoneOffset);
    const isDeleting = deletingDate === date;
    
    const totals = calculatedTotals;
    const totalPaymentsReceived = dailyRecord?.paymentsReceived?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const getReconLabel = (type: string) => {
        switch(type) {
            case 'atmSale': return 'ATM';
            case 'phonePeSale': return 'PhonePe';
            case 'directPnbTransfer': return 'PNB';
            case 'ioclCardSale': return 'IOCL';
            default: return 'Unknown';
        }
    }
    
    const relevantReconEntries = (dailyRecord?.bankReconciliation || [])
        .filter(r => RECONCILIATION_TYPES_TO_SHOW.includes(r.type) && (r.expected > 0 || r.actual > 0));

    return (
      <Card key={date} style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View style={styles.dateSection}>
            <Calendar size={20} color="#2563eb" />
            <Text style={styles.recordDate}>{format(adjustedDate, 'EEEE, dd MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteRecords(date)}
            style={styles.deleteButton}
            disabled={isDeleting}
          >
            {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={18} color="#ef4444" />}
          </TouchableOpacity>
        </View>
        
        {relevantReconEntries.length > 0 && (
          <View style={styles.reconStatusSection}>
            <Text style={styles.reconTitle}>Bank Reconciliation Status</Text>
            <View style={styles.reconGrid}>
              {relevantReconEntries.map(r => (
                <View key={r.type} style={styles.reconItem}>
                  <Text style={styles.reconLabel}>{getReconLabel(r.type)}</Text>
                  {r.matched ? <CheckCircle size={14} color="#059669" /> : <View style={styles.unmatchedDot} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {totals && (
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}><TrendingUp size={16} color="#059669" /><Text style={styles.summaryLabel}>Total Sale</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totals.totalSale)}</Text></View>
            <View style={styles.summaryItem}><TrendingDown size={16} color="#ea580c" /><Text style={styles.summaryLabel}>Expenses</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totals.totalExpenses)}</Text></View>
            <View style={styles.summaryItem}><Wallet size={16} color="#2563eb" /><Text style={styles.summaryLabel}>Day Balance</Text><Text style={[styles.summaryValue, totals.dayBalance < 0 && styles.negativeValue]}>{formatIndianCurrency(totals.dayBalance)}</Text></View>
            <View style={styles.summaryItem}><CreditCard size={16} color="#7c3aed" /><Text style={styles.summaryLabel}>Total Credit</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totals.totalDeductions)}</Text></View>
            <View style={styles.summaryItem}><HandCoins size={16} color="#f59e0b" /><Text style={styles.summaryLabel}>Received</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totalPaymentsReceived)}</Text></View>
          </View>
        )}

        <View style={styles.actionsContainer}>
            <TouchableOpacity 
                style={[styles.actionButton, !dayBook && styles.actionButtonDisabled]} 
                disabled={!dayBook}
                onPress={() => handleNavigate('/(tabs)/index', date)}
            >
                <BookOpen size={16} color={dayBook ? "#1d4ed8" : "#9ca3af"} />
                <Text style={[styles.actionButtonText, !dayBook && styles.actionButtonTextDisabled]}>Day Book</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.actionButton, !dailyRecord && styles.actionButtonDisabled]} 
                disabled={!dailyRecord}
                onPress={() => handleNavigate('/(tabs)/daily-record', date)}
            >
                <ClipboardList size={16} color={dailyRecord ? "#1d4ed8" : "#9ca3af"} />
                <Text style={[styles.actionButtonText, !dailyRecord && styles.actionButtonTextDisabled]}>Daily Record</Text>
            </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={historyItems}
          renderItem={renderHistoryCard}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <>
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
                          renderArrow={(direction) => 
                            direction === 'left' ? 
                            <ChevronLeft size={24} color="#2563eb" /> : 
                            <ChevronRight size={24} color="#2563eb" />
                          }
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
                <Text style={styles.recordsTitle}>History ({historyItems.length})</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No records found.</Text>
            </Card>
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadHistory} tintColor="#2563eb" />}
        />

        {dateToDelete && (
            <ConfirmModal
                visible={!!dateToDelete}
                title="Delete All Records for Date"
                message={`Are you sure you want to delete all records for ${format(new Date(dateToDelete), 'dd/MM/yyyy')}? This will delete the Day Book and Daily Record for this date.`}
                onCancel={() => setDateToDelete(null)}
                onConfirm={performDelete}
                confirmText="Delete"
                isDestructive={true}
            />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  listContainer: { padding: 16, gap: 16 },
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDate: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  deleteButton: { padding: 8, borderRadius: 8, backgroundColor: '#fef2f2', width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  reconStatusSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#f9fafb' },
  reconTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  reconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reconItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reconLabel: { fontSize: 12, color: '#374151', textTransform: 'capitalize' },
  unmatchedDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fde047' },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  summaryItem: {
    flexBasis: '30%', 
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  negativeValue: {
    color: '#dc2626',
  },
  actionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  actionButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  actionButtonTextDisabled: {
    color: '#9ca3af',
  },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
});
