import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ArrowUpDown, PlusCircle, Trash2, CheckCircle } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { LedgerEntryForm } from '../../components/LedgerEntryForm';
import { getAccount, getTransactionsForAccount, deleteTransaction } from '../../utils/database';
import { Account, Transaction } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { useData } from '../../context/DataContext';
import { formatIndianCurrency } from '../../utils/formatters';
import { format } from 'date-fns';

export default function AccountLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { showNotification } = useNotification();
  const { dataVersion } = useData();

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [formEntryType, setFormEntryType] = useState<'payment' | 'creditSale'>('payment');

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [acc, txs] = await Promise.all([
        getAccount(id),
        getTransactionsForAccount(id),
      ]);
      setAccount(acc);
      setTransactions(txs);
    } catch (error: any) {
      showNotification(`Error loading ledger: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, showNotification, dataVersion]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const processedTransactions = useMemo(() => {
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    return sortedTxs.map(tx => {
        runningBalance += tx.type === 'credit' ? tx.amount : -tx.amount;
        return { ...tx, runningBalance };
    });
  }, [transactions]);


  const displayTransactions = useMemo(() => {
    if (sortOrder === 'desc') {
      return [...processedTransactions].reverse();
    }
    return processedTransactions;
  }, [processedTransactions, sortOrder]);


  const handleDelete = (tx: Transaction) => {
    setTransactionToDelete(tx);
  };

  const performDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await deleteTransaction(transactionToDelete.id);
      showNotification('Transaction deleted successfully.', 'success');
      setTransactionToDelete(null);
      loadData();
    } catch (error: any) {
      showNotification(`Error deleting transaction: ${error.message}`, 'error');
    }
  };

  const handleOpenForm = (type: 'payment' | 'creditSale') => {
    setFormEntryType(type);
    setIsFormVisible(true);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ChevronLeft size={24} color="#1f2937" />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle} numberOfLines={1}>{account?.name || 'Account Ledger'}</Text>
        <Text style={styles.headerSubtitle}>{account?.type}</Text>
      </View>
      <TouchableOpacity onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} style={styles.sortButton}>
        <ArrowUpDown size={20} color="#1f2937" />
        <Text style={styles.sortButtonText}>{sortOrder === 'asc' ? 'Oldest' : 'Newest'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    const date = new Date(item.date);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + timezoneOffset);

    return (
      <View style={styles.row}>
        <View style={styles.dateAndDesc}>
            <Text style={styles.dateCell}>{format(adjustedDate, 'dd/MM/yy')}</Text>
            <Text style={styles.descriptionCell}>{item.description}</Text>
        </View>
        <View style={styles.amounts}>
            <Text style={[styles.amountCell, isCredit ? styles.creditText : styles.debitText]}>
                {isCredit ? formatIndianCurrency(item.amount) : ''}
            </Text>
            <Text style={[styles.amountCell, !isCredit ? styles.debitText : styles.creditText]}>
                {!isCredit ? formatIndianCurrency(item.amount) : ''}
            </Text>
            <Text style={[styles.balanceCell, (item.runningBalance || 0) < 0 && styles.negativeBalance]}>
              {formatIndianCurrency(item.runningBalance)}
            </Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <FlatList
          data={displayTransactions}
          renderItem={renderTransactionItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={[styles.row, styles.tableHeader]}>
                <Text style={[styles.headerText, {flex: 2}]}>Date & Description</Text>
                <View style={styles.amounts}>
                    <Text style={[styles.headerText, styles.amountCell]}>Credit</Text>
                    <Text style={[styles.headerText, styles.amountCell]}>Debit</Text>
                    <Text style={[styles.headerText, styles.balanceCell]}>Balance</Text>
                </View>
                <View style={{width: 34}} />
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions found for this account.</Text>
            </Card>
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
        />
        
        <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenForm('payment')}>
                <PlusCircle size={20} color="#059669" />
                <Text style={styles.actionButtonText}>Record Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenForm('creditSale')}>
                <PlusCircle size={20} color="#dc2626" />
                <Text style={styles.actionButtonText}>Add Credit Sale</Text>
            </TouchableOpacity>
        </View>

        {transactionToDelete && (
          <ConfirmModal
            visible={!!transactionToDelete}
            title="Delete Transaction"
            message={`Are you sure you want to delete this transaction? This action cannot be undone.`}
            onCancel={() => setTransactionToDelete(null)}
            onConfirm={performDelete}
            confirmText="Delete"
            isDestructive
          />
        )}
        
        <Modal visible={isFormVisible} animationType="slide" onRequestClose={() => setIsFormVisible(false)}>
            {account && <LedgerEntryForm account={account} entryType={formEntryType} onClose={() => setIsFormVisible(false)} onSave={() => { setIsFormVisible(false); loadData(); }} />}
        </Modal>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  backButton: { padding: 4, marginRight: 12 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, marginLeft: 12, backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8 },
  sortButtonText: { fontSize: 12, color: '#1f2937', fontWeight: '500' },
  tableHeader: { backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderColor: '#d1d5db' },
  headerText: { fontWeight: '600', color: '#475569' },
  row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', alignItems: 'center' },
  dateAndDesc: { flex: 2, gap: 2 },
  dateCell: { fontSize: 12, color: '#6b7280' },
  descriptionCell: { fontSize: 14, color: '#374151', fontWeight: '500' },
  amounts: { flex: 3, flexDirection: 'row', justifyContent: 'space-between' },
  amountCell: { width: '33%', textAlign: 'right' },
  balanceCell: { width: '33%', textAlign: 'right', fontWeight: '600' },
  creditText: { color: '#059669' },
  debitText: { color: '#dc2626' },
  negativeBalance: { color: '#dc2626' },
  deleteButton: { padding: 8, marginLeft: 8 },
  emptyContainer: { padding: 40, alignItems: 'center', margin: 16 },
  emptyText: { fontSize: 16, color: '#6b7280' },
  quickActions: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, gap: 8, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
});
