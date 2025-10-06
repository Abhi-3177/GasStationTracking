import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { Calendar, AlertTriangle, CheckCircle, Plus } from 'lucide-react-native';

import { DateSelector } from '../../components/DateSelector';
import { Card } from '../../components/Card';
import { DailyReconciliation } from '../../components/DailyReconciliation';
import { CreditSalesRecord } from '../../components/CreditSalesRecord';
import { CommissionPaidRecord } from '../../components/CommissionPaidRecord';
import { ExpensesRecord } from '../../components/ExpensesRecord';
import { CashInHandRecord } from '../../components/CashInHandRecord';
import { SaleByVehicle0332 } from '../../components/SaleByVehicle0332';
import { ReconciliationSummary } from '../../components/ReconciliationSummary';

import { DayBookRecord, DailyRecordData, Account } from '../../types/daybook';
import { getRecord, getDailyRecord, saveDailyRecord, getAllAccounts } from '../../utils/database';

export default function DailyRecordScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayBookRecord, setDayBookRecord] = useState<DayBookRecord | null>(null);
  const [dailyRecord, setDailyRecord] = useState<DailyRecordData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate])
  );

  const loadData = async () => {
    setIsLoading(true);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const [dayBook, daily, accountsList] = await Promise.all([
        getRecord(dateKey),
        getDailyRecord(dateKey),
        getAllAccounts()
      ]);
      
      setDayBookRecord(dayBook);
      setDailyRecord(daily || createEmptyDailyRecord(dateKey));
      setAccounts(accountsList);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load daily record data.');
    } finally {
      setIsLoading(false);
    }
  };

  const createEmptyDailyRecord = (date: string): DailyRecordData => ({
    date,
    bankEntries: {
      atmSale: { expected: 0, actual: 0, settled: false },
      phonePeSale: { expected: 0, actual: 0, settled: false },
      paytmSale: { expected: 0, actual: 0, settled: false },
      cashDeposit: { expected: 0, actual: 0, settled: false },
    },
    creditSales: [],
    commissionPaid: [],
    expenses: [],
    cashInHand: [],
    saleByVehicle0332: [],
  });

  const handleUpdateDailyRecord = async (updates: Partial<DailyRecordData>) => {
    if (dailyRecord) {
      const updatedRecord = { ...dailyRecord, ...updates };
      setDailyRecord(updatedRecord);
      try {
        await saveDailyRecord(updatedRecord);
      } catch (error) {
        Alert.alert('Sync Error', 'Failed to save updates to the database.');
      }
    }
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading Data...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <DateSelector 
              selectedDate={selectedDate} 
              onDateChange={setSelectedDate} 
            />

            {!dayBookRecord && (
              <Card style={styles.warningCard}>
                <View style={styles.warningContent}>
                  <AlertTriangle size={20} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    No Day Book record found for {format(selectedDate, 'PPP')}. 
                    Please complete the Day Book entry first.
                  </Text>
                </View>
              </Card>
            )}

            {dayBookRecord && dailyRecord && (
              <>
                <DailyReconciliation
                  dayBookRecord={dayBookRecord}
                  dailyRecord={dailyRecord}
                  onUpdateDailyRecord={handleUpdateDailyRecord}
                />

                <CreditSalesRecord
                  dayBookRecord={dayBookRecord}
                  dailyRecord={dailyRecord}
                  accounts={accounts}
                  onUpdateDailyRecord={handleUpdateDailyRecord}
                />

                <CommissionPaidRecord
                  dailyRecord={dailyRecord}
                  onUpdateDailyRecord={handleUpdateDailyRecord}
                />

                <ExpensesRecord
                  dailyRecord={dailyRecord}
                  onUpdateDailyRecord={handleUpdateDailyRecord}
                />

                <CashInHandRecord
                  dailyRecord={dailyRecord}
                  accounts={accounts}
                  onUpdateDailyRecord={handleUpdateDailyRecord}
                />

                <SaleByVehicle0332
                  dayBookRecord={dayBookRecord}
                  dailyRecord={dailyRecord}
                  accounts={accounts}
                  onUpdateDailyRecord={handleUpdateDailyRecord}
                />

                <ReconciliationSummary
                  dayBookRecord={dayBookRecord}
                  dailyRecord={dailyRecord}
                />
              </>
            )}
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
    marginTop: 10,
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
});
