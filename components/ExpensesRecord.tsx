import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Receipt, Plus, Trash2, X } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { DailyRecordData, ExpenseEntry } from '../types/daybook';

interface ExpensesRecordProps {
  dailyRecord: DailyRecordData;
  onUpdateDailyRecord: (updates: Partial<DailyRecordData>) => void;
}

export function ExpensesRecord({ dailyRecord, onUpdateDailyRecord }: ExpensesRecordProps) {
  const [showForm, setShowForm] = useState(false);
  const [newExpense, setNewExpense] = useState<Omit<ExpenseEntry, 'id'>>({
    category: 'gas',
    description: '',
    amount: 0,
    date: dailyRecord.date,
  });

  const addExpense = () => {
    const expense: ExpenseEntry = {
      id: Date.now().toString(),
      ...newExpense,
    };
    
    const updatedExpenses = [...dailyRecord.expenses, expense];
    onUpdateDailyRecord({ expenses: updatedExpenses });
    
    setNewExpense({
      category: 'gas',
      description: '',
      amount: 0,
      date: dailyRecord.date,
    });
    setShowForm(false);
  };

  const removeExpense = (expenseId: string) => {
    const updatedExpenses = dailyRecord.expenses.filter(e => e.id !== expenseId);
    onUpdateDailyRecord({ expenses: updatedExpenses });
  };

  const totalExpenses = dailyRecord.expenses.reduce((sum, e) => sum + e.amount, 0);
  const expensesByCategory = dailyRecord.expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'gas': return 'Gas';
      case 'veneer': return 'Veneer';
      case 'other': return 'Other';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'gas': return '#2563eb';
      case 'veneer': return '#7c3aed';
      case 'other': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <Receipt size={20} color="#dc2626" />
        <Text style={styles.title}>Expenses Records</Text>
      </View>

      <View style={styles.headerSection}>
        <Text style={styles.subtitle}>Record daily expenses by category</Text>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          style={styles.addButton}
        >
          <Plus size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.expensesSection}>
        {dailyRecord.expenses.length === 0 ? (
          <Text style={styles.noDataText}>No expenses recorded today</Text>
        ) : (
          dailyRecord.expenses.map(expense => (
            <View key={expense.id} style={styles.expenseRow}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDescription}>{expense.description}</Text>
                <Text style={[
                  styles.expenseCategory,
                  { color: getCategoryColor(expense.category) }
                ]}>
                  {getCategoryLabel(expense.category)} Expense
                </Text>
              </View>
              
              <Text style={styles.expenseAmount}>₹{expense.amount.toFixed(2)}</Text>
              
              <TouchableOpacity
                onPress={() => removeExpense(expense.id)}
                style={styles.removeButton}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.summarySection}>
        {Object.entries(expensesByCategory).map(([category, amount]) => (
          <View key={category} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{getCategoryLabel(category)} Expenses:</Text>
            <Text style={styles.summaryValue}>₹{amount.toFixed(2)}</Text>
          </View>
        ))}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Expenses:</Text>
          <Text style={styles.totalValue}>₹{totalExpenses.toFixed(2)}</Text>
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
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Expense Category</Text>
                <View style={styles.categorySelector}>
                  {['gas', 'veneer', 'other'].map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        newExpense.category === category && styles.categoryButtonActive,
                        { backgroundColor: newExpense.category === category ? getCategoryColor(category) : '#f3f4f6' }
                      ]}
                      onPress={() => setNewExpense({ ...newExpense, category: category as any })}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        newExpense.category === category && styles.categoryButtonTextActive,
                      ]}>
                        {getCategoryLabel(category)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={newExpense.description}
                  onChangeText={(text) => setNewExpense({ ...newExpense, description: text })}
                  placeholder="Expense description"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <NumberInput
                  value={newExpense.amount}
                  onChangeValue={(value) => setNewExpense({ ...newExpense, amount: value })}
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
                onPress={addExpense}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Add Expense</Text>
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
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  expensesSection: {
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  expenseCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    marginRight: 12,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  summarySection: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
  },
  totalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dc2626',
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991b1b',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
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
  categorySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  categoryButtonActive: {
    // backgroundColor handled dynamically
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoryButtonTextActive: {
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
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
