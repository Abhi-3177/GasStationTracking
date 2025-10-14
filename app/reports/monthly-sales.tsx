import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { MonthPicker } from '../../components/MonthPicker';
import { getRecordsForMonth } from '../../utils/database';
import { calculateTotals } from '../../utils/calculations';
import { DayBookRecord, CalculatedTotals, DailyRecord } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { formatIndianCurrency } from '../../utils/formatters';

interface ReportRow extends CalculatedTotals {
  date: string;
  amountReceived: number;
}

export default function MonthlySalesScreen() {
  const { showNotification } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth(); // 0-indexed
      const records = await getRecordsForMonth(year, month);
      
      const processedData = records.map(record => {
        const dayBookTotals = record.dayBook ? calculateTotals(record.dayBook, null) : {} as CalculatedTotals;
        const amountReceived = record.dailyRecord?.paymentsReceived?.reduce((sum, p) => sum + p.amount, 0) || 0;
        
        return {
          date: record.dayBook.date,
          ...dayBookTotals,
          amountReceived,
        };
      });
      setReportData(processedData);
    } catch (error: any) {
      showNotification(`Error loading report data: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, showNotification]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const renderReportRow = ({ item }: { item: ReportRow }) => {
    const recordDate = new Date(item.date);
    const timezoneOffset = recordDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(recordDate.getTime() + timezoneOffset);

    return (
      <View style={styles.row}>
        <Text style={styles.dateCell}>{format(adjustedDate, 'dd/MM/yyyy')}</Text>
        <Text style={styles.amountCell}>{formatIndianCurrency(item.totalSale)}</Text>
        <Text style={styles.amountCell}>{formatIndianCurrency(item.totalDeductions)}</Text>
        <Text style={styles.amountCell}>{formatIndianCurrency(item.amountReceived)}</Text>
        <Text style={styles.amountCell}>{formatIndianCurrency(item.totalExpenses)}</Text>
        <Text style={[styles.amountCell, styles.netSaleCell, item.netSale < 0 && styles.negativeValue]}>{formatIndianCurrency(item.netSale)}</Text>
      </View>
    );
  };

  const totals = reportData.reduce(
    (acc, row) => {
      acc.totalSale += row.totalSale;
      acc.totalDeductions += row.totalDeductions;
      acc.amountReceived += row.amountReceived;
      acc.totalExpenses += row.totalExpenses;
      acc.netSale += row.netSale;
      return acc;
    },
    { totalSale: 0, totalDeductions: 0, amountReceived: 0, totalExpenses: 0, netSale: 0 }
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <MonthPicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
        
        <View style={styles.tableContainer}>
          <FlatList
            data={reportData}
            renderItem={renderReportRow}
            keyExtractor={(item) => item.date}
            ListHeaderComponent={
              <View style={[styles.row, styles.headerRow]}>
                <Text style={styles.headerText}>Date</Text>
                <Text style={styles.headerText}>Total Sale</Text>
                <Text style={styles.headerText}>Credit</Text>
                <Text style={styles.headerText}>Received</Text>
                <Text style={styles.headerText}>Expenses</Text>
                <Text style={styles.headerText}>Net Sale</Text>
              </View>
            }
            ListFooterComponent={
              <View style={[styles.row, styles.footerRow]}>
                <Text style={styles.footerText}>Month Total</Text>
                <Text style={styles.footerAmount}>{formatIndianCurrency(totals.totalSale)}</Text>
                <Text style={styles.footerAmount}>{formatIndianCurrency(totals.totalDeductions)}</Text>
                <Text style={styles.footerAmount}>{formatIndianCurrency(totals.amountReceived)}</Text>
                <Text style={styles.footerAmount}>{formatIndianCurrency(totals.totalExpenses)}</Text>
                <Text style={[styles.footerAmount, styles.netSaleCell, totals.netSale < 0 && styles.negativeValue]}>{formatIndianCurrency(totals.netSale)}</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No records found for {format(selectedDate, 'MMMM yyyy')}.</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadReportData} />}
          />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  tableContainer: { flex: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerRow: { backgroundColor: '#f1f5f9', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  footerRow: { backgroundColor: '#e0e7ff', borderBottomWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  headerText: { flex: 1, fontWeight: '600', color: '#475569', textAlign: 'right' },
  dateCell: { flex: 1, color: '#374151', textAlign: 'left' },
  amountCell: { flex: 1, color: '#374151', textAlign: 'right', fontWeight: '500' },
  netSaleCell: { fontWeight: '700', color: '#059669' },
  negativeValue: { color: '#dc2626' },
  footerText: { flex: 1, fontWeight: '700', color: '#312e81' },
  footerAmount: { flex: 1, fontWeight: '700', color: '#312e81', textAlign: 'right' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280' },
});
