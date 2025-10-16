import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { Account, SviSale, Sale0332, CreditSale, DayBookRecord } from '../types/daybook';
import { AccountAutocomplete } from './AccountAutocomplete';
import { NumberInput } from './NumberInput';
import { formatIndianCurrency } from '../utils/formatters';

type SaleEntry = SviSale | Sale0332 | CreditSale;

interface CreditEntryFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (deductions: DayBookRecord['deductions']) => void;
  initialDeductions: DayBookRecord['deductions'];
  accounts: Account[];
  prices: DayBookRecord['prices'];
}

export function CreditEntryForm({ visible, onClose, onSave, initialDeductions, accounts, prices }: CreditEntryFormProps) {
  const [allSales, setAllSales] = useState<SaleEntry[]>([]);

  useEffect(() => {
    if (visible) {
      const combined = [
        ...(initialDeductions.sviSales || []),
        ...(initialDeductions.sales0332 || []),
        ...(initialDeductions.creditSales || []),
      ];
      if (combined.length === 0) {
        setAllSales([{
          id: Date.now().toString(),
          name: '',
          litres: 0,
          amount: 0,
          fuelType: 'diesel',
          lastEdited: 'amount',
          vehicleNumber: '',
          receiptNumber: '',
        }]);
      } else {
        setAllSales(combined);
      }
    }
  }, [visible, initialDeductions]);

  const handleAddSale = (index: number) => {
    const newSale: CreditSale = {
      id: Date.now().toString(),
      name: '',
      litres: 0,
      amount: 0,
      fuelType: 'diesel',
      lastEdited: 'amount',
      vehicleNumber: '',
      receiptNumber: '',
    };
    const newSales = [...allSales];
    newSales.splice(index + 1, 0, newSale);
    setAllSales(newSales);
  };

  const handleUpdateSale = (id: string, updates: Partial<SaleEntry>) => {
    setAllSales(prev => prev.map(s => {
      if (s.id === id) {
        let newSale = { ...s, ...updates };
        const fuelPrice = newSale.fuelType === 'petrol' ? prices.petrol : prices.diesel;
        
        if (fuelPrice > 0) {
          if ('amount' in updates && newSale.lastEdited !== 'litres') {
            newSale.litres = Math.round((newSale.amount / fuelPrice) * 100) / 100;
          } else if ('litres' in updates && newSale.lastEdited !== 'amount') {
            newSale.amount = Math.round((newSale.litres * fuelPrice) * 100) / 100;
          } else if ('fuelType' in updates) {
            if (newSale.lastEdited === 'litres') {
              newSale.amount = Math.round((newSale.litres * fuelPrice) * 100) / 100;
            } else {
              newSale.litres = Math.round((newSale.amount / fuelPrice) * 100) / 100;
            }
          }
        }
        
        // Auto-fill vehicle number for 'SVI 0332'
        if ('accountId' in updates && newSale.name?.toLowerCase().trim() === 'svi 0332') {
          newSale.vehicleNumber = '0332';
        }
        
        return newSale;
      }
      return s;
    }));
  };

  const handleRemoveSale = (id: string) => {
    if (allSales.length > 1) {
        setAllSales(prev => prev.filter(s => s.id !== id));
    } else {
        setAllSales([{
            id: Date.now().toString(),
            name: '',
            litres: 0,
            amount: 0,
            fuelType: 'diesel',
            lastEdited: 'amount',
            vehicleNumber: '',
            receiptNumber: '',
        }]);
    }
  };

  const handleDone = () => {
    const sortedDeductions: DayBookRecord['deductions'] = {
      sviSales: [],
      sales0332: [],
      creditSales: [],
    };

    allSales.forEach(sale => {
      if (!sale.name || sale.amount <= 0) return;
      const saleNameLower = sale.name.toLowerCase().trim();
      if (saleNameLower === 'svi') {
        sortedDeductions.sviSales.push(sale as SviSale);
      } else if (saleNameLower === 'svi 0332') {
        sortedDeductions.sales0332.push(sale as Sale0332);
      } else {
        sortedDeductions.creditSales.push(sale as CreditSale);
      }
    });
    onSave(sortedDeductions);
    onClose();
  };

  const totalAmount = allSales.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Credit Sales</Text>
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
          <Text style={[styles.headerText, { width: 60, textAlign: 'center' }]}>P/D</Text>
          <View style={{ width: 76 }} />
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            <View style={styles.listContainer}>
                {allSales.map((sale, index) => (
                    <View key={sale.id} style={[styles.saleRow, { zIndex: allSales.length - index }]}>
                        <View style={styles.cellAccount}>
                            <AccountAutocomplete
                                accounts={accounts}
                                value={sale.name}
                                onValueChange={name => handleUpdateSale(sale.id, { name, accountId: undefined })}
                                onAccountSelect={account => handleUpdateSale(sale.id, { name: account.name, accountId: account.id })}
                            />
                        </View>
                        <View style={styles.cellVehicle}><TextInput style={styles.input} value={sale.vehicleNumber} onChangeText={text => handleUpdateSale(sale.id, { vehicleNumber: text })} /></View>
                        <View style={styles.cellAmount}><NumberInput value={sale.amount} onChangeValue={amount => handleUpdateSale(sale.id, { amount, lastEdited: 'amount' })} precision={2} /></View>
                        <View style={styles.cellReceipt}><TextInput style={styles.input} value={sale.receiptNumber} onChangeText={text => handleUpdateSale(sale.id, { receiptNumber: text })} /></View>
                        <View style={styles.cellLitres}><NumberInput value={sale.litres} onChangeValue={litres => handleUpdateSale(sale.id, { litres, lastEdited: 'litres' })} precision={2} /></View>
                        <View style={styles.fuelTypeSelector}>
                            <TouchableOpacity onPress={() => handleUpdateSale(sale.id, { fuelType: 'petrol' })} style={[styles.fuelTypeButton, sale.fuelType === 'petrol' && styles.fuelTypeActive]}><Text style={[styles.fuelTypeText, sale.fuelType === 'petrol' && styles.fuelTypeTextActive]}>P</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleUpdateSale(sale.id, { fuelType: 'diesel' })} style={[styles.fuelTypeButton, sale.fuelType === 'diesel' && styles.fuelTypeActive]}><Text style={[styles.fuelTypeText, sale.fuelType === 'diesel' && styles.fuelTypeTextActive]}>D</Text></TouchableOpacity>
                        </View>
                        
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
                <Text style={styles.doneButtonText}>Done & Sort Entries</Text>
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
  fuelTypeSelector: { flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden' },
  fuelTypeButton: { paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  fuelTypeActive: { backgroundColor: '#d1d5db' },
  fuelTypeText: { fontSize: 12, fontWeight: '600' },
  fuelTypeTextActive: { color: '#1f2937' },
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
