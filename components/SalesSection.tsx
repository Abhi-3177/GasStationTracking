import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { CalculatedTotals } from '../types/daybook';
import { formatIndianCurrency } from '../utils/formatters';

interface SalesSectionProps {
  prices: {
    petrol: number;
    diesel: number;
  };
  totals: CalculatedTotals;
  onUpdatePrices: (prices: { petrol: number; diesel: number }) => void;
}

export function SalesSection({ prices, totals, onUpdatePrices }: SalesSectionProps) {
  return (
    <Card>
      <View style={styles.header}>
        <DollarSign size={20} color="#059669" />
        <Text style={styles.title}>Sales Calculation</Text>
      </View>
      
      <View style={styles.pricesSection}>
        <Text style={styles.sectionTitle}>Today's Prices</Text>
        
        <View style={styles.priceRow}>
          <View style={styles.priceInput}>
            <Text style={styles.inputLabel}>Petrol Price (₹/L)</Text>
            <NumberInput
              value={prices.petrol}
              onChangeValue={(value) => onUpdatePrices({ ...prices, petrol: value })}
              placeholder="0.000"
              precision={3}
            />
            <Text style={styles.priceDisplay}>{formatIndianCurrency(prices.petrol)}/L</Text>
          </View>
          
          <View style={styles.priceInput}>
            <Text style={styles.inputLabel}>Diesel Price (₹/L)</Text>
            <NumberInput
              value={prices.diesel}
              onChangeValue={(value) => onUpdatePrices({ ...prices, diesel: value })}
              placeholder="0.000"
              precision={3}
            />
            <Text style={styles.priceDisplay}>{formatIndianCurrency(prices.diesel)}/L</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.calculationsSection}>
        <Text style={styles.sectionTitle}>Sales Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Petrol Sale:</Text>
          <Text style={styles.summaryValue}>{formatIndianCurrency(totals.petrolSale)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Diesel Sale:</Text>
          <Text style={styles.summaryValue}>{formatIndianCurrency(totals.dieselSale)}</Text>
        </View>
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Sale:</Text>
          <Text style={styles.totalValue}>{formatIndianCurrency(totals.totalSale)}</Text>
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
  pricesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  priceDisplay: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    backgroundColor: '#ecfdf5',
    padding: 4,
    borderRadius: 4,
  },
  calculationsSection: {
    backgroundColor: '#f9fafb',
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
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  totalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
});
