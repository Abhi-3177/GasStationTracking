import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Banknote, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { ConfirmModal } from './ConfirmModal';
import { NumberInput } from './NumberInput';
import { BankReconciliationEntry } from '../types/daybook';
import { useNotification } from '../context/NotificationContext';
import { formatIndianCurrency } from '../utils/formatters';

interface BankReconciliationProps {
  bankReconciliation: BankReconciliationEntry[];
  onUpdate: (updatedReconciliation: BankReconciliationEntry[]) => Promise<void>;
}

export function BankReconciliation({ bankReconciliation, onUpdate }: BankReconciliationProps) {
  const { showNotification } = useNotification();
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [entryToReset, setEntryToReset] = useState<{ type: BankReconciliationEntry['type']; label: string } | null>(null);

  const handleUpdateActual = (type: BankReconciliationEntry['type'], newActual: number) => {
    const updatedReconciliation = bankReconciliation.map(entry => {
      if (entry.type === type) {
        const difference = newActual - entry.expected;
        const matched = Math.abs(difference) <= 1;
        return { ...entry, actual: newActual, matched };
      }
      return entry;
    });
    onUpdate(updatedReconciliation);
  };

  const handleDeleteEntry = (type: BankReconciliationEntry['type'], label: string) => {
    setEntryToReset({ type, label });
  };
  
  const performReset = async () => {
    if (!entryToReset) return;
    
    const { type, label } = entryToReset;
    setIsResetting(type);
    setEntryToReset(null);

    try {
      const updatedReconciliation = bankReconciliation.map(entry =>
        entry.type === type ? { ...entry, actual: 0, matched: Math.abs(0 - entry.expected) <= 1 } : entry
      );
      await onUpdate(updatedReconciliation);
      showNotification(`${label} amount has been reset.`, 'success');
    } catch (error) {
      showNotification('Failed to reset the entry. Please try again.', 'error');
    } finally {
      setIsResetting(null);
    }
  };

  const renderEntry = (type: BankReconciliationEntry['type'], label: string) => {
    const entry = bankReconciliation.find(e => e.type === type);
    
    if (!entry || (entry.expected === 0 && entry.actual === 0)) {
      return null;
    }

    const difference = entry.actual - entry.expected;
    const isMatched = Math.abs(difference) <= 1 && (entry.expected > 0 || entry.actual > 0);

    return (
      <View key={type} style={styles.entryRow}>
        <Text style={styles.entryLabel}>{label}</Text>
        
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Expected</Text>
          <Text style={styles.amountValue}>
            {entry.expected > 0 ? formatIndianCurrency(entry.expected) : '-'}
          </Text>
        </View>
        
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Actual</Text>
          <View style={styles.actualAmountRow}>
            {entry.actual > 0 ? (
              <Text style={[styles.actualInput, styles.lockedValue]}>
                {formatIndianCurrency(entry.actual)}
              </Text>
            ) : (
              <NumberInput
                value={entry.actual}
                onChangeValue={(value) => handleUpdateActual(type, value)}
                style={styles.actualInput}
                placeholder="0.00"
              />
            )}
            {entry.actual > 0 && (
              <TouchableOpacity
                onPress={() => handleDeleteEntry(type, label)}
                style={styles.deleteButton}
                disabled={isResetting === type}
              >
                {isResetting === type ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <Trash2 size={14} color="#dc2626" />
                )}
              </TouchableOpacity>
            )}
          </View>
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
              <Text style={styles.mismatchText}>{formatIndianCurrency(difference)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const hasEntries = bankReconciliation.some(e => e.expected > 0 || e.actual > 0);

  return (
    <>
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
            {renderEntry('directPnbTransfer', 'Direct PNB Transfer')}
            {renderEntry('cashDeposit', 'Cash Deposit')}
          </View>
        ) : (
          <Text style={styles.noEntriesText}>No bank payments to reconcile from previous day.</Text>
        )}
      </Card>
      {entryToReset &&
        <ConfirmModal
          visible={!!entryToReset}
          title={`Reset ${entryToReset?.label}`}
          message={`Are you sure you want to reset the actual amount for ${entryToReset?.label}? This will set the value to zero and allow manual entry.`}
          onCancel={() => setEntryToReset(null)}
          onConfirm={performReset}
          confirmText="Reset"
          isDestructive={true}
        />
      }
    </>
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
  amountContainer: { flex: 2, alignItems: 'flex-end', gap: 4 },
  amountLabel: { fontSize: 12, color: '#6b7280' },
  amountValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  actualAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actualInput: {
    minWidth: 80,
    textAlign: 'right',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  lockedValue: {
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    fontWeight: '600',
    color: '#374151',
    paddingVertical: 9,
  },
  deleteButton: {
    padding: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flex: 1.5,
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
