import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Modal } from 'react-native';
import { Calendar as LucideCalendar, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import { Calendar, DateData } from 'react-native-calendars';

interface DateSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  buttonStyle?: ViewStyle;
  savedDates?: string[];
}

export function DateSelector({ selectedDate, onDateChange, buttonStyle, savedDates }: DateSelectorProps) {
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

  const marks = useMemo(() => {
    const mark: { [key: string]: any } = {};
    if (savedDates) {
      savedDates.forEach(date => {
        mark[date] = { marked: true, dotColor: '#059669' };
      });
    }
    const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
    mark[formattedSelectedDate] = {
      ...(mark[formattedSelectedDate] || {}),
      selected: true,
      selectedColor: '#2563eb',
    };
    return mark;
  }, [savedDates, selectedDate]);

  const isDateSaved = useMemo(() => {
    if (!savedDates) return false;
    const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
    return savedDates.includes(formattedSelectedDate);
  }, [savedDates, selectedDate]);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.dateButton, buttonStyle]} 
        onPress={openPicker}
      >
        <LucideCalendar size={20} color="#2563eb" />
        <View style={styles.dateTextContainer}>
            <Text style={styles.dateText}>
                {format(selectedDate, 'dd/MM/yyyy')}
            </Text>
            {isDateSaved && <View style={styles.savedDot} />}
        </View>
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
              markedDates={marks}
              renderArrow={(direction) => 
                direction === 'left' ? 
                <ChevronLeft size={24} color="#2563eb" /> : 
                <ChevronRight size={24} color="#2563eb" />
              }
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
  dateTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  savedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
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
