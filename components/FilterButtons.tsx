import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface FilterButtonsProps {
  options: string[];
  values: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function FilterButtons({ options, values, selectedValue, onSelect }: FilterButtonsProps) {
  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={values[index]}
          style={[
            styles.button,
            selectedValue === values[index] && styles.activeButton,
          ]}
          onPress={() => onSelect(values[index])}
        >
          <Text
            style={[
              styles.buttonText,
              selectedValue === values[index] && styles.activeButtonText,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  activeButton: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  activeButtonText: {
    color: '#fff',
  },
});
