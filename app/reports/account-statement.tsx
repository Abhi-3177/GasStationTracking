import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react-native';

import { AccountAutocomplete } from '../../components/AccountAutocomplete';
import { DayRangePicker } from '../../components/DayRangePicker';
import { FilterButtons } from '../../components/FilterButtons';
import { Card } from '../../components/Card';
import { getAccountsWithLastPayment, getTransactionsForAccount } from '../../utils/database';
import { Account, Transaction } from '../../types/daybook';
import { useNotification } from '../../context/NotificationContext';
import { formatIndianCurrency } from '../../utils/formatters';

type TransactionTypeFilter = 'all' | 'debit' | 'credit';

// FIFO Settlement Logic (Note: This is a simplified view for the report period)
const processTransactionsWithSettlement = (transactions: Transaction[]): Transaction[] => {
  let availableCredit = transactions
    .filter(tx => tx.type === 'credit')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return transactions.map(tx => {
    if (tx.type === 'debit' && availableCredit > 0) {
      const amountToSettle = Math.min(availableCredit, tx.amount);
      availableCredit -= amountToSettle;

      if (amountToSettle >= tx.amount - 0.01) { // Use a small tolerance for float issues
        return { ...tx, settlementStatus: 'fully-settled', settledAmount: tx.amount };
      } else if (amountToSettle > 0) {
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
  const [reportSummary, setReportSummary] = useState({
    openingBalance: 0,
    totalCredit: 0,
    totalDebit: 0,
    closingBalance: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const fetchedAccounts = await getAccountsWithLastPayment();
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
      
      const allTransactions = await getTransactionsForAccount(selectedAccount.id);

      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      let openingBalance = 0;
      for (const tx of allTransactions) {
          const txDate = new Date(tx.date).getTime();
          if (txDate < start) {
              openingBalance += tx.type === 'credit' ? tx.amount : -tx.amount;
          }
      }

      let runningBalance = openingBalance;
      const transactionsInPeriod = allTransactions
          .filter(tx => {
              const txDate = new Date(tx.date).getTime();
              return txDate >= start && txDate <= end;
          })
          .map(tx => {
              runningBalance += tx.type === 'credit' ? tx.amount : -tx.amount;
              return { ...tx, runningBalance };
          });

      const settledTransactions = processTransactionsWithSettlement(transactionsInPeriod);

      const filteredData = settledTransactions.filter(tx => {
        if (transactionType === 'all') return true;
        return tx.type === transactionType;
      });

      setReportData(filteredData);

      const { totalCredit, totalDebit } = transactionsInPeriod.reduce(
        (acc, tx) => {
          if (tx.type === 'debit') acc.totalDebit += tx.amount;
          if (tx.type === 'credit') acc.totalCredit += tx.amount;
          return acc;
        },
        { totalDebit: 0, totalCredit: 0 }
      );
      
      setReportSummary({
        openingBalance,
        totalCredit,
        totalDebit,
        closingBalance: runningBalance,
      });

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
        <Text style={[styles.cell, { width: '15%' }]}>{format(adjustedDate, 'dd/MM/yy')}</Text>
        <View style={[styles.cell, { width: '30%', flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' }]}>
            <Text style={styles.descriptionText} numberOfLines={1} ellipsizeMode="tail">
              {item.description}
            </Text>
            {item.settlementStatus === 'fully-settled' && (
                <View style={[styles.badge, styles.settledBadge]}>
                    <CheckCircle size={12} color="#059669" />
                </View>
            )}
            {item.settlementStatus === 'partially-settled' && (
                <View style={[styles.badge, styles.partialBadge]}>
                    <Text style={styles.badgeText}>P</Text>
                </View>
            )}
        </View>
        <Text style={[styles.cell, styles.amountCell, styles.creditText, { width: '18%' }]}>
          {isCredit ? formatIndianCurrency(item.amount) : ''}
        </Text>
        <Text style={[styles.cell, styles.amountCell, styles.debitText, { width: '18%' }]}>
          {!isCredit ? formatIndianCurrency(item.amount) : ''}
        </Text>
        <Text style={[styles.cell, styles.balanceCell, (item.runningBalance || 0) < 0 && styles.debitText, { width: '19%' }]}>
          {formatIndianCurrency(item.runningBalance)}
        </Text>
      </View>
    );
  };
  
  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, { width: '15%' }]}>Date</Text>
      <Text style={[styles.headerText, { width: '30%' }]}>Description</Text>
      <Text style={[styles.headerText, { width: '18%', textAlign: 'right' }]}>Credit</Text>
      <Text style={[styles.headerText, { width: '18%', textAlign: 'right' }]}>Debit</Text>
      <Text style={[styles.headerText, { width: '19%', textAlign: 'right' }]}>Balance</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
            <Card style={styles.filterCard}>
              <View style={styles.filterRow}>
                <View style={[styles.inputGroup, { flex: 2, zIndex: 3 }]}>
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
                <View style={[styles.inputGroup, { flex: 3, zIndex: 2 }]}>
                  <Text style={styles.label}>Date Range</Text>
                  <DayRangePicker range={dateRange} onRangeChange={setDateRange} />
                </View>
                <View style={[styles.inputGroup, { flex: 2, zIndex: 1 }]}>
                  <Text style={styles.label}>Transaction Type</Text>
                  <FilterButtons
                    options={['All', 'Debits', 'Credits']}
                    values={['all', 'debit', 'credit']}
                    selectedValue={transactionType}
                    onSelect={val => setTransactionType(val as TransactionTypeFilter)}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.generateButton} onPress={handleGenerateReport} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>Generate Report</Text>}
              </TouchableOpacity>
            </Card>

            {hasGenerated && (
                <View style={styles.tableContainer}>
                    <FlatList
                    data={reportData}
                    renderItem={renderTransactionItem}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    ListHeaderComponent={renderHeader}
                    stickyHeaderIndices={[0]}
                    ListEmptyComponent={
                        !isLoading ? (
                        <Card style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No transactions found for the selected criteria.</Text>
                        </Card>
                        ) : null
                    }
                    ListFooterComponent={
                        reportData.length > 0 ? (
                            <Card style={styles.summaryCard}>
                                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Opening Balance:</Text><Text style={styles.summaryValue}>{formatIndianCurrency(reportSummary.openingBalance)}</Text></View>
                                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Credits:</Text><Text style={[styles.summaryValue, styles.creditText]}>{formatIndianCurrency(reportSummary.totalCredit)}</Text></View>
                                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Debits:</Text><Text style={[styles.summaryValue, styles.debitText]}>{formatIndianCurrency(reportSummary.totalDebit)}</Text></View>
                                <View style={[styles.summaryRow, styles.netRow]}><Text style={styles.netLabel}>Closing Balance:</Text><Text style={[styles.netValue, reportSummary.closingBalance < 0 && styles.debitText]}>{formatIndianCurrency(reportSummary.closingBalance)}</Text></View>
                            </Card>
                        ) : null
                    }
                    />
                </View>
            )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 16 },
  filterCard: { gap: 16 },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    zIndex: 10, // Ensure dropdowns appear over the button below
  },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151' },
  generateButton: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  generateButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  tableContainer: { flex: 1, marginTop: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 12, backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  headerText: { fontWeight: '600', color: '#475569', fontSize: 12, paddingHorizontal: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#fff' },
  cell: { paddingVertical: 12, paddingHorizontal: 4, fontSize: 14 },
  descriptionText: { color: '#374151', fontSize: 14, fontWeight: '500', flexShrink: 1 },
  amountCell: { textAlign: 'right', fontWeight: '500' },
  balanceCell: { textAlign: 'right', fontWeight: '600' },
  creditText: { color: '#059669' },
  debitText: { color: '#dc2626' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280' },
  summaryCard: { borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  netRow: { borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 8, marginTop: 8 },
  netLabel: { fontSize: 16, fontWeight: '700' },
  netValue: { fontSize: 16, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, flexShrink: 0 },
  settledBadge: { backgroundColor: '#ecfdf5' },
  partialBadge: { backgroundColor: '#fffbeb' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#a16207' },
});
