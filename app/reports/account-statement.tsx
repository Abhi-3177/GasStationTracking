import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react-native';

import { AccountAutocomplete } from '../../components/AccountAutocomplete';
import { DayRangePicker } from '../../components/DayRangePicker';
import { FilterButtons } from '../../components/FilterButtons';
import { Card } from '../../components/Card';
import { getAllAccounts, getFilteredAccountTransactions } from '../../utils/database';
import { Account, Transaction } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { formatIndianCurrency } from '../../utils/formatters';

type TransactionTypeFilter = 'all' | 'debit' | 'credit';

// FIFO Settlement Logic
const processTransactionsWithSettlement = (transactions: Transaction[]): Transaction[] => {
  let availableCredit = transactions
    .filter(tx => tx.type === 'credit')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return transactions.map(tx => {
    if (tx.type === 'debit' && availableCredit > 0) {
      const amountToSettle = Math.min(availableCredit, tx.amount);
      availableCredit -= amountToSettle;

      if (amountToSettle >= tx.amount) {
        return { ...tx, settlementStatus: 'fully-settled', settledAmount: tx.amount };
      } else {
        return { ...tx, settlementStatus: 'partially-settled', settledAmount: amountToSettle };
      }
    }
    return { ...tx, settlementStatus: 'unsettled', settledAmount: 0 };
  });
};

export default function AccountStatementScreen() {
  const { showNotification } = useNotification();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountNameQuery, setAccountNameQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  const [transactionType, setTransactionType] = useState<TransactionTypeFilter>('all');
  const [reportData, setReportData] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const fetchedAccounts = await getAllAccounts();
        setAccounts(fetchedAccounts);
      } catch (error: any) {
        showNotification('Failed to load accounts.', 'error');
      }
    };
    fetchAccounts();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedAccount) {
      showNotification('Please select an account.', 'error');
      return;
    }
    setIsLoading(true);
    setHasGenerated(true);
    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');
      const transactions = await getFilteredAccountTransactions(selectedAccount.id, startDate, endDate);
      
      const settledTransactions = processTransactionsWithSettlement(transactions);

      const filtered = settledTransactions.filter(tx => {
        if (transactionType === 'all') return true;
        return tx.type === transactionType;
      });

      setReportData(filtered);
    } catch (error: any) {
      showNotification(`Failed to generate report: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    const date = new Date(item.date);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + timezoneOffset);

    return (
      <View style={styles.row}>
        <Text style={styles.dateCell}>{format(adjustedDate, 'dd/MM/yy')}</Text>
        <View style={styles.descriptionCell}>
            <Text style={styles.descriptionText}>{item.description}</Text>
            {item.settlementStatus === 'fully-settled' && (
                <View style={[styles.badge, styles.settledBadge]}>
                    <CheckCircle size={12} color="#059669" />
                    <Text style={styles.badgeText}>Settled</Text>
                </View>
            )}
            {item.settlementStatus === 'partially-settled' && (
                <View style={[styles.badge, styles.partialBadge]}>
                    <Text style={styles.badgeText}>Partial ({formatIndianCurrency(item.settledAmount)})</Text>
                </View>
            )}
        </View>
        <Text style={[styles.amountCell, isCredit ? styles.creditText : styles.debitText]}>
          {formatIndianCurrency(item.amount)}
        </Text>
      </View>
    );
  };

  const { totalDebit, totalCredit } = useMemo(() => {
    return reportData.reduce(
      (acc, tx) => {
        if (tx.type === 'debit') acc.totalDebit += tx.amount;
        if (tx.type === 'credit') acc.totalCredit += tx.amount;
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 }
    );
  }, [reportData]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <FlatList
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <Card style={styles.filterCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account</Text>
                <AccountAutocomplete
                  accounts={accounts}
                  value={accountNameQuery}
                  onValueChange={setAccountNameQuery}
                  onAccountSelect={(acc) => {
                    setAccountNameQuery(acc.name);
                    setSelectedAccount(acc);
                  }}
                  placeholder="Select an account"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date Range</Text>
                <DayRangePicker range={dateRange} onRangeChange={setDateRange} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Transaction Type</Text>
                <FilterButtons
                  options={['All', 'Debits', 'Credits']}
                  values={['all', 'debit', 'credit']}
                  selectedValue={transactionType}
                  onSelect={val => setTransactionType(val as TransactionTypeFilter)}
                />
              </View>
              <TouchableOpacity style={styles.generateButton} onPress={handleGenerateReport} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>Generate Report</Text>}
              </TouchableOpacity>
            </Card>
          }
          data={reportData}
          renderItem={renderTransactionItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponentStyle={{ marginBottom: 16 }}
          ListEmptyComponent={
            hasGenerated && !isLoading ? (
              <Card style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No transactions found for the selected criteria.</Text>
              </Card>
            ) : null
          }
          ListFooterComponent={
            reportData.length > 0 ? (
                <Card style={styles.summaryCard}>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Debits:</Text><Text style={styles.debitText}>{formatIndianCurrency(totalDebit)}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Credits:</Text><Text style={styles.creditText}>{formatIndianCurrency(totalCredit)}</Text></View>
                    <View style={[styles.summaryRow, styles.netRow]}><Text style={styles.netLabel}>Net Change:</Text><Text style={[styles.netValue, (totalCredit - totalDebit) < 0 && styles.debitText]}>{formatIndianCurrency(totalCredit - totalDebit)}</Text></View>
                </Card>
            ) : null
          }
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  listContainer: { padding: 16 },
  filterCard: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151' },
  generateButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  generateButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', alignItems: 'center' },
  dateCell: { width: 80, color: '#6b7280' },
  descriptionCell: { flex: 1, gap: 4 },
  descriptionText: { color: '#374151' },
  amountCell: { width: 120, textAlign: 'right', fontWeight: '600' },
  creditText: { color: '#059669' },
  debitText: { color: '#dc2626' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280' },
  summaryCard: { marginTop: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  netRow: { borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 8, marginTop: 8 },
  netLabel: { fontSize: 16, fontWeight: '700' },
  netValue: { fontSize: 16, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  settledBadge: { backgroundColor: '#ecfdf5' },
  partialBadge: { backgroundColor: '#fffbeb' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#065f46' },
});
