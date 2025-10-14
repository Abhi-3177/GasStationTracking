import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Users, Plus, Eye, Edit, Trash2, CalendarDays } from 'lucide-react-native';
import { differenceInDays, format } from 'date-fns';

import { Card } from '../../components/Card';
import { AccountForm } from '../../components/AccountForm';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Account } from '../../types/daybook';
import { getAccountsForDisplay, deleteAccount } from '../../utils/database';
import { useNotification } from '../../context/NotificationContext';
import { useData } from '../../context/DataContext';
import { formatIndianCurrency } from '../../utils/formatters';

type ActiveTab = 'factory' | 'transporter';

export default function AccountsScreen() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const { dataVersion } = useData();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('factory');

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedAccounts = await getAccountsForDisplay();
      setAccounts(fetchedAccounts);
    } catch (error: any) {
      showNotification(`Error loading accounts: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts, dataVersion])
  );

  const handleAddAccount = () => {
    setSelectedAccount(null);
    setIsFormVisible(true);
  };

  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setIsFormVisible(true);
  };

  const handleDeleteAccount = (account: Account) => {
    setAccountToDelete(account);
  };

  const performDelete = async () => {
    if (!accountToDelete) return;
    try {
      await deleteAccount(accountToDelete.id);
      showNotification(`Account "${accountToDelete.name}" deleted successfully.`, 'success');
      setAccountToDelete(null);
      loadAccounts();
    } catch (error: any) {
      showNotification(`Error deleting account: ${error.message}`, 'error');
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => acc.type === activeTab);
  }, [accounts, activeTab]);

  const overallBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  }, [accounts]);

  const renderAccountCard = ({ item }: { item: Account }) => {
    const balance = item.currentBalance ?? 0;
    const daysSinceLastPayment = item.lastPaymentDate ? differenceInDays(new Date(), new Date(item.lastPaymentDate)) : null;

    let paymentStatusColor = '#6b7280'; // Gray for no payment
    if (daysSinceLastPayment !== null) {
        if (daysSinceLastPayment <= 7) paymentStatusColor = '#059669'; // Green
        else if (daysSinceLastPayment <= 30) paymentStatusColor = '#f59e0b'; // Yellow
        else paymentStatusColor = '#dc2626'; // Red
    }

    return (
      <Card style={styles.accountCard}>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{item.name}</Text>
          <Text style={styles.accountType}>{item.type}</Text>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={[styles.balanceValue, balance < 0 && styles.negativeBalance]}>
            {formatIndianCurrency(balance)}
          </Text>
        </View>
        
        <View style={styles.lastPaymentContainer}>
            <View style={[styles.paymentBadge, { backgroundColor: `${paymentStatusColor}1A`, borderColor: paymentStatusColor }]}>
                <CalendarDays size={14} color={paymentStatusColor} />
                <Text style={[styles.lastPaymentText, { color: paymentStatusColor }]}>
                    {item.lastPaymentDate 
                        ? `Last paid: ${daysSinceLastPayment === 0 ? 'today' : `${daysSinceLastPayment}d ago`} (${format(new Date(item.lastPaymentDate), 'dd/MM/yy')})`
                        : 'No payments recorded'}
                </Text>
            </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push(`/account/${item.id}`)}>
            <Eye size={16} color="#1d4ed8" />
            <Text style={styles.actionButtonText}>Ledger</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleEditAccount(item)}>
            <Edit size={16} color="#16a34a" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteAccount(item)}>
            <Trash2 size={16} color="#dc2626" />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Users size={24} color="#1f2937" />
            <Text style={styles.headerTitle}>Accounts ({filteredAccounts.length})</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddAccount}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addButtonText}>Add Account</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredAccounts}
          renderItem={renderAccountCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <>
                <Card style={styles.overallBalanceCard}>
                    <Text style={styles.overallBalanceLabel}>Overall Outstanding Balance</Text>
                    <Text style={[styles.overallBalanceValue, overallBalance < 0 && styles.negativeBalance]}>
                        {formatIndianCurrency(overallBalance)}
                    </Text>
                </Card>
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'factory' && styles.activeTabButton]}
                        onPress={() => setActiveTab('factory')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'factory' && styles.activeTabButtonText]}>Factories</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'transporter' && styles.activeTabButton]}
                        onPress={() => setActiveTab('transporter')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'transporter' && styles.activeTabButtonText]}>Transporters</Text>
                    </TouchableOpacity>
                </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab} accounts found.</Text>
              <Text style={styles.emptySubtext}>Tap "Add Account" to get started.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadAccounts} tintColor="#2563eb" />
          }
        />

        <AccountForm
          visible={isFormVisible}
          onClose={() => setIsFormVisible(false)}
          onSave={() => {
            setIsFormVisible(false);
            loadAccounts();
          }}
          account={selectedAccount}
          defaultType={activeTab}
        />

        {accountToDelete && (
          <ConfirmModal
            visible={!!accountToDelete}
            title="Delete Account"
            message={`Are you sure you want to delete the account "${accountToDelete.name}"? This action is irreversible.`}
            onCancel={() => setAccountToDelete(null)}
            onConfirm={performDelete}
            confirmText="Delete"
            isDestructive
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  listContainer: { padding: 16, gap: 12 },
  overallBalanceCard: {
    marginBottom: 16,
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
    borderWidth: 1,
  },
  overallBalanceLabel: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '600',
  },
  overallBalanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1d4ed8',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  activeTabButtonText: {
    color: '#2563eb',
  },
  accountCard: { padding: 0, overflow: 'hidden' },
  accountInfo: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  accountName: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  accountType: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize', marginTop: 4 },
  balanceContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  balanceLabel: { fontSize: 14, color: '#6b7280' },
  balanceValue: { fontSize: 22, fontWeight: '700', color: '#059669', marginTop: 4 },
  negativeBalance: { color: '#dc2626' },
  lastPaymentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  lastPaymentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: { flexDirection: 'row', backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6 },
  actionButtonText: { fontSize: 14, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, padding: 20 },
  emptyText: { fontSize: 18, color: '#6b7280', fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8 },
});
