import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { DayBookRecord, CalculatedTotals } from '../types/daybook';

interface PaymentSettlementProps {
  payments: DayBookRecord['payments'];
  totals: CalculatedTotals;
  onUpdatePayments: (payments: DayBookRecord['payments']) => void;
}

export function PaymentSettlement({ payments, totals, onUpdatePayments }: PaymentSettlementProps) {
  return (
    <Card>
      <View style={styles.header}>
        <CreditCard size={20} color="#6366f1" />
        <Text style={styles.title}>Payment Settlement</Text>
      </View>
      
      <View style={styles.paymentsGrid}>
        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>ATM Sale</Text>
          <NumberInput
            value={payments.atmSale}
            onChangeValue={(value) => onUpdatePayments({ ...payments, atmSale: value })}
            placeholder="0.000"
            precision={3}
          />
        </View>
        
        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>PhonePe Sale</Text>
          <NumberInput
            value={payments.phonePeSale}
            onChangeValue={(value) => onUpdatePayments({ ...payments, phonePeSale: value })}
            placeholder="0.000"
            precision={3}
          />
        </View>
        
        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>Paytm Sale</Text>
          <NumberInput
            value={payments.paytmSale}
            onChangeValue={(value) => onUpdatePayments({ ...payments, paytmSale: value })}
            placeholder="0.000"
            precision={3}
          />
        </View>
        
        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>Cash Deposit</Text>
          <NumberInput
            value={payments.cashDeposit}
            onChangeValue={(value) => onUpdatePayments({ ...payments, cashDeposit: value })}
            placeholder="0.000"
            precision={3}
          />
        </View>
      </View>
      
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Payments:</Text>
          <Text style={styles.summaryValue}>₹{totals.totalPayments.toFixed(2)}</Text>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  paymentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  paymentInput: {
    flex: 1,
    minWidth: '45%',
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summarySection: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
  },
});
