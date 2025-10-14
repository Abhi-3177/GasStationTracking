import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Account } from '../types/daybook';

interface AccountAutocompleteProps {
  accounts: Account[];
  value: string;
  onValueChange: (text: string) => void;
  onAccountSelect: (account: Account) => void;
  placeholder?: string;
}

export function AccountAutocomplete({
  accounts,
  value,
  onValueChange,
  onAccountSelect,
  placeholder = "Type to search...",
}: AccountAutocompleteProps) {
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value && value.length > 0 && isFocused) {
      const trimmedValue = value.trim().toLowerCase();
      if (trimmedValue) {
        setFilteredAccounts(
          accounts.filter(account =>
            account.name.trim().toLowerCase().startsWith(trimmedValue)
          )
        );
      } else {
        setFilteredAccounts([]);
      }
    } else {
      setFilteredAccounts([]);
    }
  }, [value, accounts, isFocused]);

  const handleSelect = (account: Account) => {
    onAccountSelect(account);
    setIsFocused(false);
    setFilteredAccounts([]);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onValueChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 300)} // Increased delay
        placeholder={placeholder}
      />
      {isFocused && filteredAccounts.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={filteredAccounts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPressIn={() => handleSelect(item)} // Use onPressIn for reliability
              >
                <Text style={styles.dropdownItemText}>{item.name}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginTop: 4,
    maxHeight: 150,
    zIndex: 2,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1f2937',
  },
});
