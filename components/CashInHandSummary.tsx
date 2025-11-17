import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wallet } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord, DailyRecord } from '../types/daybook';
import { calculateTotals } from '../utils/calculations';
import { formatIndianCurrency } from '../utils/formatters';

interface CashInHandSummaryProps {
  dayBookRecord: DayBookRecord | null;
  dailyRecord: DailyRecord | null;
  carryForward: number;
}

export function CashInHandSummary({ dayBookRecord, dailyRecord, carryForward }: CashInHandSummaryProps) {
  if (!dayBookRecord || !dailyRecord) {
    return null; // Don't render if data is not available
  }

  const dayBookTotals = calculateTotals(dayBookRecord, carryForward);
  const totalPaymentsReceived = dailyRecord.paymentsReceived.reduce((sum, p) => sum + p.amount, 0);
  
  const cashInHand = dayBookTotals.dayBalance + totalPaymentsReceived;

  return (
    <Card style={styles.summaryCard}>
      <View style={styles.header}>
        <Wallet size={20} color="#059669" />
        <Text style={styles.title}>Cash In Hand Calculation</Text>
      </View>

      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Day Balance</Text>
        <Text style={styles.calculationValue}>{formatIndianCurrency(dayBookTotals.dayBalance)}</Text>
      </View>

      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>+ Today's Payments Received</Text>
        <Text style={styles.calculationValue}>{formatIndianCurrency(totalPaymentsReceived)}</Text>
      </View>

      <View style={[styles.calculationRow, styles.finalRow]}>
        <Text style={styles.finalLabel}>= Final Cash in Hand</Text>
        <Text style={[styles.finalValue, cashInHand < 0 && styles.negativeValue]}>
          {formatIndianCurrency(cashInHand)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#14532d',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#166534',
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#14532d',
  },
  finalRow: {
    borderTopWidth: 1,
    borderTopColor: '#86efac',
    marginTop: 8,
    paddingTop: 12,
  },
  finalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#14532d',
  },
  finalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  negativeValue: {
    color: '#dc2626',
  },
});
