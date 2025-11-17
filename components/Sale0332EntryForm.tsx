import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { Account, Sale0332, DayBookRecord } from '../types/daybook';
import { AccountAutocomplete } from './AccountAutocomplete';
import { NumberInput } from './NumberInput';
import { formatIndianCurrency } from '../utils/formatters';

interface Sale0332EntryFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (sales: Sale0332[]) => void;
  initialSales: Sale0332[];
  accounts: Account[];
  prices: DayBookRecord['prices'];
}

export function Sale0332EntryForm({ visible, onClose, onSave, initialSales, accounts, prices }: Sale0332EntryFormProps) {
  const [sales, setSales] = useState<Sale0332[]>([]);

  useEffect(() => {
    if (visible) {
      if (!initialSales || initialSales.length === 0) {
        setSales([{
          id: Date.now().toString(),
          name: '',
          litres: 0,
          amount: 0,
          fuelType: 'diesel',
          lastEdited: 'amount',
          vehicleNumber: '0332',
          receiptNumber: '',
        }]);
      } else {
        setSales(initialSales);
      }
    }
  }, [visible, initialSales]);

  const handleAddSale = (index: number) => {
    const newSale: Sale0332 = {
      id: Date.now().toString(),
      name: '',
      litres: 0,
      amount: 0,
      fuelType: 'diesel',
      lastEdited: 'amount',
      vehicleNumber: '0332',
      receiptNumber: '',
    };
    const newSales = [...sales];
    newSales.splice(index + 1, 0, newSale);
    setSales(newSales);
  };

  const handleUpdateSale = (id: string, updates: Partial<Sale0332>) => {
    setSales(prev => prev.map(s => {
      if (s.id === id) {
        let newSale = { ...s, ...updates };
        const fuelPrice = prices.diesel;
        
        if (fuelPrice > 0) {
          if ('amount' in updates && newSale.lastEdited !== 'litres') {
            newSale.litres = Math.round((newSale.amount / fuelPrice) * 100) / 100;
          } else if ('litres' in updates && newSale.lastEdited !== 'amount') {
            newSale.amount = Math.round((newSale.litres * fuelPrice) * 100) / 100;
          }
        }
        return newSale;
      }
      return s;
    }));
  };

  const handleRemoveSale = (id: string) => {
    if (sales.length > 1) {
        setSales(prev => prev.filter(s => s.id !== id));
    } else {
        setSales([{
            id: Date.now().toString(),
            name: '',
            litres: 0,
            amount: 0,
            fuelType: 'diesel',
            lastEdited: 'amount',
            vehicleNumber: '0332',
            receiptNumber: '',
        }]);
    }
  };

  const handleDone = () => {
    const validSales = sales.filter(s => s.name && s.amount > 0);
    onSave(validSales);
    onClose();
  };

  const totalAmount = sales.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage 0332 Sales</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.cellAccount]}>Account</Text>
          <Text style={[styles.headerText, styles.cellVehicle]}>Vehicle</Text>
          <Text style={[styles.headerText, styles.cellAmount]}>Amount</Text>
          <Text style={[styles.headerText, styles.cellReceipt]}>Receipt</Text>
          <Text style={[styles.headerText, styles.cellLitres]}>Litres</Text>
          <View style={{ width: 76 }} />
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            <View style={styles.listContainer}>
                {sales.map((sale, index) => (
                    <View key={sale.id} style={[styles.saleRow, { zIndex: sales.length - index }]}>
                        <View style={styles.cellAccount}>
                            <AccountAutocomplete
                                accounts={accounts}
                                value={sale.name}
                                onValueChange={name => handleUpdateSale(sale.id, { name, accountId: undefined })}
                                onAccountSelect={account => handleUpdateSale(sale.id, { name: account.name, accountId: account.id })}
                            />
                        </View>
                        <View style={styles.cellVehicle}><TextInput style={[styles.input, styles.disabledInput]} value={sale.vehicleNumber} editable={false} /></View>
                        <View style={styles.cellAmount}><NumberInput value={sale.amount} onChangeValue={amount => handleUpdateSale(sale.id, { amount, lastEdited: 'amount' })} precision={2} /></View>
                        <View style={styles.cellReceipt}><TextInput style={styles.input} value={sale.receiptNumber} onChangeText={text => handleUpdateSale(sale.id, { receiptNumber: text })} /></View>
                        <View style={styles.cellLitres}><NumberInput value={sale.litres} onChangeValue={litres => handleUpdateSale(sale.id, { litres, lastEdited: 'litres' })} precision={2} /></View>
                        
                        <View style={styles.rowActionButtons}>
                            <TouchableOpacity onPress={() => handleRemoveSale(sale.id)} style={styles.removeButton}>
                                <Trash2 size={16} color="#dc2626" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleAddSale(index)} style={styles.addButton}>
                                <Plus size={16} color="#059669" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
        <View style={styles.footer}>
            <View style={styles.footerSummary}>
                <Text style={styles.footerLabel}>Total Amount:</Text>
                <Text style={styles.footerValue}>{formatIndianCurrency(totalAmount)}</Text>
            </View>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  closeButton: { padding: 4 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    backgroundColor: '#f1f5f9',
    gap: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  scrollView: { flex: 1 },
  listContainer: { padding: 16, gap: 12 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cellAccount: { flex: 2.5 },
  cellVehicle: { flex: 1.5 },
  cellAmount: { flex: 1.5 },
  cellReceipt: { flex: 1.5 },
  cellLitres: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#ffffff' },
  disabledInput: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  rowActionButtons: { flexDirection: 'row', gap: 4 },
  removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
  addButton: { padding: 8, borderRadius: 6, backgroundColor: '#ecfdf5' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff', gap: 16 },
  footerSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 16, fontWeight: '600' },
  footerValue: { fontSize: 16, fontWeight: '700' },
  doneButton: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center' },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
