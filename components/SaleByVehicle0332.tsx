import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Truck, Plus, Edit, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from './Card';
import { AccountAutocomplete } from './AccountAutocomplete';
import { NumberInput } from './NumberInput';
import { DayBookRecord, DailyRecord, Account, Sale0332BreakdownEntry } from '../types/daybook';
import { formatIndianCurrency, formatLitres } from '../utils/formatters';

interface SaleByVehicle0332Props {
  dayBookRecord: DayBookRecord | null;
  dailyRecord: DailyRecord;
  accounts: Account[];
  onUpdateBreakdown: (breakdown: Sale0332BreakdownEntry[]) => Promise<void>;
}

export function SaleByVehicle0332({ dayBookRecord, dailyRecord, accounts, onUpdateBreakdown }: SaleByVehicle0332Props) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [breakdown, setBreakdown] = useState<Sale0332BreakdownEntry[]>([]);

  useEffect(() => {
    setBreakdown(dailyRecord.sales0332Breakdown || []);
  }, [dailyRecord.sales0332Breakdown]);

  const sale0332ForCurrentDay = useMemo(() => {
    return dayBookRecord?.deductions.sales0332.find(s => s.name.toLowerCase().trim() === 'svi 0332');
  }, [dayBookRecord]);

  if (!sale0332ForCurrentDay) {
    return null; // Don't render if there was no 0332 sale for the current day
  }

  const totalLitresFilled = sale0332ForCurrentDay.litres;
  const totalAmountFilled = sale0332ForCurrentDay.amount;

  const totalLitresSold = breakdown.reduce((sum, entry) => sum + entry.litres, 0);
  const totalAmountSold = breakdown.reduce((sum, entry) => sum + entry.amount, 0);
  const remainingLitres = totalLitresFilled - totalLitresSold;

  const handleSaveBreakdown = async (newBreakdown: Sale0332BreakdownEntry[]) => {
    await onUpdateBreakdown(newBreakdown);
    setIsFormVisible(false);
  };

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Truck size={20} color="#ca8a04" />
          <Text style={styles.title}>Vehicle 0332 Sales Breakdown</Text>
        </View>
        <Text style={styles.subtitle}>
          Log the individual sales made from the diesel loaded into vehicle 0332.
        </Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Filled</Text>
            <Text style={styles.summaryValue}>{formatLitres(totalLitresFilled)}</Text>
            <Text style={styles.summarySubValue}>{formatIndianCurrency(totalAmountFilled)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Sold</Text>
            <Text style={styles.summaryValue}>{formatLitres(totalLitresSold)}</Text>
            <Text style={styles.summarySubValue}>{formatIndianCurrency(totalAmountSold)}</Text>
          </View>
          <View style={[styles.summaryItem, styles.remainingItem]}>
            <Text style={[styles.summaryLabel, styles.remainingLabel]}>Remaining</Text>
            <Text style={[styles.summaryValue, styles.remainingValue]}>{formatLitres(remainingLitres)}</Text>
          </View>
        </View>

        {breakdown.length > 0 && (
            <View style={styles.breakdownList}>
                <Text style={styles.listHeader}>Breakdown Entries</Text>
                {breakdown.map(entry => (
                    <View key={entry.id} style={styles.breakdownRow}>
                        <Text style={styles.breakdownAccount}>{entry.name || 'N/A'}</Text>
                        <View>
                            <Text style={styles.breakdownAmount}>{formatIndianCurrency(entry.amount)}</Text>
                            <Text style={styles.breakdownLitres}>{formatLitres(entry.litres)}</Text>
                        </View>
                    </View>
                ))}
            </View>
        )}

        <TouchableOpacity style={styles.manageButton} onPress={() => setIsFormVisible(true)}>
          <Edit size={14} color="#fff" />
          <Text style={styles.manageButtonText}>Manage Sales</Text>
        </TouchableOpacity>
      </Card>

      <Sale0332BreakdownForm
        visible={isFormVisible}
        onClose={() => setIsFormVisible(false)}
        initialBreakdown={breakdown}
        accounts={accounts}
        onSave={handleSaveBreakdown}
        dieselPrice={dayBookRecord?.prices.diesel || 0}
      />
    </>
  );
}

interface BreakdownFormProps {
  visible: boolean;
  onClose: () => void;
  initialBreakdown: Sale0332BreakdownEntry[];
  accounts: Account[];
  onSave: (breakdown: Sale0332BreakdownEntry[]) => Promise<void>;
  dieselPrice: number;
}

function Sale0332BreakdownForm({ visible, onClose, onSave, initialBreakdown, accounts, dieselPrice }: BreakdownFormProps) {
  const [breakdown, setBreakdown] = useState<Sale0332BreakdownEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setBreakdown(initialBreakdown.length > 0 ? initialBreakdown : [{ id: Date.now().toString(), accountId: '', name: '', amount: 0, litres: 0 }]);
    }
  }, [visible, initialBreakdown]);

  const handleUpdateEntry = (id: string, updates: Partial<Sale0332BreakdownEntry>) => {
    setBreakdown(prev => prev.map(entry => {
      if (entry.id === id) {
        const newEntry = { ...entry, ...updates };
        if (dieselPrice > 0) {
          if ('amount' in updates) {
            newEntry.litres = Math.round((newEntry.amount / dieselPrice) * 100) / 100;
          } else if ('litres' in updates) {
            newEntry.amount = Math.round(newEntry.litres * dieselPrice);
          }
        }
        return newEntry;
      }
      return entry;
    }));
  };

  const handleAddEntry = (index: number) => {
    const newEntry: Sale0332BreakdownEntry = { id: Date.now().toString(), accountId: '', name: '', amount: 0, litres: 0 };
    const newBreakdown = [...breakdown];
    newBreakdown.splice(index + 1, 0, newEntry);
    setBreakdown(newBreakdown);
  };

  const handleRemoveEntry = (id: string) => {
    if (breakdown.length > 1) {
      setBreakdown(prev => prev.filter(entry => entry.id !== id));
    } else {
      setBreakdown([{ id: Date.now().toString(), accountId: '', name: '', amount: 0, litres: 0 }]);
    }
  };

  const handleDone = async () => {
    setIsSaving(true);
    try {
        const validEntries = breakdown.filter(entry => entry.name && entry.amount > 0);
        await onSave(validEntries);
    } catch (error) {
        // Parent component will show notification
        console.error("Error saving breakdown:", error);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Manage 0332 Sales Breakdown</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.cellAccount]}>Account</Text>
          <Text style={[styles.headerText, styles.cellAmount]}>Amount</Text>
          <Text style={[styles.headerText, styles.cellLitres]}>Litres</Text>
          <View style={{ width: 76 }} />
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.listContainer}>
            {breakdown.map((entry, index) => (
              <View key={entry.id} style={[styles.saleRow, { zIndex: breakdown.length - index }]}>
                <View style={styles.cellAccount}>
                  <AccountAutocomplete
                    accounts={accounts}
                    value={entry.name}
                    onValueChange={name => handleUpdateEntry(entry.id, { name, accountId: '' })}
                    onAccountSelect={account => handleUpdateEntry(entry.id, { name: account.name, accountId: account.id })}
                  />
                </View>
                <View style={styles.cellAmount}><NumberInput value={entry.amount} onChangeValue={amount => handleUpdateEntry(entry.id, { amount })} precision={2} /></View>
                <View style={styles.cellLitres}><NumberInput value={entry.litres} onChangeValue={litres => handleUpdateEntry(entry.id, { litres })} precision={2} /></View>
                <View style={styles.rowActionButtons}>
                  <TouchableOpacity onPress={() => handleRemoveEntry(entry.id)} style={styles.removeButton}><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAddEntry(index)} style={styles.addButton}><Plus size={16} color="#059669" /></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.doneButton, isSaving && styles.disabledButton]} onPress={handleDone} disabled={isSaving}>
            {isSaving ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={styles.doneButtonText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#facc15' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: '#fefce8', padding: 12, borderRadius: 8, alignItems: 'center', gap: 2 },
  remainingItem: { backgroundColor: '#f0f9ff' },
  summaryLabel: { fontSize: 12, color: '#854d0e', fontWeight: '500' },
  remainingLabel: { color: '#0c4a6e' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#a16207' },
  remainingValue: { color: '#0369a1' },
  summarySubValue: { fontSize: 12, color: '#a16207' },
  manageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ca8a04', paddingVertical: 12, borderRadius: 8 },
  manageButtonText: { color: '#fff', fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  closeButton: { padding: 4 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#d1d5db', backgroundColor: '#f1f5f9', gap: 8 },
  headerText: { fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'center' },
  scrollView: { flex: 1 },
  listContainer: { padding: 16, gap: 12 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cellAccount: { flex: 3 },
  cellAmount: { flex: 1.5 },
  cellLitres: { flex: 1.5 },
  rowActionButtons: { flexDirection: 'row', gap: 4 },
  removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
  addButton: { padding: 8, borderRadius: 6, backgroundColor: '#ecfdf5' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  doneButton: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center' },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabledButton: { backgroundColor: '#9ca3af' },
  breakdownList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: '#fde68a',
    paddingTop: 12,
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#854d0e',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  breakdownAccount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a16207',
    textAlign: 'right',
  },
  breakdownLitres: {
    fontSize: 12,
    color: '#ca8a04',
    textAlign: 'right',
  },
});
