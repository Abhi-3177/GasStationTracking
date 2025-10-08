import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Account, BalanceEntry } from '../types/daybook';
import { NumberInput } from './NumberInput';
import { DateSelector } from './DateSelector';

interface AccountFormProps {
  initialData?: Account | null;
  onSave: (data: Omit<Account, 'id' | 'createdAt' | 'user_id'>) => void;
  onCancel: () => void;
}

const BalanceEntriesManager = ({ entries, setEntries }: { entries: BalanceEntry[], setEntries: (entries: BalanceEntry[]) => void }) => {
  const [newEntry, setNewEntry] = useState({
    date: new Date(),
    description: '',
    amount: 0,
    type: 'debit' as 'credit' | 'debit',
  });

  const addEntry = () => {
    if (!newEntry.description.trim() || newEntry.amount <= 0) {
      alert('Please enter a valid description and amount.');
      return;
    }
    const entry: BalanceEntry = {
      id: Date.now().toString(),
      date: newEntry.date.toISOString(),
      description: newEntry.description,
      type: newEntry.type,
      amount: newEntry.amount,
    };
    setEntries([...entries, entry]);
    setNewEntry({ date: new Date(), description: '', amount: 0, type: 'debit' });
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  return (
    <View style={styles.managerContainer}>
      <Text style={styles.managerTitle}>Opening Balance Entries</Text>
      
      {entries.map(entry => (
        <View key={entry.id} style={styles.entryRow}>
          <View style={styles.entryInfo}>
            <Text style={styles.entryDescription}>{entry.description}</Text>
            <Text style={styles.entryDate}>{format(new Date(entry.date), 'PPP')}</Text>
          </View>
          <Text style={entry.type === 'credit' ? styles.creditAmount : styles.debitAmount}>
            {entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toFixed(2)}
          </Text>
          <TouchableOpacity onPress={() => removeEntry(entry.id)} style={styles.removeButton}>
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.addEntryForm}>
        <Text style={styles.formSectionTitle}>Add New Balance Entry</Text>
        <DateSelector 
            selectedDate={newEntry.date}
            onDateChange={date => setNewEntry({ ...newEntry, date })}
        />
        <TextInput
          style={styles.entryTextInput}
          value={newEntry.description}
          onChangeText={text => setNewEntry({ ...newEntry, description: text })}
          placeholder="Description (e.g., Previous due)"
        />
        <View style={styles.amountTypeRow}>
            <View style={{flex: 1}}>
                <NumberInput
                    value={newEntry.amount}
                    onChangeValue={value => setNewEntry({ ...newEntry, amount: value })}
                    placeholder="Amount"
                    precision={2}
                />
            </View>
            <View style={styles.entryTypeSelector}>
                <TouchableOpacity
                    style={[styles.entryTypeButton, newEntry.type === 'debit' && styles.entryTypeActiveDebit]}
                    onPress={() => setNewEntry({ ...newEntry, type: 'debit' })}
                >
                    <TrendingDown size={18} color={newEntry.type === 'debit' ? '#fff' : '#dc2626'} />
                    <View style={styles.typeButtonTextBox}>
                        <Text style={[styles.entryTypeText, newEntry.type === 'debit' && styles.entryTypeTextActive]}>Debit</Text>
                        <Text style={[styles.helperText, newEntry.type === 'debit' && styles.entryTypeTextActive]}>Customer Owes</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.entryTypeButton, newEntry.type === 'credit' && styles.entryTypeActiveCredit]}
                    onPress={() => setNewEntry({ ...newEntry, type: 'credit' })}
                >
                    <TrendingUp size={18} color={newEntry.type === 'credit' ? '#fff' : '#059669'} />
                    <View style={styles.typeButtonTextBox}>
                        <Text style={[styles.entryTypeText, newEntry.type === 'credit' && styles.entryTypeTextActive]}>Credit</Text>
                        <Text style={[styles.helperText, newEntry.type === 'credit' && styles.entryTypeTextActive]}>Advance Paid</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
        <TouchableOpacity onPress={addEntry} style={styles.addEntryButton}>
          <Plus size={16} color="#ffffff" />
          <Text style={styles.addEntryButtonText}>Add Entry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export function AccountForm({ initialData, onSave, onCancel }: AccountFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || ('factory' as 'factory' | 'transporter'),
    contact: initialData?.contact || '',
    address: initialData?.address || '',
    balanceEntries: initialData?.balanceEntries || [],
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter account name');
      return;
    }
    onSave(formData);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Account Name *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter account name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Account Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, formData.type === 'factory' && styles.typeButtonActive]}
              onPress={() => setFormData({ ...formData, type: 'factory' })}
            >
              <Text style={[styles.typeButtonText, formData.type === 'factory' && styles.typeButtonTextActive]}>
                Factory
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, formData.type === 'transporter' && styles.typeButtonActive]}
              onPress={() => setFormData({ ...formData, type: 'transporter' })}
            >
              <Text style={[styles.typeButtonText, formData.type === 'transporter' && styles.typeButtonTextActive]}>
                Transporter
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Contact Number</Text>
          <TextInput
            style={styles.textInput}
            value={formData.contact}
            onChangeText={(text) => setFormData({ ...formData, contact: text })}
            placeholder="Enter contact number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={formData.address}
            onChangeText={(text) => setFormData({ ...formData, address: text })}
            placeholder="Enter address"
            multiline
            numberOfLines={3}
          />
        </View>

        <BalanceEntriesManager
          entries={formData.balanceEntries}
          setEntries={(entries) => setFormData({ ...formData, balanceEntries: entries })}
        />

        <View style={styles.formActions}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>
              {initialData ? 'Update Account' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // BalanceEntriesManager styles
  managerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  managerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  entryDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  creditAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginHorizontal: 12,
  },
  debitAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginHorizontal: 12,
  },
  removeButton: {
    padding: 4,
  },
  addEntryForm: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    gap: 12,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  entryTextInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  amountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  entryTypeSelector: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
    flex: 1,
  },
  entryTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  typeButtonTextBox: {
    alignItems: 'center',
  },
  entryTypeActiveDebit: {
    backgroundColor: '#dc2626',
  },
  entryTypeActiveCredit: {
    backgroundColor: '#059669',
  },
  entryTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  entryTypeTextActive: {
    color: '#ffffff',
  },
  helperText: {
    fontSize: 10,
    color: '#6b7280',
  },
  addEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 6,
  },
  addEntryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});
