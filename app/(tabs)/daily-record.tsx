import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Alert, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Save } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

import { DateSelector } from '../../components/DateSelector';
import { BankReconciliation } from '../../components/BankReconciliation';
import { DayBookSummary } from '../../components/DayBookSummary';
import { PaymentsReceived } from '../../components/PaymentsReceived';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { CashInHandSummary } from '../../components/CashInHandSummary';

import { DayBookRecord, DailyRecord, Account, BankReconciliationEntry, PaymentReceived } from '../../types/daybook';
import { getRecord, getPreviousRecord, getAllAccounts, getDailyRecord, saveDailyRecord, addPaymentReceived, deletePaymentReceived } from '../../utils/database';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const createNewDailyRecord = (date: string, userId: string, prevDayBook: DayBookRecord | null): DailyRecord => {
  const prevPayments = prevDayBook?.payments || { atmSale: 0, phonePeSale: 0, paytmSale: 0, cashDeposit: 0 };
  const bankReconciliation: BankReconciliationEntry[] = [
    { type: 'atmSale', expected: prevPayments.atmSale, actual: 0, matched: false },
    { type: 'phonePeSale', expected: prevPayments.phonePeSale, actual: 0, matched: false },
    { type: 'paytmSale', expected: prevPayments.paytmSale, actual: 0, matched: false },
    { type: 'cashDeposit', expected: prevPayments.cashDeposit, actual: 0, matched: false },
  ];

  return {
    date,
    user_id: userId,
    bankReconciliation,
    paymentsReceived: [],
  };
};

export default function DailyRecordScreen() {
  const { user } = useAuth();
  const { dataVersion, refreshData } = useData();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  
  const [dayBookRecord, setDayBookRecord] = useState<DayBookRecord | null>(null);
  const [previousDayBookRecord, setPreviousDayBookRecord] = useState<DayBookRecord | null>(null);
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const [dbRecord, prevDbRecord, existingDailyRecord, allAccounts] = await Promise.all([
        getRecord(dateKey),
        getPreviousRecord(dateKey),
        getDailyRecord(dateKey),
        getAllAccounts(),
      ]);

      setDayBookRecord(dbRecord);
      setPreviousDayBookRecord(prevDbRecord);
      setAccounts(allAccounts);

      if (existingDailyRecord) {
        const prevPayments = prevDbRecord?.payments || { atmSale: 0, phonePeSale: 0, paytmSale: 0, cashDeposit: 0 };
        const updatedReconciliation = existingDailyRecord.bankReconciliation.map(entry => ({
          ...entry,
          expected: prevPayments[entry.type] || 0,
        }));
        setDailyRecord({ ...existingDailyRecord, bankReconciliation: updatedReconciliation });
      } else {
        setDailyRecord(createNewDailyRecord(dateKey, user.id, prevDbRecord));
      }

    } catch (error: any) {
      console.error('Error loading Daily Record data:', error);
      Alert.alert('Loading Error', error.message || 'Could not load data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [dataVersion]);

  const handleUpdateReconciliation = (updatedReconciliation: BankReconciliationEntry[]) => {
    setDailyRecord(prev => prev ? { ...prev, bankReconciliation: updatedReconciliation } : null);
  };

  const handleAddPayment = async (payment: Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>) => {
    try {
      await addPaymentReceived(payment);
      refreshData();
      Alert.alert('Success', 'Payment added successfully!');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to add payment.');
    }
  };
  
  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deletePaymentReceived(paymentId);
      refreshData();
      Alert.alert('Success', 'Payment deleted successfully!');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to delete payment.');
    }
  };

  const handleSave = async () => {
    if (!dailyRecord) return;
    try {
      await saveDailyRecord(dailyRecord);
      Alert.alert('Success', 'Daily record has been saved successfully!');
    } catch (error: any) {
      console.error('Error saving Daily Record:', error);
      Alert.alert('Save Error', error.message || 'Failed to save the record.');
    }
  };

  if (isLoading || !dailyRecord) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading Daily Record...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ErrorBoundary>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

              <BankReconciliation
                previousDayRecord={previousDayBookRecord}
                bankReconciliation={dailyRecord.bankReconciliation}
                onUpdate={handleUpdateReconciliation}
              />

              <DayBookSummary dayBookRecord={dayBookRecord} />

              <PaymentsReceived
                payments={dailyRecord.paymentsReceived}
                accounts={accounts}
                onAddPayment={handleAddPayment}
                onDeletePayment={handleDeletePayment}
                date={dailyRecord.date}
              />

              <CashInHandSummary 
                dayBookRecord={dayBookRecord}
                dailyRecord={dailyRecord}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Save size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Save Daily Record</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ErrorBoundary>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#6b7280', marginTop: 10 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
