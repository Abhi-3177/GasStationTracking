import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { StockReportData } from '../types/daybook';
import { formatLitres } from '../utils/formatters';

interface ReportCalculationSummaryProps {
  title: string;
  data: StockReportData;
  color: string;
}

const CalculationRow = ({ label, value, isFinal = false, isNegative = false }: { label: string, value: string, isFinal?: boolean, isNegative?: boolean }) => (
  <View style={[styles.row, isFinal && styles.finalRow]}>
    <Text style={[styles.label, isFinal && styles.finalLabel]}>{label}</Text>
    <Text style={[styles.value, isFinal && styles.finalValue, isNegative && styles.negativeValue]}>{value}</Text>
  </View>
);

export function ReportCalculationSummary({ title, data, color }: ReportCalculationSummaryProps) {
  const isShortage = data.surplusOrShortage < 0;
  const isSurplus = data.surplusOrShortage > 0;
  
  let diffLabel = 'Shortage / Surplus';
  let diffColor = '#1f2937';
  if (isShortage) {
    diffLabel = 'Shortage';
    diffColor = '#dc2626';
  } else if (isSurplus) {
    diffLabel = 'Surplus';
    diffColor = '#059669';
  }

  return (
    <Card style={{ borderColor: color, borderWidth: 1 }}>
      <Text style={[styles.title, { color }]}>{title} Stock Reconciliation</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calculated Sales</Text>
        <CalculationRow label="Total Sold from Readings" value={formatLitres(data.totalSoldFromReading)} />
        <CalculationRow label="- Testing Volume" value={`- ${formatLitres(data.testingVolume)}`} />
        <CalculationRow label="= Final Sold Volume" value={formatLitres(data.finalSoldVolume)} isFinal />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Book Stock Calculation</Text>
        <CalculationRow label="Opening Stock" value={formatLitres(data.openingStock)} />
        <CalculationRow label="+ Stock Ordered" value={`+ ${formatLitres(data.stockOrdered)}`} />
        <CalculationRow label="- Final Sold Volume" value={`- ${formatLitres(data.finalSoldVolume)}`} />
        <CalculationRow label="= Final Stock (as per Report)" value={formatLitres(data.finalStockFromReport)} isFinal />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Physical vs. Book Reconciliation</Text>
        <CalculationRow label="Physical Stock (from Dip)" value={formatLitres(data.physicalStock)} />
        <CalculationRow label="- Final Stock (as per Report)" value={`- ${formatLitres(data.finalStockFromReport)}`} />
        <View style={[styles.row, styles.finalRow, { backgroundColor: `${diffColor}1A`, borderColor: diffColor }]}>
            <Text style={[styles.finalLabel, { color: diffColor }]}>{diffLabel}</Text>
            <Text style={[styles.finalValue, { color: diffColor }]}>{formatLitres(Math.abs(data.surplusOrShortage))}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  section: { marginBottom: 16, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: '#374151' },
  value: { fontSize: 14, fontWeight: '500' },
  finalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, paddingTop: 6, paddingHorizontal: 8, borderRadius: 4 },
  finalLabel: { fontWeight: '600' },
  finalValue: { fontWeight: '700' },
  negativeValue: { color: '#dc2626' },
});
