import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CreditCard, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord, DailyRecordData, Account } from '../types/daybook';

interface CreditSalesRecordProps {
  dayBookRecord: DayBookRecord;
  dailyRecord: DailyRecordData;
  accounts: Account[];
  onUpdateDailyRecord: (updates: Partial<DailyRecordData>) => void;
}

export function CreditSalesRecord({ 
  dayBookRecord, 
  dailyRecord, 
  accounts, 
  onUpdateDailyRecord 
}: CreditSalesRecordProps) {
  
  const dayBookCreditSales = dayBookRecord?.deductions?.creditSales || [];
  
  // Sync logic to ensure daily record credit sales match the day book
  React.useEffect(() => {
    // Rebuild the credit sales list for the daily record based on the day book
    // This ensures additions and removals are synced, while preserving the settled status
    const newCreditSales = (dayBookCreditSales || []).map(dayBookSale => {
      if (!dayBookSale) return null;
      
      const existingRecordSale = (dailyRecord?.creditSales || []).find(
        rs => rs.id === dayBookSale.id
      );

      return {
        id: dayBookSale.id,
        accountId: dayBookSale.accountId || '',
        vehicleNumber: dayBookSale.vehicleNumber || '',
        litres: dayBookSale.litres || 0,
        fuelType: dayBookSale.fuelType || 'diesel',
        amount: dayBookSale.amount || 0,
        settled: existingRecordSale?.settled || false, // Preserve settled status
        settledDate: existingRecordSale?.settledDate, // Preserve settled date
      };
    }).filter(Boolean) as DailyRecordData['creditSales'];

    // Only update state if there's an actual change to prevent infinite loops
    if (JSON.stringify(newCreditSales) !== JSON.stringify(dailyRecord.creditSales)) {
      onUpdateDailyRecord({ creditSales: newCreditSales });
    }
  }, [dayBookCreditSales, dailyRecord.creditSales, onUpdateDailyRecord]);

  const totalDayBookCreditAmount = dayBookCreditSales.reduce((sum, sale) => sum + (sale?.amount || 0), 0);
  const totalRecordCreditAmount = (dailyRecord?.creditSales || []).reduce((sum, sale) => sum + (sale?.amount || 0), 0);
  const hasMismatch = Math.abs(totalDayBookCreditAmount - totalRecordCreditAmount) > 0.01;

  const toggleSettlement = (saleId: string) => {
    const updatedCreditSales = (dailyRecord?.creditSales || []).map(sale =>
      sale.id === saleId 
        ? { ...sale, settled: !sale.settled, settledDate: !sale.settled ? new Date().toISOString() : undefined }
        : sale
    );
    onUpdateDailyRecord({ creditSales: updatedCreditSales });
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  const settledAmount = (dailyRecord?.creditSales || [])
    .filter(sale => sale.settled)
    .reduce((sum, sale) => sum + (sale?.amount || 0), 0);

  const outstandingAmount = (dailyRecord?.creditSales || [])
    .filter(sale => !sale.settled)
    .reduce((sum, sale) => sum + (sale?.amount || 0), 0);

  return (
    <Card>
      <View style={styles.header}>
        <CreditCard size={20} color="#7c3aed" />
        <Text style={styles.title}>Credit Sales Records</Text>
      </View>

      {hasMismatch && (
        <View style={styles.mismatchWarning}>
          <AlertTriangle size={16} color="#f59e0b" />
          <Text style={styles.mismatchText}>
            Credit Sales mismatch: Day Book ₹{totalDayBookCreditAmount.toFixed(2)}, 
            Record ₹{totalRecordCreditAmount.toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.salesSection}>
        <Text style={styles.sectionTitle}>From Day Book Credit Sales</Text>
        
        {(dailyRecord?.creditSales || []).length === 0 ? (
          <Text style={styles.noDataText}>No credit sales found in Day Book</Text>
        ) : (
          (dailyRecord.creditSales).map(sale => {
            if (!sale) return null; // Guard against null/undefined entries
            
            return (
              <View key={sale.id} style={styles.saleRow}>
                <View style={styles.saleInfo}>
                  <Text style={styles.saleName}>{getAccountName(sale.accountId) || 'Unlinked Sale'}</Text>
                  <Text style={styles.saleDetails}>
                    {(sale.litres || 0).toFixed(2)}L {sale.fuelType} - ₹{(sale.amount || 0).toFixed(2)}
                  </Text>
                  {sale.vehicleNumber && (
                    <Text style={styles.vehicleNumber}>Vehicle: {sale.vehicleNumber}</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => toggleSettlement(sale.id)}
                  style={[
                    styles.settlementButton,
                    sale.settled && styles.settlementButtonActive,
                  ]}
                >
                  <CheckCircle 
                    size={16} 
                    color={sale.settled ? '#ffffff' : '#6b7280'} 
                  />
                  <Text style={[
                    styles.settlementButtonText,
                    sale.settled && styles.settlementButtonTextActive,
                  ]}>
                    {sale.settled ? 'Settled' : 'Unsettled'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Credit Sales:</Text>
          <Text style={styles.summaryValue}>₹{totalRecordCreditAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Settled Amount:</Text>
          <Text style={styles.summaryValue}>
            ₹{settledAmount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Outstanding Amount:</Text>
          <Text style={[styles.summaryValue, styles.outstandingValue]}>
            ₹{outstandingAmount.toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  mismatchWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  mismatchText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  salesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  saleInfo: {
    flex: 1,
  },
  saleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  saleDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 12,
    color: '#7c3aed',
    marginBottom: 2,
  },
  settlementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  settlementButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  settlementButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  settlementButtonTextActive: {
    color: '#ffffff',
  },
  summarySection: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  outstandingValue: {
    color: '#dc2626',
  },
});
