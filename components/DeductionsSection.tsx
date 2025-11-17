import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CreditCard, Edit } from 'lucide-react-native';
import { Card } from './Card';
import { DayBookRecord } from '../types/daybook';
import { formatIndianCurrency, formatLitres } from '../utils/formatters';

interface DeductionsSectionProps {
  deductions: DayBookRecord['deductions'];
  onManageAllSalesPress?: () => void;
}

const SaleGroupDisplay = ({ title, sales }: { title: string, sales: any[] }) => {
  if (!sales || sales.length === 0) {
    return null; // Don't show empty sections
  }
  
  const totalAmount = sales.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <View style={styles.groupDisplay}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{title}</Text>
      </View>
      
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.accountCell]}>Account</Text>
          <Text style={[styles.headerText, styles.vehicleCell]}>Vehicle</Text>
          <Text style={[styles.headerText, styles.litresCell]}>Litres</Text>
          <Text style={[styles.headerText, styles.amountCell]}>Amount</Text>
        </View>
        {sales.map(sale => (
          <View key={sale.id} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.accountCell]}>{sale.name}</Text>
            <Text style={[styles.cellText, styles.vehicleCell]}>{sale.vehicleNumber || '-'}</Text>
            <Text style={[styles.cellText, styles.litresCell]}>{formatLitres(sale.litres)}</Text>
            <Text style={[styles.cellText, styles.amountCell]}>{formatIndianCurrency(sale.amount)}</Text>
          </View>
        ))}
        <View style={styles.groupTotalRow}>
          <Text style={styles.groupTotalLabel}>Total:</Text>
          <Text style={styles.groupTotalValue}>{formatIndianCurrency(totalAmount)}</Text>
        </View>
      </View>
    </View>
  );
};

export function DeductionsSection({ deductions, onManageAllSalesPress }: DeductionsSectionProps) {
  const totalDeductions = 
    (deductions.sviSales?.reduce((s, i) => s + i.amount, 0) || 0) +
    (deductions.sales0332?.reduce((s, i) => s + i.amount, 0) || 0) +
    (deductions.creditSales?.reduce((s, i) => s + i.amount, 0) || 0);

  const hasAnySales = (deductions.sviSales?.length || 0) > 0 ||
                      (deductions.sales0332?.length || 0) > 0 ||
                      (deductions.creditSales?.length || 0) > 0;

  return (
    <Card>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1}}>
            <CreditCard size={20} color="#7c3aed" />
            <Text style={styles.title}>Credit & Deductions</Text>
        </View>
        {onManageAllSalesPress && (
            <TouchableOpacity style={styles.manageButton} onPress={onManageAllSalesPress}>
                <Edit size={14} color="#fff" />
                <Text style={styles.manageButtonText}>Manage All Sales</Text>
            </TouchableOpacity>
        )}
      </View>
      
      <SaleGroupDisplay title="SVI Sales" sales={deductions.sviSales || []} />
      <SaleGroupDisplay title="0332 Sales" sales={deductions.sales0332 || []} />
      <SaleGroupDisplay title="General Credit Sales" sales={deductions.creditSales || []} />
      
      {!hasAnySales && (
        <Text style={styles.noDataText}>No credit sales recorded. Use the "Manage" button to add entries.</Text>
      )}

      {hasAnySales && (
        <View style={styles.summarySection}>
          <Text style={styles.totalLabel}>Total Deductions:</Text>
          <Text style={styles.totalValue}>{formatIndianCurrency(totalDeductions)}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  manageButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  manageButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  groupDisplay: { marginBottom: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', alignItems: 'center' },
  cellText: { fontSize: 14, color: '#374151' },
  accountCell: { flex: 2, fontWeight: '500' },
  vehicleCell: { flex: 1.5, textAlign: 'center' },
  litresCell: { flex: 1.5, textAlign: 'right' },
  amountCell: { flex: 1.5, textAlign: 'right', fontWeight: '500' },
  groupTotalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 8, backgroundColor: '#f9fafb' },
  groupTotalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  groupTotalValue: { fontSize: 14, fontWeight: '700', color: '#7c3aed', marginLeft: 8 },
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f3ff', padding: 12, borderRadius: 8, marginTop: 16 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#5b21b6' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#5b21b6' },
  noDataText: {
    fontStyle: 'italic',
    color: '#6b7280',
    textAlign: 'center',
    padding: 16,
  },
});
