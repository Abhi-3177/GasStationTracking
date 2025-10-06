import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Coins, Plus, Trash2, X } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { DailyRecordData, CommissionEntry } from '../types/daybook';

interface CommissionPaidRecordProps {
  dailyRecord: DailyRecordData;
  onUpdateDailyRecord: (updates: Partial<DailyRecordData>) => void;
}

export function CommissionPaidRecord({ dailyRecord, onUpdateDailyRecord }: CommissionPaidRecordProps) {
  const [showForm, setShowForm] = useState(false);
  const [newCommission, setNewCommission] = useState<Omit<CommissionEntry, 'id'>>({
    type: 'gas',
    description: '',
    amount: 0,
    date: dailyRecord.date,
  });

  const addCommission = () => {
    const commission: CommissionEntry = {
      id: Date.now().toString(),
      ...newCommission,
    };
    
    const updatedCommissions = [...dailyRecord.commissionPaid, commission];
    onUpdateDailyRecord({ commissionPaid: updatedCommissions });
    
    setNewCommission({
      type: 'gas',
      description: '',
      amount: 0,
      date: dailyRecord.date,
    });
    setShowForm(false);
  };

  const removeCommission = (commissionId: string) => {
    const updatedCommissions = dailyRecord.commissionPaid.filter(c => c.id !== commissionId);
    onUpdateDailyRecord({ commissionPaid: updatedCommissions });
  };

  const totalCommission = dailyRecord.commissionPaid.reduce((sum, c) => sum + c.amount, 0);

  return (
    <Card>
      <View style={styles.header}>
        <Coins size={20} color="#f59e0b" />
        <Text style={styles.title}>Commission Paid Records</Text>
      </View>

      <View style={styles.headerSection}>
        <Text style={styles.subtitle}>Record commission payments made today</Text>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={styles.addButton}
        >
          <Plus size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Commission</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.commissionsSection}>
        {dailyRecord.commissionPaid.length === 0 ? (
          <Text style={styles.noDataText}>No commission payments recorded today</Text>
        ) : (
          dailyRecord.commissionPaid.map(commission => (
            <View key={commission.id} style={styles.commissionRow}>
              <View style={styles.commissionInfo}>
                <Text style={styles.commissionDescription}>{commission.description}</Text>
                <Text style={styles.commissionType}>
                  {commission.type === 'gas' ? 'Gas Commission' : 'Veneer Commission'}
                </Text>
              </View>
              
              <Text style={styles.commissionAmount}>₹{commission.amount.toFixed(2)}</Text>
              
              <TouchableOpacity
                onPress={() => removeCommission(commission.id)}
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
          <Text style={styles.summaryLabel}>Total Commission Paid:</Text>
          <Text style={styles.summaryValue}>₹{totalCommission.toFixed(2)}</Text>
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
              <Text style={styles.modalTitle}>Add Commission Payment</Text>
              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Commission Type</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      newCommission.type === 'gas' && styles.typeButtonActive,
                    ]}
                    onPress={() => setNewCommission({ ...newCommission, type: 'gas' })}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      newCommission.type === 'gas' && styles.typeButtonTextActive,
                    ]}>
                      Gas Commission
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      newCommission.type === 'veneer' && styles.typeButtonActive,
                    ]}
                    onPress={() => setNewCommission({ ...newCommission, type: 'veneer' })}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      newCommission.type === 'veneer' && styles.typeButtonTextActive,
                    ]}>
                      Veneer Commission
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCommission.description}
                  onChangeText={(text) => setNewCommission({ ...newCommission, description: text })}
                  placeholder="Commission description"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <NumberInput
                  value={newCommission.amount}
                  onChangeValue={(value) => setNewCommission({ ...newCommission, amount: value })}
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
                onPress={addCommission}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Add Commission</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  commissionsSection: {
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  commissionInfo: {
    flex: 1,
  },
  commissionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  commissionType: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  commissionAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
    marginRight: 12,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  summarySection: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
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
    marginBottom: 20,
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
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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
    backgroundColor: '#f59e0b',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  typeButtonTextActive: {
    color: '#ffffff',
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
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
