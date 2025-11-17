import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Droplets } from 'lucide-react-native';

import { DayRangePicker } from '../../components/DayRangePicker';
import { Card } from '../../components/Card';
import { getDayBookRecordsForDateRange, getDailyRecordsForDateRange } from '../../utils/database';
import { DayBookRecord, DailyRecord } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { formatLitres } from '../../utils/formatters';

interface ReportData {
  openingStock: number;
  totalFilled: number;
  totalSold: number;
  closingStock: number;
  breakdown: {
    date: string;
    filled: number;
    sold: number;
    endOfDayBalance: number;
  }[];
}

export default function Vehicle0332ReportScreen() {
  const { showNotification } = useNotification();
  const [dateRange, setDateRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateReport = useCallback(async () => {
    setIsLoading(true);
    setReportData(null);
    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // 1. Calculate Opening Stock
      const dayBeforeStartDate = format(subDays(dateRange.start, 1), 'yyyy-MM-dd');
      const recordsBefore = await getDayBookRecordsForDateRange('2000-01-01', dayBeforeStartDate);
      const dailyRecordsBefore = await getDailyRecordsForDateRange('2000-01-01', dayBeforeStartDate);
      
      const dailyRecordMapBefore = new Map(dailyRecordsBefore.map(dr => [dr.date, dr]));

      let openingStock = 0;
      recordsBefore.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const record of recordsBefore) {
        const filled = record.deductions.sales0332?.reduce((sum, s) => sum + s.litres, 0) || 0;
        const dailyRecord = dailyRecordMapBefore.get(record.date);
        const sold = dailyRecord?.sales0332Breakdown?.reduce((sum, s) => sum + s.litres, 0) || 0;
        openingStock += filled - sold;
      }

      // 2. Process records within the date range
      const dayBookRecords = await getDayBookRecordsForDateRange(startDate, endDate);
      const dailyRecords = await getDailyRecordsForDateRange(startDate, endDate);
      const dailyRecordMap = new Map(dailyRecords.map(dr => [dr.date, dr]));

      const allDates = new Set<string>();
      dayBookRecords.forEach(r => allDates.add(r.date));
      dailyRecords.forEach(r => allDates.add(r.date));
      
      const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      
      const breakdown: ReportData['breakdown'] = [];
      let runningBalance = openingStock;

      for (const date of sortedDates) {
        const dayBook = dayBookRecords.find(r => r.date === date);
        const dailyRecord = dailyRecordMap.get(date);

        const filled = dayBook?.deductions.sales0332?.reduce((sum, s) => sum + s.litres, 0) || 0;
        const sold = dailyRecord?.sales0332Breakdown?.reduce((sum, s) => sum + s.litres, 0) || 0;
        
        if (filled > 0 || sold > 0) {
            runningBalance += filled - sold;
            breakdown.push({
                date,
                filled,
                sold,
                endOfDayBalance: runningBalance,
            });
        }
      }

      const totalFilled = breakdown.reduce((sum, item) => sum + item.filled, 0);
      const totalSold = breakdown.reduce((sum, item) => sum + item.sold, 0);

      setReportData({
        openingStock,
        totalFilled,
        totalSold,
        closingStock: runningBalance,
        breakdown,
      });

    } catch (error: any) {
      showNotification(`Failed to generate report: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, showNotification]);
  
  const renderBreakdownRow = ({ item }: { item: ReportData['breakdown'][0] }) => (
    <View style={styles.row}>
      <Text style={[styles.cell, { flex: 1.5 }]}>{format(new Date(item.date), 'dd MMM, yyyy')}</Text>
      <Text style={[styles.cell, styles.positive]}>{formatLitres(item.filled)}</Text>
      <Text style={[styles.cell, styles.negative]}>{formatLitres(item.sold)}</Text>
      <Text style={[styles.cell, styles.balance]}>{formatLitres(item.endOfDayBalance)}</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={reportData?.breakdown || []}
          renderItem={renderBreakdownRow}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <Card>
                <Text style={styles.title}>Filters</Text>
                <DayRangePicker range={dateRange} onRangeChange={setDateRange} />
                <TouchableOpacity style={styles.generateButton} onPress={handleGenerateReport} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>Generate Report</Text>}
                </TouchableOpacity>
              </Card>

              {reportData && (
                <>
                  <Card style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Opening Stock</Text>
                      <Text style={styles.summaryValue}>{formatLitres(reportData.openingStock)}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total Filled</Text>
                      <Text style={[styles.summaryValue, styles.positive]}>+ {formatLitres(reportData.totalFilled)}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total Sold</Text>
                      <Text style={[styles.summaryValue, styles.negative]}>- {formatLitres(reportData.totalSold)}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Closing Stock</Text>
                      <Text style={[styles.summaryValue, styles.balance]}>{formatLitres(reportData.closingStock)}</Text>
                    </View>
                  </Card>
                  <View style={[styles.row, styles.headerRow]}>
                    <Text style={[styles.headerText, { flex: 1.5 }]}>Date</Text>
                    <Text style={styles.headerText}>Filled</Text>
                    <Text style={styles.headerText}>Sold</Text>
                    <Text style={styles.headerText}>Balance</Text>
                  </View>
                </>
              )}
            </>
          }
          ListEmptyComponent={
            !isLoading && reportData ? (
              <Card style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No 0332 vehicle activity found for the selected period.</Text>
              </Card>
            ) : null
          }
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  generateButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  generateButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  summaryCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#fefce8' },
  summaryItem: { flex: 1, minWidth: '45%', alignItems: 'center', backgroundColor: '#fffbeb', padding: 12, borderRadius: 8 },
  summaryLabel: { fontSize: 12, color: '#854d0e' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#a16207' },
  headerRow: { backgroundColor: '#f1f5f9' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: 12 },
  headerText: { flex: 1, fontWeight: '600', color: '#475569', textAlign: 'right' },
  cell: { flex: 1, textAlign: 'right' },
  positive: { color: '#059669', fontWeight: '500' },
  negative: { color: '#dc2626', fontWeight: '500' },
  balance: { fontWeight: '700' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
});
