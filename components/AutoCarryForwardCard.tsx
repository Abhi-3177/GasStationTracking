import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowRight, Info } from 'lucide-react-native';
import { Card } from './Card';
import { MachineReading } from '../types/daybook';

interface AutoCarryForwardCardProps {
  previousMachines: {
    petrol: MachineReading[];
    diesel: MachineReading[];
  } | null;
}

export function AutoCarryForwardCard({ previousMachines }: AutoCarryForwardCardProps) {
  const renderMachineReadings = (machines: MachineReading[], title: string, color: string) => (
    <View style={styles.machineSection}>
      <Text style={[styles.machineTitle, { color }]}>{title}</Text>
      {machines.map((machine, index) => (
        <View key={machine.id} style={styles.machineRow}>
          <Text style={styles.machineName}>{machine.name}:</Text>
          <Text style={styles.machineValue}>{machine.closingReading.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Info size={20} color="#0891b2" />
        <Text style={styles.title}>Auto Carry Forward - Previous Day's Closing Readings</Text>
      </View>
      
      {previousMachines ? (
        <View style={styles.content}>
          {renderMachineReadings(previousMachines.petrol, 'Petrol Machines', '#7c3aed')}
          <View style={styles.separator} />
          {renderMachineReadings(previousMachines.diesel, 'Diesel Machines', '#059669')}
          
          <View style={styles.noteSection}>
            <Text style={styles.noteText}>
              ✓ These readings have been automatically carried forward as today's opening readings
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.noDataSection}>
          <Text style={styles.noDataText}>No previous day data found. Starting fresh.</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0891b2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
    flex: 1,
  },
  content: {
    gap: 12,
  },
  machineSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  machineTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  machineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  machineName: {
    fontSize: 12,
    color: '#164e63',
    flex: 1,
  },
  machineValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0c4a6e',
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: '#bae6fd',
    marginVertical: 4,
  },
  noteSection: {
    backgroundColor: '#dcfce7',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  noteText: {
    fontSize: 12,
    color: '#15803d',
    textAlign: 'center',
  },
  noDataSection: {
    padding: 16,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#164e63',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
