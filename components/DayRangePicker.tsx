import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { DateSelector } from './DateSelector';

interface DayRangePickerProps {
  range: { start: Date; end: Date };
  onRangeChange: (range: { start: Date; end: Date }) => void;
}

export function DayRangePicker({ range, onRangeChange }: DayRangePickerProps) {
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
        <Text style={styles.label}>Start Date</Text>
        <DateSelector selectedDate={range.start} onDateChange={handleStartChange} />
      </View>
      <View style={styles.pickerContainer}>
        <Text style={styles.label}>End Date</Text>
        <DateSelector selectedDate={range.end} onDateChange={handleEndChange} />
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
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    paddingLeft: 4,
  }
});
