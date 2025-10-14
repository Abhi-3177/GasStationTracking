import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown, Percent } from 'lucide-react-native';
import { format, startOfMonth } from 'date-fns';

import { Card } from './Card';
import { MonthPicker } from './MonthPicker';
import { NumberInput } from './NumberInput';
import { getAccountSalesFluctuation } from '../utils/database';
import { useNotification } from '../context/NotificationContext';

interface FluctuationData {
  account_id: string;
  account_name: string;
  account_type: string;
  previous_month_litres: number;
  current_month_litres: number;
  percentage_change: number;
}

export function AccountFluctuationReport() {
  const { showNotification } = useNotification();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [threshold, setThreshold] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<FluctuationData[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setHasGenerated(true);
    try {
      const monthStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const data = await getAccountSalesFluctuation(monthStart, threshold);
      setReportData(data);
    } catch (error: any) {
      showNotification(`Error generating report: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, threshold, showNotification]);

  const increasedSales = reportData.filter(d => d.percentage_change > 0).sort((a, b) => b.percentage_change - a.percentage_change);
  const decreasedSales = reportData.filter(d => d.percentage_change < 0).sort((a, b) => a.percentage_change - b.percentage_change);

  const renderItem = ({ item }: { item: FluctuationData }) => (
    <View style={styles.row}>
      <View style={styles.accountCell}>
        <Text style={styles.accountName}>{item.account_name}</Text>
        <Text style={styles.litresText}>
          {item.previous_month_litres.toFixed(0)}L → {item.current_month_litres.toFixed(0)}L
        </Text>
      </View>
      <Text style={[styles.percentText, item.percentage_change > 0 ? styles.increaseText : styles.decreaseText]}>
        {item.percentage_change > 0 ? '+' : ''}{item.percentage_change.toFixed(1)}%
      </Text>
    </View>
  );

  return (
    <Card>
      <View style={styles.header}>
        <Percent size={20} color="#1f2937" />
        <Text style={styles.title}>Customer Sales Fluctuation</Text>
      </View>
      <Text style={styles.subtitle}>Identify accounts with significant changes in monthly fuel purchase.</Text>
      
      <View style={styles.filterRow}>
        <View style={styles.filterGroup}>
            <Text style={styles.label}>Month to Analyze</Text>
            <MonthPicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </View>
        <View style={styles.filterGroup}>
            <Text style={styles.label}>Threshold (%)</Text>
            <NumberInput value={threshold} onChangeValue={setThreshold} precision={0} />
        </View>
      </View>

      <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>Analyze Fluctuations</Text>}
      </TouchableOpacity>

      {hasGenerated && !isLoading && (
        <View style={styles.resultsContainer}>
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
                <TrendingUp size={18} color="#059669" />
                <Text style={styles.listTitle}>Sales Increase</Text>
            </View>
            <FlatList
              data={increasedSales}
              renderItem={renderItem}
              keyExtractor={item => item.account_id}
              ListEmptyComponent={<Text style={styles.noDataText}>No accounts found.</Text>}
            />
          </View>
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
                <TrendingDown size={18} color="#dc2626" />
                <Text style={styles.listTitle}>Sales Decrease</Text>
            </View>
            <FlatList
              data={decreasedSales}
              renderItem={renderItem}
              keyExtractor={item => item.account_id}
              ListEmptyComponent={<Text style={styles.noDataText}>No accounts found.</Text>}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  filterGroup: { flex: 1 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  generateButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  generateButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  resultsContainer: { flexDirection: 'row', gap: 16, marginTop: 16 },
  listContainer: { flex: 1, gap: 8 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  listTitle: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f9fafb', borderRadius: 6, marginBottom: 6 },
  accountCell: { flex: 1 },
  accountName: { fontSize: 14, fontWeight: '500' },
  litresText: { fontSize: 12, color: '#6b7280' },
  percentText: { fontSize: 14, fontWeight: '700' },
  increaseText: { color: '#059669' },
  decreaseText: { color: '#dc2626' },
  noDataText: { textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', paddingVertical: 10 },
});
