import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { Droplets } from 'lucide-react-native';

interface StockLevelCardProps {
  title: string;
  petrolStock: number;
  dieselStock: number;
  onUpdate: (fuelType: 'petrol' | 'diesel', value: number) => void;
  editable?: boolean;
}

export function StockLevelCard({ title, petrolStock, dieselStock, onUpdate, editable = true }: StockLevelCardProps) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {editable ? 'Enter the stock levels in litres.' : 'Values carried over from the previous report.'}
      </Text>
      <View style={styles.inputsContainer}>
        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Droplets size={16} color="#7c3aed" />
            <Text style={styles.label}>Petrol Stock (L)</Text>
          </View>
          <NumberInput
            value={petrolStock}
            onChangeValue={(value) => onUpdate('petrol', value)}
            placeholder="0.00"
            precision={2}
            editable={editable}
            style={!editable ? styles.disabledInput : null}
          />
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.labelContainer}>
            <Droplets size={16} color="#059669" />
            <Text style={styles.label}>Diesel Stock (L)</Text>
          </View>
          <NumberInput
            value={dieselStock}
            onChangeValue={(value) => onUpdate('diesel', value)}
            placeholder="0.00"
            precision={2}
            editable={editable}
            style={!editable ? styles.disabledInput : null}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  inputsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    gap: 4,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
  },
});
