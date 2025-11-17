import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord } from '../types/daybook';
import { calculateTotals } from '../utils/calculations';
import { formatIndianCurrency } from '../utils/formatters';

interface DayBookSummaryProps {
  dayBookRecord: DayBookRecord | null;
}

export function DayBookSummary({ dayBookRecord }: DayBookSummaryProps) {
  if (!dayBookRecord) {
    return (
      <Card>
        <View style={styles.header}>
          <BookOpen size={20} color="#6b7280" />
          <Text style={styles.title}>Day Book Summary</Text>
        </View>
        <Text style={styles.noDataText}>No Day Book record found for today.</Text>
      </Card>
    );
  }
  
  const totals = calculateTotals(dayBookRecord, 0); // Calculate isolated totals

  return (
    <Card>
      <View style={styles.header}>
        <BookOpen size={20} color="#1f2937" />
        <Text style={styles.title}>Today's Day Book Summary</Text>
      </View>
      
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <TrendingUp size={20} color="#059669" />
          <Text style={styles.summaryLabel}>Total Sale</Text>
          <Text style={styles.summaryValue}>{formatIndianCurrency(totals.totalSale)}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <TrendingDown size={20} color="#dc2626" />
          <Text style={styles.summaryLabel}>Total Expenses</Text>
          <Text style={styles.summaryValue}>{formatIndianCurrency(totals.totalExpenses)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  summaryGrid: { flexDirection: 'row', gap: 16 },
  summaryItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  noDataText: { fontSize: 14, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', paddingVertical: 16 },
});
