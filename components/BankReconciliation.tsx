import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Banknote, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord, BankReconciliationEntry } from '../types/daybook';

interface BankReconciliationProps {
  previousDayRecord: DayBookRecord | null;
  bankReconciliation: BankReconciliationEntry[];
  onUpdate: (updatedReconciliation: BankReconciliationEntry[]) => void;
}

export function BankReconciliation({ bankReconciliation }: BankReconciliationProps) {
  const renderEntry = (type: BankReconciliationEntry['type'], label: string) => {
    const entry = bankReconciliation.find(e => e.type === type);
    
    // The core fix: Only hide the row if BOTH expected and actual are zero.
    if (!entry || (entry.expected === 0 && entry.actual === 0)) {
      return null;
    }

    const difference = entry.actual - entry.expected;
    const isMatched = Math.abs(difference) < 0.01 && (entry.expected > 0 || entry.actual > 0);

    return (
      <View key={type} style={styles.entryRow}>
        <Text style={styles.entryLabel}>{label}</Text>
        
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Fetched from previous day book</Text>
          <Text style={styles.amountValue}>
            {entry.expected > 0 ? `₹${entry.expected.toFixed(2)}` : '-'}
          </Text>
        </View>
        
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>fetched from bank statement</Text>
          <Text style={styles.amountValue}>
            {entry.actual > 0 ? `₹${entry.actual.toFixed(2)}` : '-'}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          {isMatched ? (
            <View style={[styles.statusBadge, styles.matchBadge]}>
              <CheckCircle size={14} color="#059669" />
              <Text style={styles.matchText}>Match</Text>
            </View>
          ) : (entry.expected > 0 || entry.actual > 0) ? (
            <View style={[styles.statusBadge, styles.mismatchBadge]}>
              <AlertTriangle size={14} color="#dc2626" />
              <Text style={styles.mismatchText}>₹{difference.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const hasEntries = bankReconciliation.some(e => e.expected > 0 || e.actual > 0);

  return (
    <Card>
      <View style={styles.header}>
        <Banknote size={20} color="#059669" />
        <Text style={styles.title}>Bank Reconciliation</Text>
      </View>
      <Text style={styles.subtitle}>Match payments from previous day's Day Book with settlement files.</Text>
      
      {hasEntries ? (
        <View style={styles.entriesContainer}>
          {renderEntry('atmSale', 'ATM Sale')}
          {renderEntry('phonePeSale', 'PhonePe Sale')}
          {renderEntry('paytmSale', 'Paytm Sale')}
          {renderEntry('cashDeposit', 'Cash Deposit')}
        </View>
      ) : (
        <Text style={styles.noEntriesText}>No bank payments to reconcile.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  entriesContainer: { gap: 8 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  entryLabel: { flex: 1.5, fontSize: 14, fontWeight: '500', color: '#374151' },
  amountContainer: { flex: 2, alignItems: 'flex-end' },
  amountLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  amountValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  statusContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchBadge: {
    backgroundColor: '#ecfdf5',
  },
  mismatchBadge: {
    backgroundColor: '#fef2f2',
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  mismatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  noEntriesText: { fontSize: 14, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', paddingVertical: 16 },
});
