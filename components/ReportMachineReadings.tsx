import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';

interface ReportMachineReadingsProps {
  title: string;
  petrolReadings: number[];
  dieselReadings: number[];
  onUpdate: (fuelType: 'petrol' | 'diesel', index: number, value: number) => void;
}

export function ReportMachineReadings({ title, petrolReadings, dieselReadings, onUpdate }: ReportMachineReadingsProps) {
  const renderMachineInputs = (fuelType: 'petrol' | 'diesel', readings: number[]) => (
    <View>
      <Text style={styles.fuelTypeTitle}>{fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}</Text>
      <View style={styles.inputsGrid}>
        {readings.map((reading, index) => (
          <View key={`${fuelType}-${index}`} style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{`Machine ${index + 1}`}</Text>
            <NumberInput
              value={reading}
              onChangeValue={(value) => onUpdate(fuelType, index, value)}
              placeholder="0.00"
              precision={2}
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.fuelContainer}>
        {renderMachineInputs('petrol', petrolReadings)}
        <View style={styles.separator} />
        {renderMachineInputs('diesel', dieselReadings)}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  fuelContainer: {
    gap: 16,
  },
  fuelTypeTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    minWidth: '45%',
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
});
