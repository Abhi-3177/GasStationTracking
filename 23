import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calculator } from 'lucide-react-native';
import { Card } from './Card';
import { CalculatedTotals } from '../types/daybook';

interface SummaryCardProps {
  totals: CalculatedTotals;
}

export function SummaryCard({ totals }: SummaryCardProps) {
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.header}>
        <Calculator size={24} color="#059669" />
        <Text style={styles.title}>Daily Summary</Text>
      </View>
      
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Petrol Litres</Text>
          <Text style={styles.summaryValue}>{totals.petrolLitres.toFixed(2)} L</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Diesel Litres</Text>
          <Text style={styles.summaryValue}>{totals.dieselLitres.toFixed(2)} L</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Sale</Text>
          <Text style={styles.summaryValue}>₹{totals.totalSale.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Cash Sale</Text>
          <Text style={styles.summaryValue}>₹{totals.cashSale.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net Sale</Text>
          <Text style={styles.summaryValue}>₹{totals.netSale.toFixed(2)}</Text>
        </View>
        
        <View style={[styles.summaryItem, styles.dayBalanceItem]}>
          <Text style={styles.dayBalanceLabel}>Day Balance</Text>
          <Text style={[styles.dayBalanceValue, totals.dayBalance < 0 && styles.negativeBalance]}>
            ₹{totals.dayBalance.toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#059669',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  dayBalanceItem: {
    width: '100%',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#059669',
  },
  dayBalanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 8,
  },
  dayBalanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  negativeBalance: {
    color: '#dc2626',
  },
});
