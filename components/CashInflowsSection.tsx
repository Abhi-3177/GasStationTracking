import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HandCoins, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { CashInflow, Account } from '../types/daybook';

interface CashInflowsSectionProps {
  cashInflows: CashInflow[];
  accounts: Account[];
  onUpdateCashInflows: (inflows: CashInflow[]) => void;
}

export function CashInflowsSection({ cashInflows, accounts, onUpdateCashInflows }: CashInflowsSectionProps) {
  const handleAddInflow = () => {
    const newInflow: CashInflow = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
    };
    onUpdateCashInflows([...cashInflows, newInflow]);
  };

  const handleUpdateInflow = (id: string, updates: Partial<CashInflow>) => {
    const updatedInflows = cashInflows.map(inflow =>
      inflow.id === id ? { ...inflow, ...updates } : inflow
    );
    onUpdateCashInflows(updatedInflows);
  };

  const handleRemoveInflow = (id: string) => {
    const updatedInflows = cashInflows.filter(inflow => inflow.id !== id);
    onUpdateCashInflows(updatedInflows);
  };

  const totalInflows = cashInflows.reduce((total, inflow) => total + inflow.amount, 0);

  return (
    <Card>
      <View style={styles.header}>
        <HandCoins size={20} color="#059669" />
        <Text style={styles.title}>Cash Inflows</Text>
      </View>
      <Text style={styles.subtitle}>Record cash received from factories or transporters.</Text>
      
      <View style={styles.inflowsContainer}>
        {cashInflows.map(inflow => (
          <View key={inflow.id} style={styles.inflowRow}>
            <View style={styles.inflowNameInput}>
              <AccountAutocomplete
                accounts={accounts}
                value={inflow.name}
                onValueChange={name => handleUpdateInflow(inflow.id, { name, accountId: undefined })}
                onAccountSelect={account => handleUpdateInflow(inflow.id, { name: account.name, accountId: account.id })}
                placeholder="Received from..."
              />
            </View>
            <View style={styles.inflowAmountInput}>
              <NumberInput
                value={inflow.amount}
                onChangeValue={(value) => handleUpdateInflow(inflow.id, { amount: value })}
                placeholder="0.00"
                precision={2}
              />
            </View>
            <TouchableOpacity onPress={() => handleRemoveInflow(inflow.id)} style={styles.removeButton}>
              <Trash2 size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddInflow} style={styles.standaloneAddButton}>
          <Plus size={16} color="#2563eb" />
          <Text style={styles.standaloneAddButtonText}>Add Cash Inflow</Text>
        </TouchableOpacity>
      </View>
      
      {totalInflows > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Total Cash Inflows:</Text>
          <Text style={styles.summaryValue}>₹{totalInflows.toFixed(2)}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 16,
  },
  inflowsContainer: {
    gap: 8,
  },
  inflowRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inflowNameInput: {
    flex: 2,
  },
  inflowAmountInput: {
    flex: 1,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  standaloneAddButton: {
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
  standaloneAddButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#059669',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
});
