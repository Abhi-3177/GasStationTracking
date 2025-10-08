import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Modal } from 'react-native';
import { Calendar as LucideCalendar, X } from 'lucide-react-native';
import { format } from 'date-fns';
import { Calendar, DateData } from 'react-native-calendars';

interface DateSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  buttonStyle?: ViewStyle;
}

export function DateSelector({ selectedDate, onDateChange, buttonStyle }: DateSelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  // State to manage the currently displayed month in the calendar
  const [calendarMonth, setCalendarMonth] = useState(format(selectedDate, 'yyyy-MM-dd'));

  const handleDayPress = (day: DateData) => {
    // Adjust for timezone differences to ensure the selected date is correct
    const timezoneOffset = new Date().getTimezoneOffset() * 60000;
    const adjustedDate = new Date(new Date(day.dateString).getTime() + timezoneOffset);
    onDateChange(adjustedDate);
    setShowPicker(false);
  };

  const openPicker = () => {
    // When opening, ensure the calendar displays the month of the currently selected date
    setCalendarMonth(format(selectedDate, 'yyyy-MM-dd'));
    setShowPicker(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.dateButton, buttonStyle]} 
        onPress={openPicker}
      >
        <LucideCalendar size={20} color="#2563eb" />
        <Text style={styles.dateText}>
          {format(selectedDate, 'PPP')}
        </Text>
      </TouchableOpacity>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPicker}
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Date</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeButton}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              // Use `calendarMonth` for the current prop to allow month navigation
              current={calendarMonth}
              onMonthChange={(month) => setCalendarMonth(month.dateString)}
              onDayPress={handleDayPress}
              markedDates={{
                [format(selectedDate, 'yyyy-MM-dd')]: { selected: true, selectedColor: '#2563eb' },
              }}
              theme={{
                todayTextColor: '#2563eb',
                arrowColor: '#2563eb',
                'stylesheet.calendar.header': {
                  week: {
                    marginTop: 5,
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                  }
                }
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
});
