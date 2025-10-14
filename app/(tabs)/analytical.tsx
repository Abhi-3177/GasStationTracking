import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MonthlySalesChart } from '../../components/MonthlySalesChart';
import { AccountFluctuationReport } from '../../components/AccountFluctuationReport';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function AnalyticalScreen() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorBoundary>
            <MonthlySalesChart />
          </ErrorBoundary>
          <ErrorBoundary>
            <AccountFluctuationReport />
          </ErrorBoundary>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 16,
  },
});
