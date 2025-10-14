import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MonthPicker } from './MonthPicker';

interface DateRangePickerProps {
  range: { start: Date; end: Date };
  onRangeChange: (range: { start: Date; end: Date }) => void;
}

export function DateRangePicker({ range, onRangeChange }: DateRangePickerProps) {
  const handleStartChange = (date: Date) => {
    if (date > range.end) {
      onRangeChange({ start: date, end: date });
    } else {
      onRangeChange({ ...range, start: date });
    }
  };

  const handleEndChange = (date: Date) => {
    if (date < range.start) {
      onRangeChange({ start: date, end: date });
    } else {
      onRangeChange({ ...range, end: date });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pickerContainer}>
        <MonthPicker selectedDate={range.start} onDateChange={handleStartChange} />
      </View>
      <View style={styles.pickerContainer}>
        <MonthPicker selectedDate={range.end} onDateChange={handleEndChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerContainer: {
    flex: 1,
  },
});
