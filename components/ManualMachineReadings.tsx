import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { MachineReading } from '../types/daybook';

interface ManualMachineReadingsProps {
  title: string;
  machines: { petrol: Partial<MachineReading>[]; diesel: Partial<MachineReading>[] };
  onUpdate: (fuelType: 'petrol' | 'diesel', machineId: string, value: number) => void;
}

export function ManualMachineReadings({ title, machines, onUpdate }: ManualMachineReadingsProps) {
  const renderMachineInputs = (fuelType: 'petrol' | 'diesel') => (
    <View>
      <Text style={styles.fuelTypeTitle}>{fuelType.charAt(0).toUpperCase() + fuelType.slice(1)}</Text>
      <View style={styles.inputsGrid}>
        {(machines[fuelType] || []).map((machine, index) => (
          <View key={`${fuelType}-${index}`} style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{`Machine ${index + 1}`}</Text>
            <NumberInput
              value={machine.closingReading || 0} // Use closingReading as a generic value holder
              onChangeValue={(value) => onUpdate(fuelType, machine.id || `M${index}`, value)}
              placeholder="0.00"
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Optional: Enter readings to override automatic values.</Text>
      <View style={styles.fuelContainer}>
        {renderMachineInputs('petrol')}
        <View style={styles.separator} />
        {renderMachineInputs('diesel')}
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
