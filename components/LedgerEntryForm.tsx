import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { Account, CreditSale, PaymentReceived } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { addCreditSaleToDayBook, addPaymentReceived } from '../../utils/database';
import { DateSelector } from '../../components/DateSelector';
import { NumberInput } from '../../components/NumberInput';
import { format } from 'date-fns';

interface LedgerEntryFormProps {
  account: Account;
  entryType: 'payment' | 'creditSale';
  onClose: () => void;
  onSave: () => void;
}

export function LedgerEntryForm({ account, entryType, onClose, onSave }: LedgerEntryFormProps) {
  const { showNotification } = useNotification();
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Reset form when entryType changes
    setDate(new Date());
    setAmount(0);
    setDescription('');
    setReceiptNumber('');
  }, [entryType, account]);

  const handleSave = async () => {
    if (amount <= 0) {
      showNotification('Amount must be greater than zero.', 'error');
      return;
    }
    setIsSaving(true);
    const dateKey = format(date, 'yyyy-MM-dd');

    try {
      if (entryType === 'payment') {
        const payment: Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'> = {
          date: dateKey,
          accountId: account.id,
          amount,
          description,
          receiptNumber,
        };
        await addPaymentReceived(payment);
        showNotification('Payment recorded successfully!', 'success');
      } else { // creditSale
        const sale: Omit<CreditSale, 'id' | 'lastEdited'> = {
          name: account.name,
          accountId: account.id,
          amount,
          litres: 0, // Litres are not specified in this quick form
          fuelType: 'diesel', // Default value
          vehicleNumber: description, // Using description for this
          receiptNumber: receiptNumber,
        };
        await addCreditSaleToDayBook(sale, dateKey);
        showNotification('Credit sale added successfully!', 'success');
      }
      onSave(); // This will trigger the refresh on the ledger screen
    } catch (error: any) {
      console.error(`Error saving ledger entry:`, error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const title = entryType === 'payment' ? 'Record Payment' : 'Add Credit Sale';

  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date</Text>
            <DateSelector selectedDate={date} onDateChange={setDate} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount (₹)</Text>
            <NumberInput value={amount} onChangeValue={setAmount} placeholder="0.00" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Receipt Number (Optional)</Text>
            <TextInput style={styles.input} value={receiptNumber} onChangeText={setReceiptNumber} placeholder="e.g., 98765" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{entryType === 'payment' ? 'Description' : 'Vehicle Number'} (Optional)</Text>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder={entryType === 'payment' ? 'e.g., Invoice #123' : 'e.g., HR-01-1234'} />
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{`Save ${entryType === 'payment' ? 'Payment' : 'Sale'}`}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    modalContent: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f8fafc',
      },
      modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#fff',
      },
      modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1f2937',
      },
      closeButton: {
        padding: 4,
      },
      form: {
        padding: 16,
        gap: 16,
      },
      inputGroup: {
        gap: 8,
      },
      label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
      },
      input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        backgroundColor: '#fff',
      },
      footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#fff',
      },
      saveButton: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
      },
      saveButtonDisabled: {
        backgroundColor: '#93c5fd',
      },
      saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
      },
});
