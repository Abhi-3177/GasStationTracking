import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calculator, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { DayBookRecord, DailyRecordData } from '../types/daybook';

interface DailyReconciliationProps {
  dayBookRecord: DayBookRecord;
  dailyRecord: DailyRecordData;
  onUpdateDailyRecord: (updates: Partial<DailyRecordData>) => void;
}

export function DailyReconciliation({ dayBookRecord, dailyRecord, onUpdateDailyRecord }: DailyReconciliationProps) {
  const updateBankEntry = (
    type: 'atmSale' | 'phonePeSale' | 'paytmSale' | 'cashDeposit',
    field: 'actual' | 'settled',
    value: number | boolean
  ) => {
    const updatedBankEntries = {
      ...dailyRecord.bankEntries,
      [type]: {
        ...dailyRecord.bankEntries[type],
        [field]: value,
      },
    };
    onUpdateDailyRecord({ bankEntries: updatedBankEntries });
  };

  // Set expected values from Day Book
  React.useEffect(() => {
    // Only proceed if dayBookRecord exists
    if (dayBookRecord) {
      const expectedPayments = dayBookRecord.payments || { atmSale: 0, phonePeSale: 0, paytmSale: 0, cashDeposit: 0 };
      
      const updatedBankEntries = {
        atmSale: { ...dailyRecord.bankEntries.atmSale, expected: expectedPayments.atmSale },
        phonePeSale: { ...dailyRecord.bankEntries.phonePeSale, expected: expectedPayments.phonePeSale },
        paytmSale: { ...dailyRecord.bankEntries.paytmSale, expected: expectedPayments.paytmSale },
        cashDeposit: { ...dailyRecord.bankEntries.cashDeposit, expected: expectedPayments.cashDeposit },
      };

      // Prevent infinite loops by checking if an update is necessary
      if (JSON.stringify(updatedBankEntries) !== JSON.stringify(dailyRecord.bankEntries)) {
        onUpdateDailyRecord({ bankEntries: updatedBankEntries });
      }
    }
  }, [dayBookRecord, dailyRecord.bankEntries, onUpdateDailyRecord]);

  const renderBankEntry = (
    type: 'atmSale' | 'phonePeSale' | 'paytmSale' | 'cashDeposit',
    label: string
  ) => {
    const entry = dailyRecord.bankEntries[type];
    const difference = entry.actual - entry.expected;
    const hasMismatch = Math.abs(difference) > 0.01;

    return (
      <View key={type} style={styles.bankEntryRow}>
        <View style={styles.bankEntryInfo}>
          <Text style={styles.bankEntryLabel}>{label}</Text>
          <Text style={styles.expectedValue}>Expected: ₹{entry.expected.toFixed(2)}</Text>
        </View>
        
        <View style={styles.actualInput}>
          <NumberInput
            value={entry.actual}
            onChangeValue={(value) => updateBankEntry(type, 'actual', value)}
            placeholder="Actual amount"
            precision={2}
          />
        </View>

        <View style={styles.differenceSection}>
          {hasMismatch && (
            <Text style={[styles.differenceText, styles.mismatchText]}>
              Diff: ₹{difference.toFixed(2)}
            </Text>
          )}
          {!hasMismatch && entry.expected > 0 && (
            <Text style={[styles.differenceText, styles.matchText]}>
              ✓ Match
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => updateBankEntry(type, 'settled', !entry.settled)}
          style={[
            styles.settledButton,
            entry.settled && styles.settledButtonActive,
          ]}
        >
          <CheckCircle 
            size={16} 
            color={entry.settled ? '#ffffff' : '#6b7280'} 
          />
          <Text style={[
            styles.settledButtonText,
            entry.settled && styles.settledButtonTextActive,
          ]}>
            {entry.settled ? 'Settled' : 'Pending'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const totalExpected = Object.values(dailyRecord.bankEntries).reduce(
    (sum, entry) => sum + entry.expected, 0
  );
  const totalActual = Object.values(dailyRecord.bankEntries).reduce(
    (sum, entry) => sum + entry.actual, 0
  );
  const totalDifference = totalActual - totalExpected;
  const hasOverallMismatch = Math.abs(totalDifference) > 0.01;

  return (
    <Card>
      <View style={styles.header}>
        <Calculator size={20} color="#2563eb" />
        <Text style={styles.title}>Daily Bank Reconciliation</Text>
      </View>

      <Text style={styles.subtitle}>
        Compare yesterday's Day Book payments with today's settlement records
      </Text>

      <View style={styles.bankEntriesSection}>
        {renderBankEntry('atmSale', 'ATM Sale')}
        {renderBankEntry('phonePeSale', 'PhonePe Sale')}
        {renderBankEntry('paytmSale', 'Paytm Sale')}
        {renderBankEntry('cashDeposit', 'Cash Deposit')}
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Expected:</Text>
          <Text style={styles.summaryValue}>₹{totalExpected.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Actual:</Text>
          <Text style={styles.summaryValue}>₹{totalActual.toFixed(2)}</Text>
        </View>
        <View style={[
          styles.summaryRow,
          styles.totalDifferenceRow,
          hasOverallMismatch && styles.mismatchRow,
        ]}>
          <Text style={styles.totalDifferenceLabel}>
            {hasOverallMismatch && <AlertTriangle size={16} color="#dc2626" />}
            Total Difference:
          </Text>
          <Text style={[
            styles.totalDifferenceValue,
            hasOverallMismatch && styles.mismatchValue,
          ]}>
            ₹{totalDifference.toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  bankEntriesSection: {
    gap: 12,
    marginBottom: 16,
  },
  bankEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  bankEntryInfo: {
    flex: 2,
  },
  bankEntryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  expectedValue: {
    fontSize: 12,
    color: '#6b7280',
  },
  actualInput: {
    flex: 1.5,
  },
  differenceSection: {
    flex: 1,
    alignItems: 'center',
  },
  differenceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mismatchText: {
    color: '#dc2626',
  },
  matchText: {
    color: '#059669',
  },
  settledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  settledButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  settledButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  settledButtonTextActive: {
    color: '#ffffff',
  },
  summarySection: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#0c4a6e',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4a6e',
  },
  totalDifferenceRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#0ea5e9',
    marginTop: 4,
    marginBottom: 0,
  },
  mismatchRow: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
  },
  totalDifferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalDifferenceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  mismatchValue: {
    color: '#dc2626',
  },
});
