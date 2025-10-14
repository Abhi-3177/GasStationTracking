import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, Alert, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { DateSelector } from '../../components/DateSelector';
import { AutoCarryForwardCard } from '../../components/AutoCarryForwardCard';
import { MachineReadings } from '../../components/MachineReadings';
import { SalesSection } from '../../components/SalesSection';
import { OtherSalesSection } from '../../components/OtherSalesSection';
import { CashTransactionsSection } from '../../components/CashTransactionsSection';
import { DeductionsSection } from '../../components/DeductionsSection';
import { ExpensesSection } from '../../components/ExpensesSection';
import { PaymentSettlement } from '../../components/PaymentSettlement';
import { SummaryCard } from '../../components/SummaryCard';
import { SaveButton } from '../../components/SaveButton';

import { DayBookRecord, MachineReading, Account, OtherSale, CashTransaction } from '../../types/daybook';
import { calculateTotals } from '../../utils/calculations';
import { saveRecord, getRecord, getPreviousRecord, getAllAccounts } from '../../utils/database';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const DEFAULT_OPENING_READINGS = {
  petrol: [697397.11, 108734.96, 556516.9, 255356.06],
  diesel: [3616534.92, 6582107.77, 2190335.56, 4041675.08],
};

const createNewRecord = (dateKey: string, previousRecord: DayBookRecord | null): DayBookRecord => ({
  date: dateKey,
  cashCollected: false,
  machines: {
    petrol: DEFAULT_OPENING_READINGS.petrol.map((defaultReading, index) => ({
      id: `P${index + 1}`,
      name: `Petrol ${index + 1}`,
      openingReading: previousRecord?.machines.petrol.find(p => p.id === `P${index + 1}`)?.closingReading || defaultReading,
      closingReading: 0,
    })),
    diesel: DEFAULT_OPENING_READINGS.diesel.map((defaultReading, index) => ({
      id: `D${index + 1}`,
      name: `Diesel ${index + 1}`,
      openingReading: previousRecord?.machines.diesel.find(d => d.id === `D${index + 1}`)?.closingReading || defaultReading,
      closingReading: 0,
    })),
  },
  prices: { petrol: 0, diesel: 0 },
  otherSales: [],
  cashTransactions: [],
  deductions: { sviSales: [], sales0332: [], creditSales: [] },
  expenses: { gasCommissions: [], additionalExpenses: [], gasTesting: { petrolTestLitres: 10, dieselTestLitres: 20 } },
  payments: { atmSale: 0, phonePeSale: 0, paytmSale: 0, cashDeposits: [] },
});

const normalizeRecord = (loadedRecord: Partial<DayBookRecord>, defaultRecord: DayBookRecord): DayBookRecord => {
  const normalized = {
    ...defaultRecord,
    ...loadedRecord,
    cashCollected: loadedRecord.cashCollected ?? defaultRecord.cashCollected,
    machines: {
      petrol: defaultRecord.machines.petrol.map(defaultMachine => {
        const loadedMachine = loadedRecord.machines?.petrol.find(m => m.id === defaultMachine.id);
        // DEFINITIVE FIX: Ensure the carried-over openingReading is always prioritized.
        return { 
          ...defaultMachine, 
          ...loadedMachine,
          openingReading: defaultMachine.openingReading 
        };
      }),
      diesel: defaultRecord.machines.diesel.map(defaultMachine => {
        const loadedMachine = loadedRecord.machines?.diesel.find(m => m.id === defaultMachine.id);
        // DEFINITIVE FIX: Ensure the carried-over openingReading is always prioritized.
        return { 
            ...defaultMachine, 
            ...loadedMachine,
            openingReading: defaultMachine.openingReading 
        };
      }),
    },
    prices: { ...defaultRecord.prices, ...loadedRecord.prices },
    otherSales: loadedRecord.otherSales || defaultRecord.otherSales,
    cashTransactions: loadedRecord.cashTransactions || defaultRecord.cashTransactions,
    deductions: { ...defaultRecord.deductions, ...loadedRecord.deductions },
    expenses: { 
      ...defaultRecord.expenses, 
      ...loadedRecord.expenses,
      gasTesting: { ...defaultRecord.expenses.gasTesting, ...loadedRecord.expenses?.gasTesting },
    },
    payments: {
        atmSale: loadedRecord.payments?.atmSale ?? defaultRecord.payments.atmSale,
        phonePeSale: loadedRecord.payments?.phonePeSale ?? defaultRecord.payments.phonePeSale,
        paytmSale: loadedRecord.payments?.paytmSale ?? defaultRecord.payments.paytmSale,
        cashDeposits: loadedRecord.payments?.cashDeposits ?? [],
    },
  };
  return normalized;
};

export default function DayBookScreen() {
  const { user } = useAuth();
  const { dataVersion } = useData();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [record, setRecord] = useState<DayBookRecord | null>(null);
  const [previousRecord, setPreviousRecord] = useState<DayBookRecord | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.date && typeof params.date === 'string') {
      const newSelectedDate = new Date(params.date);
      const timezoneOffset = newSelectedDate.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(newSelectedDate.getTime() + timezoneOffset);

      if (format(adjustedDate, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) {
        setSelectedDate(adjustedDate);
      }
      
      router.setParams({ date: undefined });
    }
  }, [params.date]);
  
  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const [existingRecord, prevRecord, allAccounts] = await Promise.all([
        getRecord(dateKey),
        getPreviousRecord(dateKey),
        getAllAccounts(),
      ]);
      
      const defaultRecord = createNewRecord(dateKey, prevRecord);
      
      if (existingRecord) {
        const normalized = normalizeRecord(existingRecord, defaultRecord);
        setRecord(normalized);
      } else {
        setRecord(defaultRecord);
      }
      
      setPreviousRecord(prevRecord);
      setAccounts(allAccounts);
    } catch (error: any) {
      console.error('Error loading Day Book data:', error);
      Alert.alert('Loading Error', error.message || 'Could not load data for the selected date.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData, dataVersion]);

  const updateRecord = (updates: Partial<DayBookRecord>) => {
    setRecord(prev => (prev ? { ...prev, ...updates } : null));
  };

  const updateMachineReading = (type: 'petrol' | 'diesel', id: string, updates: Partial<MachineReading>) => {
    setRecord(prev => {
      if (!prev) return null;
      return {
        ...prev,
        machines: {
          ...prev.machines,
          [type]: prev.machines[type].map(machine =>
            machine.id === id ? { ...machine, ...updates } : machine
          ),
        },
      };
    });
  };

  const handleUpdateOtherSales = (otherSales: OtherSale[]) => {
    updateRecord({ otherSales });
  };

  const handleUpdateCashTransactions = (cashTransactions: CashTransaction[]) => {
    updateRecord({ cashTransactions });
  };

  const handleSave = async () => {
    if (!record) return;
    try {
      await saveRecord(record);
      Alert.alert('Success', 'Day book record has been saved successfully!');
    } catch (error: any) {
      console.error('Error saving Day Book record:', error);
      Alert.alert('Save Error', error.message || 'Failed to save the record. Please try again.');
    }
  };

  if (isLoading || !record) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading Day Book...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const totals = calculateTotals(record, previousRecord);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ErrorBoundary>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <DateSelector 
                selectedDate={selectedDate} 
                onDateChange={setSelectedDate} 
              />
              
              <AutoCarryForwardCard 
                previousMachines={previousRecord?.machines || null}
              />

              <MachineReadings 
                machines={record.machines}
                onUpdateMachine={updateMachineReading}
                isOpeningEditable={!previousRecord}
              />

              <SalesSection 
                prices={record.prices}
                totals={totals}
                onUpdatePrices={(prices) => updateRecord({ prices })}
              />

              <OtherSalesSection
                otherSales={record.otherSales}
                onUpdateOtherSales={handleUpdateOtherSales}
              />

              <DeductionsSection 
                prices={record.prices}
                deductions={record.deductions}
                totals={totals}
                accounts={accounts}
                onUpdateDeductions={(deductions) => updateRecord({ deductions })}
              />

              <ExpensesSection 
                expenses={record.expenses}
                prices={record.prices}
                totals={totals}
                onUpdateExpenses={(expenses) => updateRecord({ expenses })}
              />

              <CashTransactionsSection
                cashTransactions={record.cashTransactions}
                accounts={accounts}
                onUpdateCashTransactions={handleUpdateCashTransactions}
              />

              <PaymentSettlement 
                payments={record.payments}
                totals={totals}
                onUpdatePayments={(payments) => updateRecord({ payments })}
              />

              <SummaryCard 
                totals={totals}
                cashCollected={record.cashCollected || false}
                onCashCollectedChange={(value) => updateRecord({ cashCollected: value })}
              />
              
              <SaveButton onSave={handleSave} />
            </View>
          </ScrollView>
        </ErrorBoundary>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 10,
  },
});
