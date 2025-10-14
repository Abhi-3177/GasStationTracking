import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { HandCoins, Plus, Trash2, X } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { ConfirmModal } from './ConfirmModal';
import { PaymentReceived, Account } from '../types/daybook';
import { useNotification } from '../context/NotificationContext';
import { formatIndianCurrency } from '../utils/formatters';

interface PaymentsReceivedProps {
  payments: PaymentReceived[];
  accounts: Account[];
  onAddPayment: (payment: Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  date: string;
}

export function PaymentsReceived({ payments, accounts, onAddPayment, onDeletePayment, date }: PaymentsReceivedProps) {
  const { showNotification } = useNotification();
  const [showForm, setShowForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [newPayment, setNewPayment] = useState({
    accountId: '',
    amount: 0,
    description: '',
    receiptNumber: '', // New field
  });

  // State for confirmation modal
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentReceived | null>(null);

  const handleAddPayment = async () => {
    if (!newPayment.accountId || newPayment.amount <= 0) {
      showNotification('Please select an account and enter a valid amount.', 'error');
      return;
    }
    await onAddPayment({ ...newPayment, date });
    resetForm();
  };

  const handleDeletePayment = (payment: PaymentReceived) => {
    setPaymentToDelete(payment);
    setIsConfirmModalVisible(true);
  };
  
  const performDelete = async () => {
    if (!paymentToDelete) return;
    await onDeletePayment(paymentToDelete.id);
    setIsConfirmModalVisible(false);
    setPaymentToDelete(null);
  };

  const resetForm = () => {
    setNewPayment({ accountId: '', amount: 0, description: '', receiptNumber: '' });
    setAccountName('');
    setShowForm(false);
  };

  const getAccountNameById = (accountId: string) => {
    return accounts.find(acc => acc.id === accountId)?.name || 'Unknown Account';
  };

  const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <Card>
        <View style={styles.header}>
          <HandCoins size={20} color="#2563eb" />
          <Text style={styles.title}>Payments Received</Text>
        </View>
        <Text style={styles.subtitle}>Log payments received from factories or transporters.</Text>

        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addButton}>
          <Plus size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Payment</Text>
        </TouchableOpacity>

        <View style={styles.paymentsList}>
          {payments.length === 0 ? (
            <Text style={styles.noDataText}>No payments recorded for today.</Text>
          ) : (
            payments.map(payment => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.accountName}>{getAccountNameById(payment.accountId)}</Text>
                  {payment.receiptNumber && <Text style={styles.receiptNumber}>Receipt: {payment.receiptNumber}</Text>}
                  <Text style={styles.paymentDescription}>{payment.description || 'No description'}</Text>
                </View>
                <Text style={styles.paymentAmount}>{formatIndianCurrency(payment.amount)}</Text>
                <TouchableOpacity onPress={() => handleDeletePayment(payment)} style={styles.removeButton}>
                  <Trash2 size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Total Payments Received Today:</Text>
          <Text style={styles.summaryValue}>{formatIndianCurrency(totalPaymentsReceived)}</Text>
        </View>

        <Modal animationType="slide" transparent={true} visible={showForm} onRequestClose={resetForm}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Payment Received</Text>
                <TouchableOpacity onPress={resetForm} style={styles.closeButton}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.formScrollView}>
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Account</Text>
                  <AccountAutocomplete
                    accounts={accounts}
                    value={accountName}
                    onValueChange={setAccountName}
                    onAccountSelect={account => {
                      setAccountName(account.name);
                      setNewPayment({ ...newPayment, accountId: account.id });
                    }}
                    placeholder="Search for an account"
                  />
                </View>
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <NumberInput
                    value={newPayment.amount}
                    onChangeValue={amount => setNewPayment({ ...newPayment, amount })}
                    placeholder="0.00"
                  />
                </View>
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Receipt Number (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPayment.receiptNumber}
                    onChangeText={receiptNumber => setNewPayment({ ...newPayment, receiptNumber })}
                    placeholder="e.g., 98765"
                  />
                </View>
                <View style={styles.formSection}>
                  <Text style={styles.inputLabel}>Description (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPayment.description}
                    onChangeText={description => setNewPayment({ ...newPayment, description })}
                    placeholder="e.g., Payment for invoice #123"
                  />
                </View>
              </ScrollView>
              <View style={styles.formActions}>
                <TouchableOpacity onPress={resetForm} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddPayment} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Add Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Card>
      <ConfirmModal
        visible={isConfirmModalVisible}
        title="Delete Payment"
        message={`Are you sure you want to delete the payment of ${formatIndianCurrency(paymentToDelete?.amount)} from ${paymentToDelete ? getAccountNameById(paymentToDelete.accountId) : ''}?`}
        onCancel={() => {
          setIsConfirmModalVisible(false);
          setPaymentToDelete(null);
        }}
        onConfirm={performDelete}
        confirmText="Delete"
        isDestructive={true}
      />
    </>
  );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
    subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 16 },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', padding: 12, borderRadius: 8, marginBottom: 16 },
    addButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
    paymentsList: { gap: 8 },
    noDataText: { fontSize: 14, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', paddingVertical: 16 },
    paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 },
    paymentInfo: { flex: 1 },
    accountName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
    receiptNumber: { fontSize: 12, color: '#2563eb', fontStyle: 'italic' },
    paymentDescription: { fontSize: 12, color: '#6b7280' },
    paymentAmount: { fontSize: 14, fontWeight: '700', color: '#059669', marginHorizontal: 12 },
    removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
    summarySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, marginTop: 16 },
    summaryLabel: { fontSize: 14, fontWeight: '600', color: '#1e40af' },
    summaryValue: { fontSize: 16, fontWeight: '700', color: '#1e40af' },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
    closeButton: { padding: 4 },
    formScrollView: { maxHeight: 400 },
    formSection: { paddingHorizontal: 20, paddingTop: 16 },
    inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
    textInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 },
    formActions: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
    cancelButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
    cancelButtonText: { fontSize: 14, fontWeight: '500', color: '#374151' },
    saveButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
    saveButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
});
