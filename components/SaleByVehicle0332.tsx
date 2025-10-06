import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { Truck, Plus, Trash2, X, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { DayBookRecord, DailyRecordData, SaleByVehicleEntry, Account } from '../types/daybook';

interface SaleByVehicle0332Props {
  dayBookRecord: DayBookRecord;
  dailyRecord: DailyRecordData;
  accounts: Account[];
  onUpdateDailyRecord: (updates: Partial<DailyRecordData>) => void;
}

export function SaleByVehicle0332({ 
  dayBookRecord, 
  dailyRecord, 
  accounts, 
  onUpdateDailyRecord 
}: SaleByVehicle0332Props) {
  const [showForm, setShowForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [newSaleEntry, setNewSaleEntry] = useState<Omit<SaleByVehicleEntry, 'id'>>({
    accountId: '',
    vehicleNumber: '',
    litres: 0,
    amount: 0,
    reconciled: false,
  });

  const addSaleEntry = () => {
    if (!newSaleEntry.accountId) {
      alert('Please select an account');
      return;
    }

    const saleEntry: SaleByVehicleEntry = {
      id: Date.now().toString(),
      ...newSaleEntry,
    };
    
    const updatedSaleByVehicle = [...dailyRecord.saleByVehicle0332, saleEntry];
    onUpdateDailyRecord({ saleByVehicle0332: updatedSaleByVehicle });
    
    setNewSaleEntry({
      accountId: '',
      vehicleNumber: '',
      litres: 0,
      amount: 0,
      reconciled: false,
    });
    setAccountName('');
    setShowForm(false);
  };

  const removeSaleEntry = (entryId: string) => {
    const updatedSaleByVehicle = dailyRecord.saleByVehicle0332.filter(e => e.id !== entryId);
    onUpdateDailyRecord({ saleByVehicle0332: updatedSaleByVehicle });
  };

  const toggleReconciliation = (entryId: string) => {
    const updatedSaleByVehicle = dailyRecord.saleByVehicle0332.map(entry =>
      entry.id === entryId ? { ...entry, reconciled: !entry.reconciled } : entry
    );
    onUpdateDailyRecord({ saleByVehicle0332: updatedSaleByVehicle });
  };

  const getAccountNameById = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  // Calculate reconciliation
  const total0332FromDayBook = dayBookRecord.deductions.sales0332.reduce((sum, sale) => sum + sale.amount, 0);
  const totalFromDailyRecord = dailyRecord.saleByVehicle0332.reduce((sum, sale) => sum + sale.amount, 0);
  const hasMismatch = Math.abs(total0332FromDayBook - totalFromDailyRecord) > 0.01;

  return (
    <Card>
      <View style={styles.header}>
        <Truck size={20} color="#7c3aed" />
        <Text style={styles.title}>Sale by Vehicle - 0332 Section</Text>
      </View>

      {hasMismatch && (
        <View style={styles.mismatchWarning}>
          <AlertTriangle size={16} color="#f59e0b" />
          <Text style={styles.mismatchText}>
            0332 Sales mismatch: Day Book ₹{total0332FromDayBook.toFixed(2)}, 
            Daily Record ₹{totalFromDailyRecord.toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.headerSection}>
        <Text style={styles.subtitle}>Record 0332 sales by vehicle and account</Text>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={styles.addButton}
        >
          <Plus size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add 0332 Sale</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.salesSection}>
        {dailyRecord.saleByVehicle0332.length === 0 ? (
          <Text style={styles.noDataText}>No 0332 sales recorded today</Text>
        ) : (
          dailyRecord.saleByVehicle0332.map(sale => (
            <View key={sale.id} style={styles.saleRow}>
              <View style={styles.saleInfo}>
                <Text style={styles.accountName}>{getAccountNameById(sale.accountId)}</Text>
                <Text style={styles.saleDetails}>
                  Litres: {sale.litres.toFixed(2)}L | Amount: ₹{sale.amount.toFixed(2)}
                </Text>
                {sale.vehicleNumber && (
                  <Text style={styles.vehicleNumber}>Vehicle: {sale.vehicleNumber}</Text>
                )}
              </View>
              
              <TouchableOpacity
                onPress={() => toggleReconciliation(sale.id)}
                style={[
                  styles.reconcileButton,
                  sale.reconciled && styles.reconcileButtonActive,
                ]}
              >
                <CheckCircle 
                  size={16} 
                  color={sale.reconciled ? '#ffffff' : '#6b7280'} 
                />
                <Text style={[
                  styles.reconcileButtonText,
                  sale.reconciled && styles.reconcileButtonTextActive,
                ]}>
                  {sale.reconciled ? 'Reconciled' : 'Pending'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => removeSaleEntry(sale.id)}
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
          <Text style={styles.summaryLabel}>Day Book 0332 Total:</Text>
          <Text style={styles.summaryValue}>₹{total0332FromDayBook.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Daily Record Total:</Text>
          <Text style={[
            styles.summaryValue,
            hasMismatch && styles.mismatchValue
          ]}>
            ₹{totalFromDailyRecord.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Reconciled Amount:</Text>
          <Text style={styles.summaryValue}>
            ₹{dailyRecord.saleByVehicle0332
              .filter(sale => sale.reconciled)
              .reduce((sum, sale) => sum + sale.amount, 0)
              .toFixed(2)}
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
              <Text style={styles.modalTitle}>Add 0332 Sale</Text>
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
                      setNewSaleEntry({ ...newSaleEntry, accountId: account.id });
                    }}
                    placeholder="Search for an account"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Number (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newSaleEntry.vehicleNumber}
                    onChangeText={(text) => setNewSaleEntry({ ...newSaleEntry, vehicleNumber: text })}
                    placeholder="Vehicle number"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Litres</Text>
                  <NumberInput
                    value={newSaleEntry.litres}
                    onChangeValue={(value) => setNewSaleEntry({ ...newSaleEntry, litres: value })}
                    placeholder="0.00"
                    precision={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <NumberInput
                    value={newSaleEntry.amount}
                    onChangeValue={(value) => setNewSaleEntry({ ...newSaleEntry, amount: value })}
                    placeholder="0.00"
                    precision={2}
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
                  onPress={addSaleEntry}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>Add Sale</Text>
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
  mismatchWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  mismatchText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
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
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  salesSection: {
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  saleInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  saleDetails: {
    fontSize: 12,
    color: '#7c3aed',
    marginBottom: 2,
  },
  vehicleNumber: {
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
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
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
    backgroundColor: '#f5f3ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#5b21b6',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5b21b6',
  },
  mismatchValue: {
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
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
