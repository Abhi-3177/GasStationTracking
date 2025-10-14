import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gauge } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { MachineReading } from '../types/daybook';
import { formatLitres } from '../utils/formatters';

interface MachineReadingsProps {
  machines: {
    petrol: MachineReading[];
    diesel: MachineReading[];
  };
  onUpdateMachine: (type: 'petrol' | 'diesel', id: string, updates: Partial<MachineReading>) => void;
  isOpeningEditable: boolean;
}

export function MachineReadings({ machines, onUpdateMachine, isOpeningEditable }: MachineReadingsProps) {
  const renderMachine = (machine: MachineReading, type: 'petrol' | 'diesel') => {
    const litresSold = Math.max(0, machine.closingReading - machine.openingReading);
    
    return (
      <View key={machine.id} style={styles.machineCard}>
        <Text style={styles.machineName}>{machine.name}</Text>
        
        <View style={styles.readingsRow}>
          <View style={styles.readingInput}>
            <Text style={styles.inputLabel}>Opening</Text>
            <NumberInput
              value={machine.openingReading}
              onChangeValue={(value) => onUpdateMachine(type, machine.id, { openingReading: value })}
              placeholder="0"
              style={!isOpeningEditable ? styles.disabledInput : null}
              editable={isOpeningEditable}
            />
          </View>
          
          <View style={styles.readingInput}>
            <Text style={styles.inputLabel}>Closing</Text>
            <NumberInput
              value={machine.closingReading}
              onChangeValue={(value) => onUpdateMachine(type, machine.id, { closingReading: value })}
              placeholder="0"
            />
          </View>
          
          <View style={styles.litresDisplay}>
            <Text style={styles.inputLabel}>Litres</Text>
            <Text style={styles.litresValue}>{formatLitres(litresSold)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const petrolTotal = machines.petrol.reduce(
    (total, machine) => total + Math.max(0, machine.closingReading - machine.openingReading),
    0
  );
  
  const dieselTotal = machines.diesel.reduce(
    (total, machine) => total + Math.max(0, machine.closingReading - machine.openingReading),
    0
  );

  return (
    <Card>
      <View style={styles.header}>
        <Gauge size={20} color="#7c3aed" />
        <Text style={styles.title}>Machine Readings</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Petrol Machines</Text>
        {machines.petrol.map(machine => renderMachine(machine, 'petrol'))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Petrol Litres:</Text>
          <Text style={styles.totalValue}>{formatLitres(petrolTotal)}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diesel Machines</Text>
        {machines.diesel.map(machine => renderMachine(machine, 'diesel'))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Diesel Litres:</Text>
          <Text style={styles.totalValue}>{formatLitres(dieselTotal)}</Text>
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  machineCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  machineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  readingsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  readingInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  litresDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  litresValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    width: '100%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
});
