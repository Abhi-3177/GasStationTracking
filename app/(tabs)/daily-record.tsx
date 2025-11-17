import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Alert, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Save } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

import { DateSelector } from '@/components/DateSelector';
import { BankReconciliation } from '@/components/BankReconciliation';
import { DayBookSummary } from '@/components/DayBookSummary';
import { PaymentsReceived } from '@/components/PaymentsReceived';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CashInHandSummary } from '@/components/CashInHandSummary';
import { SaleByVehicle0332 } from '@/components/SaleByVehicle0332';

import { DayBookRecord, DailyRecord, Account, BankReconciliationEntry, PaymentReceived, Sale0332BreakdownEntry } from '@/types/daybook';
import { getRecord, getPreviousRecord, getAllAccounts, getDailyRecord, saveDailyRecord, addPaymentReceived, updatePaymentReceived, deletePaymentReceived } from '@/utils/database';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { calculateTotals } from '@/utils/calculations';

const createNewDailyRecord = (date: string, userId: string, prevDayBook: DayBookRecord | null): DailyRecord => {
  const prevCashDepositTotal = prevDayBook?.payments.cashDeposits?.reduce((sum, entry) => sum + entry.amount, 0) || 0;
  const prevPayments = {
    atmSale: prevDayBook?.payments.atmSale || 0,
    phonePeSale: prevDayBook?.payments.phonePeSale || 0,
    paytmSale: prevDayBook?.payments.paytmSale || 0,
    directPnbTransfer: prevDayBook?.payments.directPnbTransfer || 0,
    ioclCardSale: prevDayBook?.payments.ioclCardSale || 0,
    cashDeposit: prevCashDepositTotal,
  };

  const bankReconciliation: BankReconciliationEntry[] = [
    { type: 'atmSale', expected: prevPayments.atmSale, actual: 0, matched: false },
    { type: 'phonePeSale', expected: prevPayments.phonePeSale, actual: 0, matched: false },
    { type: 'paytmSale', expected: prevPayments.paytmSale, actual: 0, matched: false },
    { type: 'directPnbTransfer', expected: prevPayments.directPnbTransfer, actual: 0, matched: false },
    { type: 'ioclCardSale', expected: prevPayments.ioclCardSale, actual: 0, matched: false },
    { type: 'cashDeposit', expected: prevPayments.cashDeposit, actual: 0, matched: false },
  ];

  return {
    date,
    user_id: userId,
    bankReconciliation,
    paymentsReceived: [],
    sales0332Breakdown: [],
  };
};

export default function DailyRecordScreen() {
  const { user } = useAuth();
  const { dataVersion, refreshData } = useData();
  const { showNotification } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [dayBookRecord, setDayBookRecord] = useState<DayBookRecord | null>(null);
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [carryForward, setCarryForward] = useState(0);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const { data: recordsForCarryForward, error: rpcError } = await supabase.rpc('get_records_for_carry_forward', {
        p_target_date: dateKey,
      });

      if (rpcError) {
        throw new Error(`Failed to calculate carry-forward balance: ${rpcError.message}`);
      }
      
      let runningBalance = 0;
      if (recordsForCarryForward && recordsForCarryForward.length > 0) {
        for (const rec of recordsForCarryForward) {
          const dayBookData = rec.record as DayBookRecord;
          if (dayBookData.cashCollected) {
            runningBalance = 0;
          } else {
            const totalsForDay = calculateTotals(dayBookData, runningBalance);
            runningBalance = totalsForDay.dayBalance;
          }
        }
      }
      setCarryForward(runningBalance);

      const [dbRecord, prevDbRecord, existingDailyRecord, allAccounts] = await Promise.all([
        getRecord(dateKey),
        getPreviousRecord(dateKey),
        getDailyRecord(dateKey),
        getAllAccounts(),
      ]);

      setDayBookRecord(dbRecord);
      setAccounts(allAccounts);
      
      const newRecordTemplate = createNewDailyRecord(dateKey, user.id, prevDbRecord);

      if (existingDailyRecord) {
        const actualsMap = new Map(existingDailyRecord.bankReconciliation.map(e => [e.type, e.actual]));
        const mergedReconciliation = newRecordTemplate.bankReconciliation.map(entry => ({
            ...entry,
            actual: actualsMap.get(entry.type) || 0,
            matched: Math.abs((actualsMap.get(entry.type) || 0) - entry.expected) <= 1,
        }));
        setDailyRecord({ 
            ...existingDailyRecord, 
            bankReconciliation: mergedReconciliation,
            sales0332Breakdown: existingDailyRecord.sales0332Breakdown || [],
        });
      } else {
        setDailyRecord(newRecordTemplate);
      }

    } catch (error: any) {
      console.error('Error loading Daily Record data:', error);
      showNotification(error.message || 'Could not load data.', 'error');
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

  const handleUpdateReconciliation = async (updatedReconciliation: BankReconciliationEntry[]) => {
    if (!dailyRecord) return;
    setDailyRecord(prev => prev ? { ...prev, bankReconciliation: updatedReconciliation } : null);
  };
  
  const handleUpdate0332Breakdown = async (breakdown: Sale0332BreakdownEntry[]) => {
    if (!dailyRecord) return;

    const updatedRecord = { ...dailyRecord, sales0332Breakdown: breakdown };
    setDailyRecord(updatedRecord); // Optimistic UI update

    try {
        await saveDailyRecord(updatedRecord);
        showNotification('0332 sales breakdown has been saved.', 'success');
    } catch (error: any) {
        console.error('Error saving 0332 sales breakdown:', error);
        showNotification(error.message || 'Failed to save the breakdown.', 'error');
        // Optional: Revert state or prompt user to retry
    }
  };

  const handleAddPayment = async (payment: Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>) => {
    try {
      await addPaymentReceived(payment);
      refreshData();
    } catch (error: any) {
      showNotification('Failed to add payment.', 'error');
    }
  };

  const handleUpdatePayment = async (paymentId: string, updates: Partial<Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>>) => {
    try {
        await updatePaymentReceived(paymentId, updates);
        refreshData();
    } catch (error: any) {
        showNotification('Failed to update payment.', 'error');
    }
  };
  
  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deletePaymentReceived(paymentId);
      refreshData();
      showNotification('Payment deleted successfully!', 'success');
    } catch (error: any) {
      showNotification('Failed to delete payment.', 'error');
    }
  };

  const handleSave = async () => {
    if (!dailyRecord || isSaving) return;
    setIsSaving(true);
    try {
      await saveDailyRecord(dailyRecord);
      showNotification('Daily record has been saved successfully!', 'success');
    } catch (error: any) {
      console.error('Error saving Daily Record:', error);
      showNotification(error.message || 'Failed to save the record.', 'error');
    } finally {
      setIsSaving(false);
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
                bankReconciliation={dailyRecord.bankReconciliation}
                onUpdate={handleUpdateReconciliation}
              />
              
              <SaleByVehicle0332
                dayBookRecord={dayBookRecord}
                dailyRecord={dailyRecord}
                accounts={accounts}
                onUpdateBreakdown={handleUpdate0332Breakdown}
              />

              <DayBookSummary 
                dayBookRecord={dayBookRecord} 
              />

              <PaymentsReceived
                payments={dailyRecord.paymentsReceived}
                accounts={accounts}
                onAddPayment={handleAddPayment}
                onUpdatePayment={handleUpdatePayment}
                onDeletePayment={handleDeletePayment}
                date={dailyRecord.date}
              />

              <CashInHandSummary 
                dayBookRecord={dayBookRecord}
                dailyRecord={dailyRecord}
                carryForward={carryForward}
              />

              <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Save size={20} color="#ffffff" />
                )}
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Daily Record'}</Text>
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
  saveButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
