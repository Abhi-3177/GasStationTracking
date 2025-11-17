import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CheckSquare, Square, Send, Receipt } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { AccountAutocomplete } from '../../components/AccountAutocomplete';
import { getAccountsWithLastPayment, getTransactionsForAccount, markReceiptsAsSent } from '../../utils/database';
import { Account, Transaction } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { useFocusEffect } from 'expo-router';
import { formatIndianCurrency } from '../../utils/formatters';

export default function FollowUpScreen() {
  const { showNotification } = useNotification();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountNameQuery, setAccountNameQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const fetchedAccounts = await getAccountsWithLastPayment();
      setAccounts(fetchedAccounts);
    } catch (error: any) {
      showNotification('Failed to load accounts.', 'error');
    }
  }, [showNotification]);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const loadTransactions = useCallback(async () => {
    if (!selectedAccount) return;
    setIsLoading(true);
    try {
      const allTxs = await getTransactionsForAccount(selectedAccount.id);
      
      // FIFO Settlement Logic to determine unsettled transactions
      const sortedTxs = [...allTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let availableCredit = 0;
      const debitsWithSettlement = sortedTxs.map(tx => {
        if (tx.type === 'credit') {
          availableCredit += tx.amount;
          return null; // Ignore credits for the list
        }
        // It's a debit
        const settledAmount = Math.min(availableCredit, tx.amount);
        availableCredit -= settledAmount;
        
        if (settledAmount >= tx.amount) {
          return { ...tx, settlementStatus: 'fully-settled' as const };
        }
        return { ...tx, settlementStatus: 'unsettled' as const };
      }).filter((tx): tx is Transaction => tx !== null);
      
      const unsettledDebits = debitsWithSettlement.filter(tx => tx.settlementStatus !== 'fully-settled');
      setTransactions(unsettledDebits);

    } catch (error: any) {
      showNotification(`Failed to load transactions: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount, showNotification]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleSelectTransaction = (txId: string) => {
    setSelectedTxIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  const handleMarkAsSent = async () => {
    if (selectedTxIds.size === 0 || !selectedAccount) return;
    setIsMarking(true);
    try {
      const receiptsToSend = transactions
        .filter(tx => selectedTxIds.has(tx.id))
        .map(tx => ({
          transaction_id: tx.id,
          account_id: selectedAccount.id,
          receipt_number: tx.receiptNumber || null,
          amount: tx.amount,
          transaction_date: tx.date,
        }));
      
      await markReceiptsAsSent(receiptsToSend);
      showNotification(`${receiptsToSend.length} receipts marked as sent.`, 'success');
      setSelectedTxIds(new Set());
      await loadTransactions(); // Refresh to show new "Sent" status
    } catch (error: any) {
      showNotification(`Failed to mark as sent: ${error.message}`, 'error');
    } finally {
      setIsMarking(false);
    }
  };

  const selectedTransactions = useMemo(() => {
    return transactions.filter(tx => selectedTxIds.has(tx.id));
  }, [transactions, selectedTxIds]);

  const summary = useMemo(() => {
    const totalAmount = selectedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const receiptNumbers = selectedTransactions.map(tx => tx.receiptNumber).filter(Boolean);
    return {
      count: selectedTransactions.length,
      totalAmount,
      receiptNumbers,
    };
  }, [selectedTransactions]);

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isSelected = selectedTxIds.has(item.id);
    const date = new Date(item.date);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + timezoneOffset);

    return (
      <TouchableOpacity style={styles.row} onPress={() => handleSelectTransaction(item.id)}>
        <View style={{ marginRight: 12 }}>
          {isSelected ? <CheckSquare size={24} color="#2563eb" /> : <Square size={24} color="#9ca3af" />}
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDescription}>{item.description}</Text>
          <Text style={styles.txDate}>{format(adjustedDate, 'dd MMM, yyyy')}</Text>
          {item.receiptNumber && <Text style={styles.txReceipt}>Receipt: {item.receiptNumber}</Text>}
        </View>
        <View style={styles.txAmountContainer}>
          <Text style={styles.txAmount}>{formatIndianCurrency(item.amount)}</Text>
          {item.isSent && <View style={styles.sentBadge}><Text style={styles.sentBadgeText}>Sent</Text></View>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Card style={styles.filterCard}>
            <Text style={styles.label}>Select Account to Follow Up</Text>
            <AccountAutocomplete
              accounts={accounts}
              value={accountNameQuery}
              onValueChange={setAccountNameQuery}
              onAccountSelect={(acc) => {
                setAccountNameQuery(acc.name);
                setSelectedAccount(acc);
                setSelectedTxIds(new Set());
              }}
              placeholder="Search for an account"
            />
          </Card>

          {isLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          ) : selectedAccount ? (
            <FlatList
              data={transactions}
              renderItem={renderTransactionItem}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={<Text style={styles.listHeader}>Unsettled Debits</Text>}
              ListEmptyComponent={<Card style={styles.emptyCard}><Text style={styles.emptyText}>No unsettled debits for this account.</Text></Card>}
              contentContainerStyle={{ paddingBottom: 150 }}
            />
          ) : (
            <Card style={styles.emptyCard}><Text style={styles.emptyText}>Please select an account to view outstanding receipts.</Text></Card>
          )}
        </View>
        
        {summary.count > 0 && (
          <View style={styles.summaryFooter}>
            <View style={styles.summaryContent}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Selection Summary</Text>
                <View style={styles.summaryPill}><Text style={styles.summaryPillText}>{summary.count} Receipts</Text></View>
              </View>
              <Text style={styles.summaryAmount}>{formatIndianCurrency(summary.totalAmount)}</Text>
              <View style={styles.receiptChips}>
                {summary.receiptNumbers.slice(0, 5).map(rn => <View key={rn} style={styles.receiptChip}><Text style={styles.receiptChipText}>{rn}</Text></View>)}
                {summary.receiptNumbers.length > 5 && <Text style={styles.receiptChipMore}>+{summary.receiptNumbers.length - 5} more</Text>}
              </View>
              <TouchableOpacity style={[styles.sendButton, isMarking && styles.disabledButton]} onPress={handleMarkAsSent} disabled={isMarking}>
                {isMarking ? <ActivityIndicator color="#fff" /> : <Send size={16} color="#fff" />}
                <Text style={styles.sendButtonText}>Mark as Sent</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, flex: 1 },
  filterCard: { marginBottom: 16, zIndex: 10 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  listHeader: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  txInfo: { flex: 1, gap: 2 },
  txDescription: { fontSize: 14, fontWeight: '500', color: '#1f2937' },
  txDate: { fontSize: 12, color: '#6b7280' },
  txReceipt: { fontSize: 12, color: '#2563eb' },
  txAmountContainer: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  sentBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sentBadgeText: { fontSize: 10, color: '#6b7280', fontWeight: '500' },
  emptyCard: { padding: 40, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
  summaryFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 8 },
  summaryContent: { gap: 12 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryPill: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  summaryPillText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  summaryAmount: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  receiptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  receiptChip: { backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  receiptChipText: { fontSize: 12, color: '#4b5563' },
  receiptChipMore: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', padding: 14, borderRadius: 8, marginTop: 8 },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  disabledButton: { backgroundColor: '#9ca3af' },
});
