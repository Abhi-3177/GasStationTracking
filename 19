import React, { useState, useEffect } from 'react';
import { TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';

interface NumberInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: number;
  onChangeValue: (value: number) => void;
  style?: ViewStyle;
  precision?: number;
}

export function NumberInput({ value, onChangeValue, style, precision, ...props }: NumberInputProps) {
  const [textValue, setTextValue] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    const parentValueStr = String(value);
    const textValueAsNumber = parseFloat(textValue);
    
    if (textValueAsNumber !== value || (textValue === '' && value !== 0) || (textValue !== '' && value === 0)) {
       setTextValue(value === 0 ? '' : parentValueStr);
    }
  }, [value]);

  const handleChangeText = (text: string) => {
    const regex = precision !== undefined 
      ? new RegExp(`^\\d*\\.?\\d{0,${precision}}$`)
      : /^\d*\.?\d*$/;

    if (regex.test(text)) {
      setTextValue(text);
      if (text.endsWith('.')) {
        return;
      }
      const numericValue = parseFloat(text);
      onChangeValue(isNaN(numericValue) ? 0 : numericValue);
    }
  };
  
  const handleBlur = () => {
    const numericValue = parseFloat(textValue);
    if (isNaN(numericValue)) {
        onChangeValue(0);
        setTextValue('');
    } else {
        onChangeValue(numericValue);
    }
  };

  return (
    <TextInput
      {...props}
      style={[styles.input, style]}
      value={textValue}
      onChangeText={handleChangeText}
      onBlur={handleBlur}
      keyboardType="decimal-pad"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
});
