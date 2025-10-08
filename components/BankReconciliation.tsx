import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banknote, CheckCircle } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord, BankReconciliationEntry } from '../types/daybook';

interface BankReconciliationProps {
  previousDayRecord: DayBookRecord | null;
  bankReconciliation: BankReconciliationEntry[];
  onUpdate: (updatedReconciliation: BankReconciliationEntry[]) => void;
}

export function BankReconciliation({ previousDayRecord, bankReconciliation, onUpdate }: BankReconciliationProps) {
  const payments = previousDayRecord?.payments || { atmSale: 0, phonePeSale: 0, paytmSale: 0, cashDeposit: 0 };

  const handleToggleMatch = (type: BankReconciliationEntry['type']) => {
    const updated = bankReconciliation.map(entry =>
      entry.type === type ? { ...entry, matched: !entry.matched } : entry
    );
    onUpdate(updated);
  };

  const renderEntry = (type: BankReconciliationEntry['type'], label: string) => {
    const entry = bankReconciliation.find(e => e.type === type);
    if (!entry || entry.expected === 0) return null;

    return (
      <View key={type} style={styles.entryRow}>
        <View style={styles.entryInfo}>
          <Text style={styles.entryLabel}>{label}</Text>
          <Text style={styles.entryAmount}>₹{entry.expected.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.matchButton, entry.matched && styles.matchedButton]}
          onPress={() => handleToggleMatch(type)}
        >
          <CheckCircle size={16} color={entry.matched ? '#ffffff' : '#6b7280'} />
          <Text style={[styles.matchButtonText, entry.matched && styles.matchedButtonText]}>
            {entry.matched ? 'Matched' : 'Match'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const hasEntries = Object.values(payments).some(p => p > 0);

  return (
    <Card>
      <View style={styles.header}>
        <Banknote size={20} color="#059669" />
        <Text style={styles.title}>Bank Reconciliation</Text>
      </View>
      <Text style={styles.subtitle}>Match payments from previous day's Day Book.</Text>
      
      {hasEntries ? (
        <View style={styles.entriesContainer}>
          {renderEntry('atmSale', 'ATM Sale')}
          {renderEntry('phonePeSale', 'PhonePe Sale')}
          {renderEntry('paytmSale', 'Paytm Sale')}
          {renderEntry('cashDeposit', 'Cash Deposit')}
        </View>
      ) : (
        <Text style={styles.noEntriesText}>No bank payments recorded in the previous day's Day Book.</Text>
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
  entryInfo: { flex: 1 },
  entryLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  entryAmount: { fontSize: 14, fontWeight: '600', color: '#065f46' },
  matchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  matchedButton: { backgroundColor: '#059669', borderColor: '#047857' },
  matchButtonText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  matchedButtonText: { color: '#ffffff' },
  noEntriesText: { fontSize: 14, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', paddingVertical: 16 },
});
