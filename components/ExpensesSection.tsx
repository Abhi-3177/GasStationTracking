import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { TrendingDown, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { DayBookRecord, CalculatedTotals, GasCommission, AdditionalExpense } from '../types/daybook';
import { formatIndianCurrency } from '../utils/formatters';

interface ExpensesSectionProps {
  expenses: DayBookRecord['expenses'];
  prices: DayBookRecord['prices'];
  totals: CalculatedTotals;
  onUpdateExpenses: (expenses: DayBookRecord['expenses']) => void;
}

const ExpenseEntry = ({
  item,
  updateFn,
  addFn,
  removeFn,
  placeholder,
}: {
  item: GasCommission | AdditionalExpense;
  updateFn: (id: string, updates: any) => void;
  addFn: () => void;
  removeFn: (id: string) => void;
  placeholder: string;
}) => (
  <View key={item.id} style={styles.commissionRow}>
    <View style={styles.commissionNameInput}>
      <TextInput
        style={styles.textInput}
        value={item.name}
        onChangeText={(text) => updateFn(item.id, { name: text })}
        placeholder={placeholder}
      />
    </View>
    <View style={styles.commissionAmountInput}>
      <NumberInput
        value={item.amount}
        onChangeValue={(value) => updateFn(item.id, { amount: value })}
        placeholder="0.000"
        precision={3}
      />
    </View>
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity onPress={() => removeFn(item.id)} style={styles.removeButton}>
        <Trash2 size={16} color="#dc2626" />
      </TouchableOpacity>
      <TouchableOpacity onPress={addFn} style={styles.addButtonRow}>
        <Plus size={16} color="#059669" />
      </TouchableOpacity>
    </View>
  </View>
);

export function ExpensesSection({ expenses, prices, totals, onUpdateExpenses }: ExpensesSectionProps) {
  // Gas Commission functions
  const addGasCommission = () => {
    const newCommission: GasCommission = { id: Date.now().toString(), name: '', amount: 0 };
    onUpdateExpenses({ ...expenses, gasCommissions: [...expenses.gasCommissions, newCommission] });
  };
  const updateGasCommission = (id: string, updates: Partial<GasCommission>) => {
    onUpdateExpenses({ ...expenses, gasCommissions: expenses.gasCommissions.map(c => c.id === id ? { ...c, ...updates } : c) });
  };
  const removeGasCommission = (id: string) => {
    onUpdateExpenses({ ...expenses, gasCommissions: expenses.gasCommissions.filter(c => c.id !== id) });
  };

  // Additional Expense functions
  const addAdditionalExpense = () => {
    const newExpense: AdditionalExpense = { id: Date.now().toString(), name: '', amount: 0 };
    onUpdateExpenses({ ...expenses, additionalExpenses: [...expenses.additionalExpenses, newExpense] });
  };
  const updateAdditionalExpense = (id: string, updates: Partial<AdditionalExpense>) => {
    onUpdateExpenses({ ...expenses, additionalExpenses: expenses.additionalExpenses.map(e => e.id === id ? { ...e, ...updates } : e) });
  };
  const removeAdditionalExpense = (id: string) => {
    onUpdateExpenses({ ...expenses, additionalExpenses: expenses.additionalExpenses.filter(e => e.id !== id) });
  };

  const totalGasCommissions = expenses.gasCommissions.reduce((total, c) => total + c.amount, 0);
  const totalAdditionalExpenses = expenses.additionalExpenses.reduce((total, e) => total + e.amount, 0);

  return (
    <Card>
      <View style={styles.header}>
        <TrendingDown size={20} color="#ea580c" />
        <Text style={styles.title}>Expenses</Text>
      </View>
      
      <ExpenseGroup title="Gas Commission" total={totalGasCommissions}>
        {expenses.gasCommissions.map(c => (
          <ExpenseEntry key={c.id} item={c} updateFn={updateGasCommission} addFn={addGasCommission} removeFn={removeGasCommission} placeholder="Commission description" />
        ))}
        {expenses.gasCommissions.length === 0 && (
          <TouchableOpacity onPress={addGasCommission} style={styles.standaloneAddButton}>
            <Plus size={16} color="#2563eb" />
            <Text style={styles.standaloneAddButtonText}>Add Gas Commission</Text>
          </TouchableOpacity>
        )}
      </ExpenseGroup>
      
      <ExpenseGroup title="Additional Expenses" total={totalAdditionalExpenses}>
        {expenses.additionalExpenses.map(e => (
          <ExpenseEntry key={e.id} item={e} updateFn={updateAdditionalExpense} addFn={addAdditionalExpense} removeFn={removeAdditionalExpense} placeholder="Expense description" />
        ))}
        {expenses.additionalExpenses.length === 0 && (
          <TouchableOpacity onPress={addAdditionalExpense} style={styles.standaloneAddButton}>
            <Plus size={16} color="#2563eb" />
            <Text style={styles.standaloneAddButtonText}>Add Additional Expense</Text>
          </TouchableOpacity>
        )}
      </ExpenseGroup>
      
      <View style={styles.gasTestingSection}>
        <Text style={styles.sectionTitle}>Gas Testing</Text>
        <View style={styles.testingRow}>
          <View style={styles.testingInput}><Text style={styles.inputLabel}>Petrol Test (L)</Text><NumberInput value={expenses.gasTesting.petrolTestLitres} onChangeValue={v => onUpdateExpenses({ ...expenses, gasTesting: { ...expenses.gasTesting, petrolTestLitres: v } })} placeholder="0.00" precision={2} /></View>
          <View style={styles.testingInput}><Text style={styles.inputLabel}>Diesel Test (L)</Text><NumberInput value={expenses.gasTesting.dieselTestLitres} onChangeValue={v => onUpdateExpenses({ ...expenses, gasTesting: { ...expenses.gasTesting, dieselTestLitres: v } })} placeholder="0.00" precision={2} /></View>
        </View>
        <View style={styles.testingCalculation}>
          <Text style={styles.calculationText}>({expenses.gasTesting.petrolTestLitres.toFixed(2)} × {formatIndianCurrency(prices.petrol)}) + ({expenses.gasTesting.dieselTestLitres.toFixed(2)} × {formatIndianCurrency(prices.diesel)})</Text>
          <Text style={styles.calculationResult}>= {formatIndianCurrency(totals.gasTestingExpense)}</Text>
        </View>
      </View>
      
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Gas Commission:</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totalGasCommissions)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Additional Expenses:</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totalAdditionalExpenses)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Gas Testing Expense:</Text><Text style={styles.summaryValue}>{formatIndianCurrency(totals.gasTestingExpense)}</Text></View>
        <View style={[styles.summaryRow, styles.totalRow]}><Text style={styles.totalLabel}>Total Expenses:</Text><Text style={styles.totalValue}>{formatIndianCurrency(totals.totalExpenses)}</Text></View>
        <View style={[styles.summaryRow, styles.netSaleRow]}><Text style={styles.netSaleLabel}>Net Sale:</Text><Text style={styles.netSaleValue}>{formatIndianCurrency(totals.netSale)}</Text></View>
      </View>
    </Card>
  );
}

const ExpenseGroup = ({ title, total, children }: { title: string, total: number, children: React.ReactNode }) => (
  <View style={styles.commissionSection}>
    <View style={styles.commissionHeader}><Text style={styles.sectionTitle}>{title}</Text></View>
    {children}
    {total > 0 && <View style={styles.commissionTotal}><Text style={styles.commissionTotalLabel}>Total:</Text><Text style={styles.commissionTotalValue}>{formatIndianCurrency(total)}</Text></View>}
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  commissionSection: { marginBottom: 16 },
  commissionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  commissionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  commissionNameInput: { flex: 2 },
  commissionAmountInput: { flex: 1 },
  textInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#ffffff', color: '#1f2937' },
  removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
  addButtonRow: { padding: 8, borderRadius: 6, backgroundColor: '#ecfdf5' },
  actionButtonsContainer: { flexDirection: 'row', gap: 4 },
  commissionTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 },
  commissionTotalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  commissionTotalValue: { fontSize: 14, fontWeight: '700', color: '#ea580c' },
  inputLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  gasTestingSection: { marginBottom: 16 },
  testingRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  testingInput: { flex: 1 },
  testingCalculation: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fbbf24' },
  calculationText: { fontSize: 12, color: '#92400e', marginBottom: 4 },
  calculationResult: { fontSize: 14, fontWeight: '600', color: '#92400e' },
  summarySection: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#1f2937' },
  totalRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalValue: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  netSaleRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, marginBottom: 0 },
  netSaleLabel: { fontSize: 16, fontWeight: '600', color: '#374151' },
  netSaleValue: { fontSize: 16, fontWeight: '700', color: '#059669' },
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
});
