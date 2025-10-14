import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calculator, CheckSquare, Square } from 'lucide-react-native';
import { Card } from './Card';
import { CalculatedTotals } from '../types/daybook';
import { formatIndianCurrency } from '../utils/formatters';

interface SummaryCardProps {
  totals: CalculatedTotals;
  cashCollected: boolean;
  onCashCollectedChange: (value: boolean) => void;
}

export function SummaryCard({ totals, cashCollected, onCashCollectedChange }: SummaryCardProps) {
  const safeTotals = totals || {} as CalculatedTotals;

  return (
    <Card style={styles.summaryCard}>
      <View style={styles.header}>
        <Calculator size={24} color="#059669" />
        <Text style={styles.title}>Daily Summary</Text>
      </View>
      
      <View style={styles.calculationBreakdown}>
        <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Net Sale</Text>
            <Text style={styles.breakdownValue}>{formatIndianCurrency(safeTotals.netSale)}</Text>
        </View>
        <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>- Total Payments</Text>
            <Text style={styles.breakdownValue}>- {formatIndianCurrency(safeTotals.totalPayments)}</Text>
        </View>
        <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>+ Cash In</Text>
            <Text style={styles.breakdownValue}>+ {formatIndianCurrency(safeTotals.totalCashIn)}</Text>
        </View>
        <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>- Cash Out</Text>
            <Text style={styles.breakdownValue}>- {formatIndianCurrency(safeTotals.totalCashOut)}</Text>
        </View>
        <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>+ Cash from Last Day</Text>
            <Text style={styles.breakdownValue}>+ {formatIndianCurrency(safeTotals.previousDayBalance)}</Text>
        </View>
      </View>

      <View style={styles.dayBalanceItem}>
        <Text style={styles.dayBalanceLabel}>Day Balance</Text>
        <Text style={[styles.dayBalanceValue, (safeTotals.dayBalance || 0) < 0 && styles.negativeBalance]}>
          {formatIndianCurrency(safeTotals.dayBalance)}
        </Text>
      </View>

      <TouchableOpacity 
          style={styles.cashCollectedToggle} 
          onPress={() => onCashCollectedChange(!cashCollected)}
      >
          {cashCollected ? <CheckSquare size={20} color="#059669" /> : <Square size={20} color="#6b7280" />}
          <Text style={styles.cashCollectedText}>Day's Cash Collected & Settled</Text>
      </TouchableOpacity>
      
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
  calculationBreakdown: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#374151',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  dayBalanceItem: {
    width: '100%',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#059669',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  dayBalanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
  },
  dayBalanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  negativeBalance: {
    color: '#dc2626',
  },
  cashCollectedToggle: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  cashCollectedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
});
