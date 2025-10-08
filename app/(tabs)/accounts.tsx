import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, Text, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Users, Plus, Edit, Trash2, X } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { AccountForm } from '../../components/AccountForm';
import { AccountLedger } from '../../components/AccountLedger';
import { Account, BalanceEntry } from '../../types/daybook';
import { getAllAccounts, saveAccount, deleteAccount } from '../../utils/database'; // <-- Switched to database

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [])
  );

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const accountsList = await getAllAccounts();
      setAccounts(accountsList);
    } catch (error: any) {
      console.error('Error loading accounts:', error);
      Alert.alert('Error', error.message || 'Failed to load accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async (accountData: Omit<Account, 'id' | 'createdAt' | 'user_id'>) => {
    try {
      const account: Account = {
        id: editingAccount?.id || `new_${Date.now()}`, // Use a temporary ID for new accounts
        user_id: '', // This will be handled by the database function
        ...accountData,
        createdAt: editingAccount?.createdAt || new Date().toISOString(),
      };
      
      await saveAccount(account);
      await loadAccounts();
      setShowForm(false);
      setEditingAccount(null);
      Alert.alert('Success', `Account ${editingAccount ? 'updated' : 'created'} successfully!`);
    } catch (error: any) {
      console.error('Error saving account:', error);
      Alert.alert('Error', error.message || 'Failed to save account.');
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleDeleteAccount = (account: Account) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete ${account.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(account.id);
              await loadAccounts();
              Alert.alert('Success', 'Account deleted successfully!');
            } catch (error: any) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', error.message || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  const handleViewLedger = (account: Account) => {
    setSelectedAccount(account);
    setShowLedger(true);
  };

  const renderAccountCard = (account: Account) => {
    const openingBalance = account.balanceEntries.reduce((acc, entry) => {
        return acc + (entry.type === 'debit' ? entry.amount : -entry.amount);
    }, 0);

    return (
        <Card key={account.id} style={styles.accountCard}>
        <View style={styles.accountHeader}>
            <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountType}>{account.type}</Text>
            {account.contact && (
                <Text style={styles.accountContact}>{account.contact}</Text>
            )}
            </View>
            <View style={styles.accountActions}>
            <TouchableOpacity
                onPress={() => handleViewLedger(account)}
                style={styles.actionButton}
            >
                <Text style={styles.actionButtonText}>Ledger</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => handleEditAccount(account)}
                style={[styles.actionButton, styles.editButton]}
            >
                <Edit size={16} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => handleDeleteAccount(account)}
                style={[styles.actionButton, styles.deleteButton]}
            >
                <Trash2 size={16} color="#dc2626" />
            </TouchableOpacity>
            </View>
        </View>
        
        {account.address && (
            <Text style={styles.accountAddress}>{account.address}</Text>
        )}
        
        <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Opening Balance:</Text>
            <Text style={[
            styles.balanceValue,
            openingBalance > 0 ? styles.negativeBalance : styles.positiveBalance
            ]}>
            ₹{Math.abs(openingBalance).toFixed(2)}
            </Text>
        </View>
        </Card>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Card>
              <View style={styles.headerSection}>
                <View style={styles.titleSection}>
                  <Users size={24} color="#2563eb" />
                  <Text style={styles.title}>Factories & Transporters</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingAccount(null);
                    setShowForm(true);
                  }}
                  style={styles.addButton}
                >
                  <Plus size={20} color="#ffffff" />
                  <Text style={styles.addButtonText}>Add Account</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.statsSection}>
                <Text style={styles.statsText}>
                  Total Accounts: {accounts.length}
                </Text>
              </View>
            </Card>

            {accounts.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No accounts created yet. Add your first factory or transporter account.
                </Text>
              </Card>
            ) : (
              accounts.map(renderAccountCard)
            )}
          </View>
        </ScrollView>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showForm}
          onRequestClose={() => {
            setShowForm(false);
            setEditingAccount(null);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingAccount ? 'Edit Account' : 'Add New Account'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowForm(false);
                    setEditingAccount(null);
                  }}
                  style={styles.closeButton}
                >
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <AccountForm
                initialData={editingAccount}
                onSave={handleSaveAccount}
                onCancel={() => {
                  setShowForm(false);
                  setEditingAccount(null);
                }}
              />
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showLedger}
          onRequestClose={() => {
            setShowLedger(false);
            setSelectedAccount(null);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Account Ledger - {selectedAccount?.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowLedger(false);
                    setSelectedAccount(null);
                  }}
                  style={styles.closeButton}
                >
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {selectedAccount && (
                <AccountLedger accountId={selectedAccount.id} />
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  accountCard: {
    padding: 16,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  accountType: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginBottom: 4,
  },
  accountContact: {
    fontSize: 14,
    color: '#6b7280',
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#eff6ff',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  accountAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  positiveBalance: {
    color: '#059669',
  },
  negativeBalance: {
    color: '#dc2626',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
});
