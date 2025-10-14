import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { getAgedDebtorsReport } from '../../utils/database';
import { useNotification } from '../../context/NotificationContext';
import { formatIndianCurrency } from '../../utils/formatters';
import { Card } from '../../components/Card';
import { AgedDebtor } from '../../types/daybook';

export default function AgedDebtorsReportScreen() {
  const { showNotification } = useNotification();
  const router = useRouter();
  const [reportData, setReportData] = useState<AgedDebtor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAgedDebtorsReport();
      setReportData(data);
    } catch (error: any) {
      showNotification(`Error loading report data: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [loadReportData])
  );
  
  const renderHeader = () => (
    <View style={[styles.row, styles.headerRow]}>
      <Text style={[styles.cell, styles.headerText, { flex: 2 }]}>Account</Text>
      <Text style={[styles.cell, styles.headerText]}>0-30</Text>
      <Text style={[styles.cell, styles.headerText]}>31-60</Text>
      <Text style={[styles.cell, styles.headerText]}>61-90</Text>
      <Text style={[styles.cell, styles.headerText]}>90+</Text>
      <Text style={[styles.cell, styles.headerText]}>Total</Text>
    </View>
  );

  const renderItem = ({ item }: { item: AgedDebtor }) => (
    <TouchableOpacity onPress={() => router.push(`/account/${item.account_id}`)}>
        <View style={styles.row}>
            <View style={[styles.cell, { flex: 2 }]}>
                <Text style={styles.accountName}>{item.account_name}</Text>
                <Text style={styles.accountType}>{item.account_type}</Text>
            </View>
            <Text style={styles.cell}>{formatIndianCurrency(item.days_0_30)}</Text>
            <Text style={styles.cell}>{formatIndianCurrency(item.days_31_60)}</Text>
            <Text style={styles.cell}>{formatIndianCurrency(item.days_61_90)}</Text>
            <Text style={styles.cell}>{formatIndianCurrency(item.days_over_90)}</Text>
            <Text style={[styles.cell, styles.totalCell]}>{formatIndianCurrency(item.total_outstanding)}</Text>
        </View>
    </TouchableOpacity>
  );

  const totals = reportData.reduce((acc, row) => {
    acc.total_outstanding += row.total_outstanding;
    acc.days_0_30 += row.days_0_30;
    acc.days_31_60 += row.days_31_60;
    acc.days_61_90 += row.days_61_90;
    acc.days_over_90 += row.days_over_90;
    return acc;
  }, { total_outstanding: 0, days_0_30: 0, days_31_60: 0, days_61_90: 0, days_over_90: 0 });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={reportData}
          renderItem={renderItem}
          keyExtractor={(item) => item.account_id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            <View style={[styles.row, styles.footerRow]}>
                <Text style={[styles.cell, styles.footerText, { flex: 2 }]}>Grand Total</Text>
                <Text style={[styles.cell, styles.footerText]}>{formatIndianCurrency(totals.days_0_30)}</Text>
                <Text style={[styles.cell, styles.footerText]}>{formatIndianCurrency(totals.days_31_60)}</Text>
                <Text style={[styles.cell, styles.footerText]}>{formatIndianCurrency(totals.days_61_90)}</Text>
                <Text style={[styles.cell, styles.footerText]}>{formatIndianCurrency(totals.days_over_90)}</Text>
                <Text style={[styles.cell, styles.footerText, styles.totalCell]}>{formatIndianCurrency(totals.total_outstanding)}</Text>
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No outstanding credit found.</Text>
            </Card>
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadReportData} />}
          stickyHeaderIndices={[0]}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerRow: { backgroundColor: '#f1f5f9' },
  footerRow: { backgroundColor: '#fffbeb', borderTopWidth: 2, borderTopColor: '#f59e0b' },
  cell: { flex: 1, padding: 12, textAlign: 'right', fontSize: 12 },
  headerText: { fontWeight: '700', color: '#475569', fontSize: 12 },
  accountName: { fontWeight: '600', color: '#1f2937' },
  accountType: { fontSize: 10, color: '#6b7280', textTransform: 'capitalize' },
  totalCell: { fontWeight: '700' },
  footerText: { fontWeight: '700', color: '#92400e' },
  emptyContainer: { padding: 40, alignItems: 'center', marginTop: 16 },
  emptyText: { fontSize: 16, color: '#6b7280' },
});
