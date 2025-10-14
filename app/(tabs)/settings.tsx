import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Settings as SettingsIcon, AlertTriangle } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { SettlementFileUpload } from '../../components/SettlementFileUpload';
import { BulkLedgerUpload } from '../../components/BulkLedgerUpload';
import { StockOrderUpload } from '../../components/StockOrderUpload';
import { TransactionFileUpload } from '../../components/TransactionFileUpload';
import { ResetData } from '../../components/ResetData';

export default function SettingsScreen() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Card>
              <View style={styles.headerSection}>
                <SettingsIcon size={24} color="#1f2937" />
                <Text style={styles.title}>App Settings</Text>
              </View>
            </Card>

            <SettlementFileUpload />

            <TransactionFileUpload />

            <BulkLedgerUpload />

            <StockOrderUpload />

            <Card style={styles.dangerZoneCard}>
              <View style={styles.uploadHeader}>
                <AlertTriangle size={20} color="#dc2626" />
                <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              </View>
              <Text style={styles.uploadSubtitle}>
                This action is permanent and cannot be undone. Proceed with caution.
              </Text>
              <ResetData />
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16 },
  headerSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  uploadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dangerZoneCard: { backgroundColor: '#fef2f2', borderColor: '#dc2626', borderWidth: 1 },
  dangerZoneTitle: { fontSize: 18, fontWeight: '600', color: '#991b1b' },
  uploadSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
});
