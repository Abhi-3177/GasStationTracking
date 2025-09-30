import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react-native';
import { format } from 'date-fns';
import { Account } from '../types/daybook';
import { getAccount, getAllDailyRecords, getAllRecords } from '../utils/database';

interface AccountLedgerProps {
  accountId: string;
}

interface LedgerEntry {
  date: string;
  type: 'credit_sale' | 'cash_received' | '0332_sale' | 'opening_balance';
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function AccountLedger({ accountId }: AccountLedgerProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLedgerData();
  }, [accountId]);

  const loadLedgerData = async () => {
    setIsLoading(true);
    try {
      const [accountData, dailyRecords, dayBookRecords] = await Promise.all([
        getAccount(accountId),
        getAllDailyRecords(),
        getAllRecords()
      ]);

      if (!accountData) {
        setIsLoading(false);
        return;
      }

      setAccount(accountData);

      const allEntries: (Omit<LedgerEntry, 'balance'> & { sortDate: Date })[] = [];

      // 1. Add initial balance entries
      for (const entry of accountData.balanceEntries || []) {
        allEntries.push({
            date: entry.date,
            sortDate: new Date(entry.date),
            type: 'opening_balance',
            description: `Opening Balance: ${entry.description}`,
            debit: entry.type === 'debit' ? entry.amount : 0,
            credit: entry.type === 'credit' ? entry.amount : 0,
        });
      }
      
      // 2. Collect all transaction dates
      const allTransactionDates = new Set<string>();
      dailyRecords.forEach(r => allTransactionDates.add(r.date));
      dayBookRecords.forEach(r => allTransactionDates.add(r.date));
      
      // 3. Add transaction entries from DayBook and DailyRecord
      for (const date of allTransactionDates) {
        const dayBook = dayBookRecords.find(r => r.date === date);
        const dailyRecord = dailyRecords.find(r => r.date === date);
        const sortDate = new Date(date);

        // From DayBook - use accountId for accurate filtering
        if (dayBook) {
          (dayBook.deductions.creditSales || []).filter(sale => sale.accountId === accountId).forEach(sale => {
            allEntries.push({
              date, sortDate, type: 'credit_sale',
              description: `Credit Sale - ${sale.litres.toFixed(2)}L ${sale.fuelType}`,
              debit: sale.amount, credit: 0,
            });
          });

          (dayBook.deductions.sales0332 || []).filter(sale => sale.accountId === accountId).forEach(sale => {
            allEntries.push({
              date, sortDate, type: '0332_sale',
              description: `0332 Sale - ${sale.litres.toFixed(2)}L ${sale.fuelType}`,
              debit: sale.amount, credit: 0,
            });
          });
        }

        // From DailyRecord
        if (dailyRecord) {
          (dailyRecord.cashInHand || []).filter(cash => cash.accountId === accountId).forEach(cash => {
            allEntries.push({
              date, sortDate, type: 'cash_received',
              description: `Cash Received${cash.transactionId ? ` - TXN: ${cash.transactionId}` : ''}`,
              debit: 0, credit: cash.amount,
            });
          });
        }
      }

      // 4. Sort all entries by date
      allEntries.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

      // 5. Calculate running balance
      let runningBalance = 0;
      const finalLedgerEntries = allEntries.map(entry => {
        // Balance = Owed to us. Debit increases balance, Credit decreases it.
        runningBalance = runningBalance + entry.debit - entry.credit;
        return { ...entry, balance: runningBalance };
      });

      setLedgerEntries(finalLedgerEntries);
    } catch (error) {
      console.error('Error loading ledger data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'credit_sale':
      case '0332_sale':
        return <TrendingDown size={14} color="#dc2626" />;
      case 'cash_received':
        return <TrendingUp size={14} color="#059669" />;
      case 'opening_balance':
        return <Calendar size={14} color="#6b7280" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'credit_sale':
      case '0332_sale':
        return '#dc2626';
      case 'cash_received':
        return '#059669';
      default:
        return '#6b7280';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading ledger...</Text>
      </View>
    );
  }

  if (!account) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Account not found</Text>
      </View>
    );
  }

  const totalDebit = ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredit = ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0);
  const currentBalance = totalDebit - totalCredit;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.accountHeader}>
        <Text style={styles.accountName}>{account.name}</Text>
        <Text style={styles.accountType}>{account.type}</Text>
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Debit</Text>
          <Text style={styles.debitValue}>₹{totalDebit.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Credit</Text>
          <Text style={styles.creditValue}>₹{totalCredit.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Current Balance</Text>
          <Text style={[
            styles.balanceValue,
            currentBalance > 0 ? styles.negativeBalance : styles.positiveBalance
          ]}>
            ₹{Math.abs(currentBalance).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.ledgerSection}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        
        {ledgerEntries.length === 0 ? (
          <Text style={styles.noEntriesText}>No transactions found</Text>
        ) : (
          <View style={styles.ledgerTable}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.dateColumn]}>Date</Text>
              <Text style={[styles.headerCell, styles.descriptionColumn]}>Description</Text>
              <Text style={[styles.headerCell, styles.amountColumn]}>Debit</Text>
              <Text style={[styles.headerCell, styles.amountColumn]}>Credit</Text>
              <Text style={[styles.headerCell, styles.amountColumn]}>Balance</Text>
            </View>
            
            {ledgerEntries.map((entry, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.tableCell, styles.dateColumn]}>
                  <Text style={styles.dateText}>
                    {format(new Date(entry.date), 'MMM dd')}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.descriptionColumn]}>
                  <View style={styles.descriptionContent}>
                    {getTypeIcon(entry.type)}
                    <Text style={[
                      styles.descriptionText,
                      { color: getTypeColor(entry.type) }
                    ]}>
                      {entry.description}
                    </Text>
                  </View>
                </View>
                <View style={[styles.tableCell, styles.amountColumn]}>
                  <Text style={styles.debitText}>
                    {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '-'}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.amountColumn]}>
                  <Text style={styles.creditText}>
                    {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '-'}
                  </Text>
                </View>
                <View style={[styles.tableCell, styles.amountColumn]}>
                  <Text style={[
                    styles.balanceText,
                    entry.balance > 0 ? styles.negativeBalance : styles.positiveBalance
                  ]}>
                    ₹{Math.abs(entry.balance).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
  },
  accountHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  accountName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  accountType: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginTop: 4,
  },
  summarySection: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  debitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  creditValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  positiveBalance: {
    color: '#059669',
  },
  negativeBalance: {
    color: '#dc2626',
  },
  ledgerSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  noEntriesText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  ledgerTable: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableCell: {
    justifyContent: 'center',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  dateColumn: {
    flex: 1.5,
  },
  descriptionColumn: {
    flex: 3,
    alignItems: 'flex-start',
  },
  amountColumn: {
    flex: 1.5,
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'left',
  },
  descriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  debitText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  creditText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
