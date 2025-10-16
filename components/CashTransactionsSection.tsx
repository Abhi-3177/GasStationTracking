import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { HandCoins, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { CashTransaction, Account } from '../types/daybook';
import { formatIndianCurrency } from '../utils/formatters';

interface CashTransactionsSectionProps {
  cashTransactions: CashTransaction[];
  accounts: Account[];
  onUpdateCashTransactions: (transactions: CashTransaction[]) => void;
}

export function CashTransactionsSection({ cashTransactions, accounts, onUpdateCashTransactions }: CashTransactionsSectionProps) {
  const handleAddTransaction = () => {
    const newTransaction: CashTransaction = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'in', // Default to 'in'
      comment: '',
    };
    onUpdateCashTransactions([...cashTransactions, newTransaction]);
  };

  const handleUpdateTransaction = (id: string, updates: Partial<CashTransaction>) => {
    const updatedTransactions = cashTransactions.map(trans =>
      trans.id === id ? { ...trans, ...updates } : trans
    );
    onUpdateCashTransactions(updatedTransactions);
  };

  const handleRemoveTransaction = (id: string) => {
    const updatedTransactions = cashTransactions.filter(trans => trans.id !== id);
    onUpdateCashTransactions(updatedTransactions);
  };

  const totalIn = cashTransactions.reduce((total, trans) => total + (trans.type === 'in' ? trans.amount : 0), 0);
  const totalOut = cashTransactions.reduce((total, trans) => total + (trans.type === 'out' ? trans.amount : 0), 0);

  return (
    <Card>
      <View style={styles.header}>
        <HandCoins size={20} color="#059669" />
        <Text style={styles.title}>Cash Transactions</Text>
      </View>
      <Text style={styles.subtitle}>Record cash received from or given to accounts.</Text>
      
      <View style={styles.transactionsContainer}>
        {cashTransactions.map((trans, index) => (
          <View key={trans.id} style={[styles.transactionRow, { zIndex: cashTransactions.length - index }]}>
            <View style={styles.accountInput}>
                <AccountAutocomplete
                    accounts={accounts}
                    value={trans.name}
                    onValueChange={name => handleUpdateTransaction(trans.id, { name, accountId: undefined })}
                    onAccountSelect={account => handleUpdateTransaction(trans.id, { name: account.name, accountId: account.id })}
                    placeholder="Account name..."
                />
            </View>
            <View style={styles.commentInput}>
                <TextInput
                    style={styles.textInput}
                    value={trans.comment || ''}
                    onChangeText={(text) => handleUpdateTransaction(trans.id, { comment: text })}
                    placeholder="Comment (Optional)"
                />
            </View>
            <View style={styles.typeSelector}>
            <TouchableOpacity 
                style={[styles.typeButton, trans.type === 'in' && styles.typeButtonActiveIn]}
                onPress={() => handleUpdateTransaction(trans.id, { type: 'in' })}
            >
                <ArrowDownCircle size={16} color={trans.type === 'in' ? '#fff' : '#059669'} />
                <Text style={[styles.typeButtonText, trans.type === 'in' && styles.typeButtonTextActive]}>In</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.typeButton, trans.type === 'out' && styles.typeButtonActiveOut]}
                onPress={() => handleUpdateTransaction(trans.id, { type: 'out' })}
            >
                <ArrowUpCircle size={16} color={trans.type === 'out' ? '#fff' : '#dc2626'} />
                <Text style={[styles.typeButtonText, trans.type === 'out' && styles.typeButtonTextActive]}>Out</Text>
            </TouchableOpacity>
            </View>
            <View style={styles.transactionAmountInput}>
            <NumberInput
                value={trans.amount}
                onChangeValue={(value) => handleUpdateTransaction(trans.id, { amount: value })}
                placeholder="0.00"
                precision={2}
            />
            </View>
            <TouchableOpacity onPress={() => handleRemoveTransaction(trans.id)} style={styles.removeButton}>
            <Trash2 size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddTransaction} style={styles.standaloneAddButton}>
          <Plus size={16} color="#2563eb" />
          <Text style={styles.standaloneAddButtonText}>Add Cash Transaction</Text>
        </TouchableOpacity>
      </View>
      
      {(totalIn > 0 || totalOut > 0) && (
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Cash In:</Text>
            <Text style={styles.summaryValueIn}>{formatIndianCurrency(totalIn)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Cash Out:</Text>
            <Text style={styles.summaryValueOut}>{formatIndianCurrency(totalOut)}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  transactionsContainer: { gap: 12 },
  transactionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 },
  accountInput: { flex: 2 },
  commentInput: { flex: 2 },
  typeSelector: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#d1d5db' },
  typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12, gap: 4 },
  typeButtonActiveIn: { backgroundColor: '#059669' },
  typeButtonActiveOut: { backgroundColor: '#dc2626' },
  typeButtonText: { fontSize: 12, fontWeight: '600' },
  typeButtonTextActive: { color: '#fff' },
  transactionAmountInput: { flex: 1.5 },
  removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
  textInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#ffffff', color: '#374151' },
  standaloneAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8, marginTop: 8 },
  standaloneAddButtonText: { fontSize: 14, fontWeight: '500', color: '#2563eb' },
  summarySection: { padding: 12, borderRadius: 8, marginTop: 16, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  summaryValueIn: { fontSize: 14, fontWeight: '600', color: '#059669' },
  summaryValueOut: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
});
