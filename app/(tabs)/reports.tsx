import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BarChart2, ChevronRight, FileWarning, FileText, Droplets, Truck } from 'lucide-react-native';
import { Card } from '../../components/Card';

export default function ReportsScreen() {
  const router = useRouter();

  const reports = [
    {
      title: 'Monthly Sales Summary',
      description: 'View a day-by-day summary of sales, expenses, and net profit for any month.',
      path: '/reports/monthly-sales',
      icon: <BarChart2 size={24} color="#2563eb" />,
      color: '#eff6ff',
    },
    {
      title: 'Stock Report',
      description: 'Reconcile fuel ordered vs. sold for any date range to find shortage or surplus.',
      path: '/reports/stock-report',
      icon: <Droplets size={24} color="#7c3aed" />,
      color: '#f5f3ff',
    },
    {
      title: 'Aged Debtors Report',
      description: 'View outstanding credit broken down by age (0-30, 31-60, 90+ days).',
      path: '/reports/aged-debtors',
      icon: <FileWarning size={24} color="#f59e0b" />,
      color: '#fffbeb',
    },
    {
      title: 'Account Statement',
      description: 'Generate a detailed transaction report for a specific account and date range.',
      path: '/reports/account-statement',
      icon: <FileText size={24} color="#059669" />,
      color: '#ecfdf5',
    },
    {
      title: 'Vehicle 0332 Report',
      description: 'Track diesel filled, sold, and remaining stock for vehicle 0332 over a period.',
      path: '/reports/vehicle-0332-report',
      icon: <Truck size={24} color="#ea580c" />,
      color: '#fff7ed',
    },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {reports.map((report) => (
            <Card key={report.path} style={styles.reportCard}>
              <TouchableOpacity style={styles.reportButton} onPress={() => router.push(report.path)}>
                <View style={[styles.iconContainer, { backgroundColor: report.color }]}>{report.icon}</View>
                <View style={styles.textContainer}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportDescription}>{report.description}</Text>
                </View>
                <ChevronRight size={24} color="#9ca3af" />
              </TouchableOpacity>
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  reportCard: { padding: 0 },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  iconContainer: {
    padding: 12,
    borderRadius: 8,
  },
  textContainer: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
