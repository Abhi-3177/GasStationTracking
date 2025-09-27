import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Save } from 'lucide-react-native';

interface SaveButtonProps {
  onSave: () => void;
}

export function SaveButton({ onSave }: SaveButtonProps) {
  return (
    <TouchableOpacity style={styles.saveButton} onPress={onSave}>
      <Save size={20} color="#ffffff" />
      <Text style={styles.saveButtonText}>Save Day Book Record</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
