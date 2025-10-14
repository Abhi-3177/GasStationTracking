import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { format, addMonths, subMonths } from 'date-fns';

interface MonthPickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function MonthPicker({ selectedDate, onDateChange }: MonthPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(selectedDate);

  const handleMonthChange = (offset: number) => {
    setPickerDate(prev => offset > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const handleSelect = () => {
    onDateChange(pickerDate);
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={() => setShowPicker(true)}>
        <Calendar size={20} color="#2563eb" />
        <Text style={styles.buttonText}>{format(selectedDate, 'MMMM yyyy')}</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showPicker}
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeButton}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerControls}>
              <TouchableOpacity onPress={() => handleMonthChange(-1)} style={styles.arrowButton}>
                <ChevronLeft size={24} color="#2563eb" />
              </TouchableOpacity>
              <Text style={styles.pickerDateText}>{format(pickerDate, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => handleMonthChange(1)} style={styles.arrowButton}>
                <ChevronRight size={24} color="#2563eb" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.selectButton} onPress={handleSelect}>
              <Text style={styles.selectButtonText}>Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  pickerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  arrowButton: {
    padding: 8,
  },
  pickerDateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  selectButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
