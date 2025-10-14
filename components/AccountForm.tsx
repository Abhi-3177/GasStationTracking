import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, User, Building, Phone, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { Account, BalanceEntry } from '../types/daybook';
import { saveAccount } from '../utils/database';
import { useNotification } from '../context/NotificationContext';
import { NumberInput } from './NumberInput';
import { DateSelector } from './DateSelector';
import { format } from 'date-fns';

interface AccountFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  account: Account | null;
  defaultType?: 'factory' | 'transporter';
}

const createNewAccount = (type: 'factory' | 'transporter' = 'factory'): Omit<Account, 'id' | 'createdAt' | 'user_id'> => ({
  name: '',
  type: type,
  contact: '',
  address: '',
  balanceEntries: [{ id: Date.now().toString(), date: format(new Date(), 'yyyy-MM-dd'), description: 'Opening Balance', type: 'debit', amount: 0 }],
});

export function AccountForm({ visible, onClose, onSave, account, defaultType = 'factory' }: AccountFormProps) {
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState(createNewAccount(defaultType));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (account) {
        setFormData({
          name: account.name || '',
          type: account.type || 'factory',
          contact: account.contact || '',
          address: account.address || '',
          balanceEntries: account.balanceEntries?.length > 0 ? account.balanceEntries : createNewAccount().balanceEntries,
        });
      } else {
        setFormData(createNewAccount(defaultType));
      }
    }
  }, [account, visible, defaultType]);

  const handleUpdate = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBalanceEntryUpdate = (id: string, updates: Partial<BalanceEntry>) => {
    const updatedEntries = formData.balanceEntries.map(entry =>
      entry.id === id ? { ...entry, ...updates } : entry
    );
    handleUpdate('balanceEntries', updatedEntries);
  };

  const addBalanceEntry = () => {
    const newEntry: BalanceEntry = {
      id: Date.now().toString(),
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      type: 'debit',
      amount: 0,
    };
    handleUpdate('balanceEntries', [...formData.balanceEntries, newEntry]);
  };

  const removeBalanceEntry = (id: string) => {
    if (formData.balanceEntries.length > 1) {
      handleUpdate('balanceEntries', formData.balanceEntries.filter(entry => entry.id !== id));
    } else {
      showNotification('At least one balance entry is required.', 'info');
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      showNotification('Account name is required.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const accountToSave = {
        ...(account || {}), // Includes id if editing
        ...formData,
      } as Account;
      await saveAccount(accountToSave);
      showNotification(`Account "${formData.name}" saved successfully.`, 'success');
      onSave();
    } catch (error: any) {
      showNotification(`Error saving account: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{account ? 'Edit Account' : 'Add New Account'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}><User size={14} color="#374151" /> Account Name</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={text => handleUpdate('name', text)} placeholder="e.g., Surya Transports" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}><Building size={14} color="#374151" /> Account Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity style={[styles.typeButton, formData.type === 'factory' && styles.typeButtonActive]} onPress={() => handleUpdate('type', 'factory')}>
                  <Text style={[styles.typeButtonText, formData.type === 'factory' && styles.typeButtonTextActive]}>Factory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeButton, formData.type === 'transporter' && styles.typeButtonActive]} onPress={() => handleUpdate('type', 'transporter')}>
                  <Text style={[styles.typeButtonText, formData.type === 'transporter' && styles.typeButtonTextActive]}>Transporter</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}><Phone size={14} color="#374151" /> Contact Number</Text>
              <TextInput style={styles.input} value={formData.contact} onChangeText={text => handleUpdate('contact', text)} placeholder="Optional" keyboardType="phone-pad" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}><MapPin size={14} color="#374151" /> Address</Text>
              <TextInput style={[styles.input, styles.textArea]} value={formData.address} onChangeText={text => handleUpdate('address', text)} placeholder="Optional" multiline />
            </View>
            
            <View style={styles.balanceSection}>
                <Text style={styles.sectionTitle}>Opening Balance</Text>
                {formData.balanceEntries.map(entry => (
                    <View key={entry.id} style={styles.balanceEntryRow}>
                        <View style={styles.balanceInputGroup}>
                            <Text style={styles.balanceLabel}>Date</Text>
                            <DateSelector selectedDate={new Date(entry.date)} onDateChange={date => handleBalanceEntryUpdate(entry.id, { date: format(date, 'yyyy-MM-dd') })} buttonStyle={styles.balanceDateButton} />
                        </View>
                        <View style={styles.balanceInputGroup}>
                            <Text style={styles.balanceLabel}>Description</Text>
                            <TextInput style={styles.input} value={entry.description} onChangeText={text => handleBalanceEntryUpdate(entry.id, { description: text })} />
                        </View>
                        <View style={styles.balanceInputGroup}>
                            <Text style={styles.balanceLabel}>Type</Text>
                            <View style={styles.typeSelector}>
                                <TouchableOpacity style={[styles.typeButtonSmall, entry.type === 'debit' && styles.typeButtonActive]} onPress={() => handleBalanceEntryUpdate(entry.id, { type: 'debit' })}>
                                    <Text style={[styles.typeButtonTextSmall, entry.type === 'debit' && styles.typeButtonTextActive]}>Debit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.typeButtonSmall, entry.type === 'credit' && styles.typeButtonActive]} onPress={() => handleBalanceEntryUpdate(entry.id, { type: 'credit' })}>
                                    <Text style={[styles.typeButtonTextSmall, entry.type === 'credit' && styles.typeButtonTextActive]}>Credit</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.balanceInputGroup}>
                            <Text style={styles.balanceLabel}>Amount</Text>
                            <NumberInput value={entry.amount} onChangeValue={amount => handleBalanceEntryUpdate(entry.id, { amount })} />
                        </View>
                        <TouchableOpacity onPress={() => removeBalanceEntry(entry.id)} style={styles.removeButton}>
                            <Trash2 size={16} color="#dc2626" />
                        </TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity onPress={addBalanceEntry} style={styles.addButton}>
                    <Plus size={16} color="#2563eb" />
                    <Text style={styles.addButtonText}>Add Balance Entry</Text>
                </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Account'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  closeButton: { padding: 4 },
  scrollView: { flex: 1 },
  form: { padding: 16, gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeSelector: { flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' },
  typeButton: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  typeButtonActive: { backgroundColor: '#2563eb' },
  typeButtonText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  typeButtonTextActive: { color: '#fff' },
  balanceSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  balanceEntryRow: { padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', gap: 12 },
  balanceInputGroup: { gap: 4 },
  balanceLabel: { fontSize: 12, color: '#6b7280' },
  balanceDateButton: { padding: 8 },
  typeButtonSmall: { flex: 1, padding: 8, alignItems: 'center', backgroundColor: '#fff' },
  typeButtonTextSmall: { fontSize: 12, fontWeight: '500', color: '#374151' },
  removeButton: { position: 'absolute', top: 8, right: 8, padding: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8 },
  addButtonText: { fontSize: 14, fontWeight: '500', color: '#2563eb' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  saveButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#93c5fd' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
