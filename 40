import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calculator, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord, DailyRecordData } from '../types/daybook';
import { calculateTotals } from '../utils/calculations';

interface ReconciliationSummaryProps {
  dayBookRecord: DayBookRecord;
  dailyRecord: DailyRecordData;
}

export function ReconciliationSummary({ dayBookRecord, dailyRecord }: ReconciliationSummaryProps) {
  const dayBookTotals = calculateTotals(dayBookRecord);
  
  // Calculate Daily Record totals
  const totalBankSettled = Object.values(dailyRecord.bankEntries).reduce(
    (sum, entry) => sum + entry.actual, 0
  );
  
  const totalCreditSales = dailyRecord.creditSales.reduce(
    (sum, sale) => sum + sale.amount, 0
  );
  
  const totalCommissionPaid = dailyRecord.commissionPaid.reduce(
    (sum, commission) => sum + commission.amount, 0
  );
  
  const totalExpenses = dailyRecord.expenses.reduce(
    (sum, expense) => sum + expense.amount, 0
  );
  
  const totalCashInHand = dailyRecord.cashInHand.reduce(
    (sum, cash) => sum + cash.amount, 0
  );
  
  const total0332Sales = dailyRecord.saleByVehicle0332.reduce(
    (sum, sale) => sum + sale.amount, 0
  );

  // Validation checks
  const creditSalesMismatch = Math.abs(dayBookTotals.totalDeductions - (totalCreditSales + total0332Sales)) > 0.01;
  const bankMismatch = Math.abs(dayBookTotals.totalPayments - totalBankSettled) > 0.01;
  
  // Final balance calculation
  const finalBalance = totalBankSettled + totalCashInHand - totalCommissionPaid - totalExpenses;
  const expectedBalance = dayBookTotals.dayBalance;
  const balanceMismatch = Math.abs(finalBalance - expectedBalance) > 0.01;

  return (
    <Card style={styles.summaryCard}>
      <View style={styles.header}>
        <Calculator size={24} color="#2563eb" />
        <Text style={styles.title}>Reconciliation Summary</Text>
      </View>

      <View style={styles.validationSection}>
        <Text style={styles.sectionTitle}>Validation Checks</Text>
        
        <View style={[
          styles.validationRow,
          creditSalesMismatch && styles.mismatchRow
        ]}>
          {creditSalesMismatch ? (
            <AlertTriangle size={16} color="#dc2626" />
          ) : (
            <CheckCircle size={16} color="#059669" />
          )}
          <Text style={styles.validationLabel}>Credit + 0332 Sales Match:</Text>
          <Text style={[
            styles.validationValue,
            creditSalesMismatch && styles.mismatchText
          ]}>
            {creditSalesMismatch ? 'MISMATCH' : 'MATCH'}
          </Text>
        </View>

        <View style={[
          styles.validationRow,
          bankMismatch && styles.mismatchRow
        ]}>
          {bankMismatch ? (
            <AlertTriangle size={16} color="#dc2626" />
          ) : (
            <CheckCircle size={16} color="#059669" />
          )}
          <Text style={styles.validationLabel}>Bank Payments Match:</Text>
          <Text style={[
            styles.validationValue,
            bankMismatch && styles.mismatchText
          ]}>
            {bankMismatch ? 'MISMATCH' : 'MATCH'}
          </Text>
        </View>
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Daily Summary</Text>
        
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Total Bank Settled</Text>
            <Text style={styles.summaryItemValue}>₹{totalBankSettled.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Total Credit Sales</Text>
            <Text style={styles.summaryItemValue}>₹{totalCreditSales.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Total Commission Paid</Text>
            <Text style={styles.summaryItemValue}>₹{totalCommissionPaid.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Total Expenses</Text>
            <Text style={styles.summaryItemValue}>₹{totalExpenses.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Cash in Hand</Text>
            <Text style={styles.summaryItemValue}>₹{totalCashInHand.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>0332 Sales</Text>
            <Text style={styles.summaryItemValue}>₹{total0332Sales.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={[
        styles.finalBalanceSection,
        balanceMismatch && styles.mismatchSection
      ]}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Expected Balance (Day Book):</Text>
          <Text style={styles.balanceValue}>₹{expectedBalance.toFixed(2)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Calculated Balance (Daily Record):</Text>
          <Text style={[
            styles.balanceValue,
            balanceMismatch && styles.mismatchText
          ]}>
            ₹{finalBalance.toFixed(2)}
          </Text>
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Difference:</Text>
          <Text style={[
            styles.balanceValue,
            balanceMismatch && styles.mismatchText
          ]}>
            ₹{(finalBalance - expectedBalance).toFixed(2)}
          </Text>
        </View>
        
        {balanceMismatch && (
          <View style={styles.mismatchAlert}>
            <AlertTriangle size={16} color="#dc2626" />
            <Text style={styles.mismatchAlertText}>
              Final balance reconciliation failed. Please review all entries.
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e40af',
  },
  validationSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mismatchRow: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
  },
  validationLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  validationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  mismatchText: {
    color: '#dc2626',
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryItemLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  finalBalanceSection: {
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  mismatchSection: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#065f46',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  mismatchAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  mismatchAlertText: {
    flex: 1,
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '500',
  },
});
