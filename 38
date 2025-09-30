import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { DollarSign, Plus, Trash2, X, CheckCircle } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { DailyRecordData, CashInHandEntry, Account } from '../types/daybook';

interface CashInHandRecordProps {
  dailyRecord: DailyRecordData;
  accounts: Account[];
  onUpdateDailyRecord: (updates: Partial<DailyRecordData>) => void;
}

export function CashInHandRecord({ dailyRecord, accounts, onUpdateDailyRecord }: CashInHandRecordProps) {
  const [showForm, setShowForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [newCashEntry, setNewCashEntry] = useState<Omit<CashInHandEntry, 'id'>>({
    accountId: '',
    amount: 0,
    date: dailyRecord.date,
    transactionId: '',
    reconciled: false,
  });

  const addCashEntry = () => {
    if (!newCashEntry.accountId) {
      alert('Please select an account');
      return;
    }

    const cashEntry: CashInHandEntry = {
      id: Date.now().toString(),
      ...newCashEntry,
    };
    
    const updatedCashInHand = [...dailyRecord.cashInHand, cashEntry];
    onUpdateDailyRecord({ cashInHand: updatedCashInHand });
    
    setNewCashEntry({
      accountId: '',
      amount: 0,
      date: dailyRecord.date,
      transactionId: '',
      reconciled: false,
    });
    setAccountName('');
    setShowForm(false);
  };

  const removeCashEntry = (entryId: string) => {
    const updatedCashInHand = dailyRecord.cashInHand.filter(e => e.id !== entryId);
    onUpdateDailyRecord({ cashInHand: updatedCashInHand });
  };

  const toggleReconciliation = (entryId: string) => {
    const updatedCashInHand = dailyRecord.cashInHand.map(entry =>
      entry.id === entryId ? { ...entry, reconciled: !entry.reconciled } : entry
    );
    onUpdateDailyRecord({ cashInHand: updatedCashInHand });
  };

  const getAccountNameById = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  const totalCashInHand = dailyRecord.cashInHand.reduce((sum, e) => sum + e.amount, 0);
  const reconciledAmount = dailyRecord.cashInHand
    .filter(e => e.reconciled)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <Card>
      <View style={styles.header}>
        <DollarSign size={20} color="#059669" />
        <Text style={styles.title}>Cash in Hand Section</Text>
      </View>

      <View style={styles.headerSection}>
        <Text style={styles.subtitle}>Record money received from Factories/Transporters</Text>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={styles.addButton}
        >
          <Plus size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Cash Receipt</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cashEntriesSection}>
        {dailyRecord.cashInHand.length === 0 ? (
          <Text style={styles.noDataText}>No cash receipts recorded today</Text>
        ) : (
          dailyRecord.cashInHand.map(entry => (
            <View key={entry.id} style={styles.cashEntryRow}>
              <View style={styles.cashEntryInfo}>
                <Text style={styles.accountName}>{getAccountNameById(entry.accountId)}</Text>
                <Text style={styles.entryDetails}>
                  Amount: ₹{entry.amount.toFixed(2)}
                </Text>
                {entry.transactionId && (
                  <Text style={styles.transactionId}>TXN: {entry.transactionId}</Text>
                )}
              </View>
              
              <TouchableOpacity
                onPress={() => toggleReconciliation(entry.id)}
                style={[
                  styles.reconcileButton,
                  entry.reconciled && styles.reconcileButtonActive,
                ]}
              >
                <CheckCircle 
                  size={16} 
                  color={entry.reconciled ? '#ffffff' : '#6b7280'} 
                />
                <Text style={[
                  styles.reconcileButtonText,
                  entry.reconciled && styles.reconcileButtonTextActive,
                ]}>
                  {entry.reconciled ? 'Reconciled' : 'Pending'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => removeCashEntry(entry.id)}
                style={styles.removeButton}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Cash Received:</Text>
          <Text style={styles.summaryValue}>₹{totalCashInHand.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Reconciled Amount:</Text>
          <Text style={styles.summaryValue}>₹{reconciledAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pending Reconciliation:</Text>
          <Text style={[styles.summaryValue, styles.pendingValue]}>
            ₹{(totalCashInHand - reconciledAmount).toFixed(2)}
          </Text>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showForm}
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Cash Receipt</Text>
              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Account Name</Text>
                  <AccountAutocomplete
                    accounts={accounts}
                    value={accountName}
                    onValueChange={setAccountName}
                    onAccountSelect={(account) => {
                      setAccountName(account.name);
                      setNewCashEntry({ ...newCashEntry, accountId: account.id });
                    }}
                    placeholder="Search for an account"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <NumberInput
                    value={newCashEntry.amount}
                    onChangeValue={(value) => setNewCashEntry({ ...newCashEntry, amount: value })}
                    placeholder="0.00"
                    precision={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Transaction ID (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newCashEntry.transactionId}
                    onChangeText={(text) => setNewCashEntry({ ...newCashEntry, transactionId: text })}
                    placeholder="Transaction reference"
                  />
                </View>
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  onPress={() => setShowForm(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addCashEntry}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>Add Receipt</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  cashEntriesSection: {
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  cashEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  cashEntryInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  entryDetails: {
    fontSize: 12,
    color: '#059669',
    marginBottom: 2,
  },
  transactionId: {
    fontSize: 12,
    color: '#6b7280',
  },
  reconcileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
  },
  reconcileButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  reconcileButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  reconcileButtonTextActive: {
    color: '#ffffff',
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  summarySection: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  pendingValue: {
    color: '#dc2626',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  formSection: {
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
  formActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
