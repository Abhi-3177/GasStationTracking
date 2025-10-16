import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { CreditCard, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { DayBookRecord, CalculatedTotals, CashDepositEntry } from '../types/daybook';
import { formatIndianCurrency } from '../utils/formatters';

interface PaymentSettlementProps {
  payments: DayBookRecord['payments'];
  totals: CalculatedTotals;
  onUpdatePayments: (payments: DayBookRecord['payments']) => void;
}

export function PaymentSettlement({ payments, totals, onUpdatePayments }: PaymentSettlementProps) {
  
  const handleAddDeposit = () => {
    const newDeposit: CashDepositEntry = {
      id: Date.now().toString(),
      amount: 0,
      description: '',
    };
    onUpdatePayments({ ...payments, cashDeposits: [...payments.cashDeposits, newDeposit] });
  };

  const handleUpdateDeposit = (id: string, updates: Partial<CashDepositEntry>) => {
    const updatedDeposits = payments.cashDeposits.map(deposit =>
      deposit.id === id ? { ...deposit, ...updates } : deposit
    );
    onUpdatePayments({ ...payments, cashDeposits: updatedDeposits });
  };

  const handleRemoveDeposit = (id: string) => {
    const updatedDeposits = payments.cashDeposits.filter(deposit => deposit.id !== id);
    onUpdatePayments({ ...payments, cashDeposits: updatedDeposits });
  };

  const totalCashDeposits = payments.cashDeposits.reduce((total, entry) => total + entry.amount, 0);

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
            placeholder="0.00"
            precision={2}
          />
        </View>
        
        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>PhonePe Sale</Text>
          <NumberInput
            value={payments.phonePeSale}
            onChangeValue={(value) => onUpdatePayments({ ...payments, phonePeSale: value })}
            placeholder="0.00"
            precision={2}
          />
        </View>
        
        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>Paytm Sale</Text>
          <NumberInput
            value={payments.paytmSale}
            onChangeValue={(value) => onUpdatePayments({ ...payments, paytmSale: value })}
            placeholder="0.00"
            precision={2}
          />
        </View>

        <View style={styles.paymentInput}>
          <Text style={styles.inputLabel}>Direct PNB Transfer</Text>
          <NumberInput
            value={payments.directPnbTransfer}
            onChangeValue={(value) => onUpdatePayments({ ...payments, directPnbTransfer: value })}
            placeholder="0.00"
            precision={2}
          />
        </View>
      </View>

      <View style={styles.depositsSection}>
        <Text style={styles.sectionTitle}>Cash Deposits</Text>
        {payments.cashDeposits.map(deposit => (
          <View key={deposit.id} style={styles.depositRow}>
            <View style={styles.depositDescriptionInput}>
              <TextInput
                style={styles.textInput}
                value={deposit.description}
                onChangeText={(text) => handleUpdateDeposit(deposit.id, { description: text })}
                placeholder="Optional description"
              />
            </View>
            <View style={styles.depositAmountInput}>
              <NumberInput
                value={deposit.amount}
                onChangeValue={(value) => handleUpdateDeposit(deposit.id, { amount: value })}
                placeholder="0.00"
                precision={2}
              />
            </View>
            <TouchableOpacity onPress={() => handleRemoveDeposit(deposit.id)} style={styles.removeButton}>
              <Trash2 size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddDeposit} style={styles.addButton}>
          <Plus size={16} color="#2563eb" />
          <Text style={styles.addButtonText}>Add Cash Deposit</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Cash Deposits:</Text>
          <Text style={styles.summaryValue}>{formatIndianCurrency(totalCashDeposits)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Payments:</Text>
          <Text style={styles.totalValue}>{formatIndianCurrency(totals.totalPayments)}</Text>
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
    minWidth: '45%', // Ensure 2 items per row
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  depositsSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  depositRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  depositDescriptionInput: {
    flex: 2,
  },
  depositAmountInput: {
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
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
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  totalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
  },
});
