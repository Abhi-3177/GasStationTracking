import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { CreditCard, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { DayBookRecord, Account, SviSale, Sale0332, CreditSale } from '../types/daybook';
import { formatIndianCurrency, formatLitres } from '../utils/formatters';

type DeductionType = 'sviSales' | 'sales0332' | 'creditSales';
type SaleEntry = SviSale | Sale0332 | CreditSale;

interface DeductionGroupProps {
  title: string;
  sales: SaleEntry[];
  accounts: Account[];
  prices: DayBookRecord['prices'];
  onUpdate: (sales: SaleEntry[]) => void;
  defaultName?: string;
}

const DeductionGroup: React.FC<DeductionGroupProps> = ({ title, sales, accounts, prices, onUpdate, defaultName }) => {
  const handleAdd = () => {
    const newSale: SaleEntry = {
      id: Date.now().toString(),
      name: defaultName || '',
      litres: 0,
      amount: 0,
      fuelType: 'diesel',
      lastEdited: 'amount',
    };
    onUpdate([...sales, newSale]);
  };

  const handleUpdate = (id: string, updates: Partial<SaleEntry>) => {
    const updatedSales = sales.map(s => (s.id === id ? { ...s, ...updates } : s));
    onUpdate(updatedSales);
  };

  const handleRemove = (id: string) => {
    const updatedSales = sales.filter(s => s.id !== id);
    onUpdate(updatedSales);
  };

  const totalAmount = sales.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <View style={styles.groupContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sales.map(sale => (
        <View key={sale.id} style={styles.saleRow}>
          <View style={styles.inputsGrid}>
            <View style={styles.inputWide}>
              <AccountAutocomplete
                accounts={accounts}
                value={sale.name}
                onValueChange={name => handleUpdate(sale.id, { name, accountId: undefined })}
                onAccountSelect={account => handleUpdate(sale.id, { name: account.name, accountId: account.id })}
                placeholder="Account Name"
              />
            </View>
            <View style={styles.inputNarrow}>
              <TextInput
                style={styles.textInput}
                value={sale.vehicleNumber}
                onChangeText={text => handleUpdate(sale.id, { vehicleNumber: text })}
                placeholder="Vehicle No."
              />
            </View>
             <View style={styles.inputNarrow}>
              <TextInput
                style={styles.textInput}
                value={sale.receiptNumber}
                onChangeText={text => handleUpdate(sale.id, { receiptNumber: text })}
                placeholder="Receipt No."
              />
            </View>
            <View style={styles.inputNarrow}>
              <NumberInput
                value={sale.litres}
                onChangeValue={litres => {
                  const fuelPrice = sale.fuelType === 'petrol' ? prices.petrol : prices.diesel;
                  const amount = Math.ceil(litres * fuelPrice);
                  handleUpdate(sale.id, { litres, amount, lastEdited: 'litres' });
                }}
                placeholder="Litres"
              />
            </View>
            <View style={styles.inputNarrow}>
              <NumberInput
                value={sale.amount}
                onChangeValue={amount => {
                  const fuelPrice = sale.fuelType === 'petrol' ? prices.petrol : prices.diesel;
                  const litres = fuelPrice > 0 ? amount / fuelPrice : 0;
                  handleUpdate(sale.id, { amount, litres, lastEdited: 'amount' });
                }}
                placeholder="Amount"
              />
            </View>
          </View>
          <TouchableOpacity onPress={() => handleRemove(sale.id)} style={styles.removeButton}>
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
        <Plus size={16} color="#2563eb" />
        <Text style={styles.addButtonText}>Add {title}</Text>
      </TouchableOpacity>
      {totalAmount > 0 && (
        <View style={styles.groupTotal}>
          <Text style={styles.groupTotalLabel}>Total {title}:</Text>
          <Text style={styles.groupTotalValue}>{formatIndianCurrency(totalAmount)}</Text>
        </View>
      )}
    </View>
  );
};


interface DeductionsSectionProps {
  deductions: DayBookRecord['deductions'];
  prices: DayBookRecord['prices'];
  accounts: Account[];
  onUpdateDeductions: (deductions: DayBookRecord['deductions']) => void;
}

export function DeductionsSection({ deductions, prices, accounts, onUpdateDeductions }: DeductionsSectionProps) {
  const handleUpdateGroup = (type: DeductionType, sales: SaleEntry[]) => {
    onUpdateDeductions({ ...deductions, [type]: sales });
  };
  
  const totalDeductions = 
    (deductions.sviSales?.reduce((s, i) => s + i.amount, 0) || 0) +
    (deductions.sales0332?.reduce((s, i) => s + i.amount, 0) || 0) +
    (deductions.creditSales?.reduce((s, i) => s + i.amount, 0) || 0);

  return (
    <Card>
      <View style={styles.header}>
        <CreditCard size={20} color="#7c3aed" />
        <Text style={styles.title}>Credit & Deductions</Text>
      </View>
      
      <DeductionGroup
        title="SVI Sales"
        sales={deductions.sviSales || []}
        accounts={accounts}
        prices={prices}
        onUpdate={sales => handleUpdateGroup('sviSales', sales)}
        defaultName="SVI"
      />
      <DeductionGroup
        title="0332 Sales"
        sales={deductions.sales0332 || []}
        accounts={accounts}
        prices={prices}
        onUpdate={sales => handleUpdateGroup('sales0332', sales)}
        defaultName="SVI 0332"
      />
      <DeductionGroup
        title="General Credit Sales"
        sales={deductions.creditSales || []}
        accounts={accounts}
        prices={prices}
        onUpdate={sales => handleUpdateGroup('creditSales', sales)}
      />
      
      <View style={styles.summarySection}>
        <Text style={styles.totalLabel}>Total Deductions:</Text>
        <Text style={styles.totalValue}>{formatIndianCurrency(totalDeductions)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  groupContainer: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inputsGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inputWide: { width: '100%' },
  inputNarrow: { flex: 1, minWidth: '40%' },
  textInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#ffffff' },
  removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8, marginTop: 8 },
  addButtonText: { fontSize: 14, fontWeight: '500', color: '#2563eb' },
  groupTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 },
  groupTotalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  groupTotalValue: { fontSize: 14, fontWeight: '700', color: '#7c3aed' },
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f3ff', padding: 12, borderRadius: 8, marginTop: 16 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#5b21b6' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#5b21b6' },
});
