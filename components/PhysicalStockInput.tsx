import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { Droplets } from 'lucide-react-native';

interface PhysicalStockInputProps {
  petrolDip: string;
  dieselDip: string;
  petrolVolume: number;
  dieselVolume: number;
  onUpdate: (field: 'petrolDip' | 'dieselDip' | 'petrolVolume' | 'dieselVolume', value: string | number) => void;
}

export function PhysicalStockInput({ petrolDip, dieselDip, petrolVolume, dieselVolume, onUpdate }: PhysicalStockInputProps) {
  return (
    <Card>
      <Text style={styles.title}>Physical Stock Verification</Text>
      <Text style={styles.subtitle}>Enter the actual measured stock volume from the dipstick reading.</Text>
      <View style={styles.inputsContainer}>
        <View style={styles.fuelSection}>
          <View style={styles.labelContainer}>
            <Droplets size={16} color="#7c3aed" />
            <Text style={styles.label}>Petrol</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dip Reading (cm)</Text>
            <TextInput
              style={styles.textInput}
              value={petrolDip}
              onChangeText={(value) => onUpdate('petrolDip', value)}
              placeholder="e.g., 150.5 cm"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Physical Volume (L)</Text>
            <NumberInput
              value={petrolVolume}
              onChangeValue={(value) => onUpdate('petrolVolume', value)}
              placeholder="0.00"
              precision={2}
            />
          </View>
        </View>
        <View style={styles.fuelSection}>
          <View style={styles.labelContainer}>
            <Droplets size={16} color="#059669" />
            <Text style={styles.label}>Diesel</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dip Reading (cm)</Text>
            <TextInput
              style={styles.textInput}
              value={dieselDip}
              onChangeText={(value) => onUpdate('dieselDip', value)}
              placeholder="e.g., 210.0 cm"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Physical Volume (L)</Text>
            <NumberInput
              value={dieselVolume}
              onChangeValue={(value) => onUpdate('dieselVolume', value)}
              placeholder="0.00"
              precision={2}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  inputsContainer: { flexDirection: 'row', gap: 16 },
  fuelSection: { flex: 1, gap: 12 },
  labelContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  label: { fontSize: 16, fontWeight: '500' },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 12, color: '#6b7280' },
  textInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#ffffff' },
});
