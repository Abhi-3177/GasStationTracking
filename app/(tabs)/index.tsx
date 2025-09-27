import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Alert, Platform, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../components/Header';
import { DateSelector } from '../../components/DateSelector';
import { AutoCarryForwardCard } from '../../components/AutoCarryForwardCard';
import { MachineReadings } from '../../components/MachineReadings';
import { SalesSection } from '../../components/SalesSection';
import { DeductionsSection } from '../../components/DeductionsSection';
import { ExpensesSection } from '../../components/ExpensesSection';
import { PaymentSettlement } from '../../components/PaymentSettlement';
import { SummaryCard } from '../../components/SummaryCard';
import { SaveButton } from '../../components/SaveButton';
import { DayBookRecord, MachineReading } from '../../types/daybook';
import { calculateTotals } from '../../utils/calculations';
import { getStorageKey, saveRecord, getRecord, getPreviousRecord } from '../../utils/storage';

const DEFAULT_OPENING_READINGS = {
  petrol: [697397.11, 108734.96, 556516.9, 255356.06],
  diesel: [3616534.92, 6582107.77, 2190335.56, 4041675.08],
};

const createNewRecord = (dateKey: string, previousRecord: DayBookRecord | null): DayBookRecord => ({
  date: dateKey,
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
  deductions: { sviSales: [], sales0332: [], creditSales: [] },
  expenses: { gasCommissions: [], additionalExpenses: [], gasTesting: { petrolTestLitres: 0, dieselTestLitres: 0 } },
  payments: { atmSale: 0, phonePeSale: 0, paytmSale: 0, cashDeposit: 0 },
});

export default function DayBookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [record, setRecord] = useState<DayBookRecord | null>(null);
  const [previousDayMachines, setPreviousDayMachines] = useState<{
    petrol: MachineReading[];
    diesel: MachineReading[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to handle date changes from router params (e.g., from History tab)
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
  
  // Effect to load data whenever the selected date changes
  useEffect(() => {
    loadRecordForDate(selectedDate);
  }, [selectedDate]);

  const loadRecordForDate = async (date: Date) => {
    setIsLoading(true);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    try {
      const existingRecord = await getRecord(dateKey);
      const previousRecord = await getPreviousRecord(dateKey);
      
      if (existingRecord) {
        setRecord(existingRecord);
      } else {
        setRecord(createNewRecord(dateKey, previousRecord));
      }
      setPreviousDayMachines(previousRecord?.machines || null);
    } catch (error) {
      console.error('Error loading record:', error);
      Alert.alert('Error', 'Could not load record for the selected date.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRecord = (updates: Partial<DayBookRecord>) => {
    if (record) {
      setRecord(prev => ({ ...prev!, ...updates }));
    }
  };

  const updateMachineReading = (type: 'petrol' | 'diesel', id: string, updates: Partial<MachineReading>) => {
    if (record) {
      setRecord(prev => ({
        ...prev!,
        machines: {
          ...prev!.machines,
          [type]: prev!.machines[type].map(machine =>
            machine.id === id ? { ...machine, ...updates } : machine
          ),
        },
      }));
    }
  };

  const handleSave = async () => {
    if (!record) return;
    try {
      await saveRecord(record);
      Alert.alert('Success', 'Day book record saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save record. Please try again.');
    }
  };

  if (isLoading || !record) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <Header />
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Record...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const totals = calculateTotals(record);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Header />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <DateSelector 
              selectedDate={selectedDate} 
              onDateChange={setSelectedDate} 
            />
            
            <AutoCarryForwardCard 
              previousMachines={previousDayMachines}
            />

            <MachineReadings 
              machines={record.machines}
              onUpdateMachine={updateMachineReading}
            />

            <SalesSection 
              prices={record.prices}
              totals={totals}
              onUpdatePrices={(prices) => updateRecord({ prices })}
            />

            <DeductionsSection 
              prices={record.prices}
              deductions={record.deductions}
              totals={totals}
              onUpdateDeductions={(deductions) => updateRecord({ deductions })}
            />

            <ExpensesSection 
              expenses={record.expenses}
              prices={record.prices}
              totals={totals}
              onUpdateExpenses={(expenses) => updateRecord({ expenses })}
            />

            <PaymentSettlement 
              payments={record.payments}
              totals={totals}
              onUpdatePayments={(payments) => updateRecord({ payments })}
            />

            <SummaryCard totals={totals} />
            
            <SaveButton onSave={handleSave} />
          </View>
        </ScrollView>
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
  },
});
