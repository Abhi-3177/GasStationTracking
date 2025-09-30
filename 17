import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fuel } from 'lucide-react-native';

interface HeaderProps {
  title?: string;
}

export function Header({ title = 'Staff Day Book' }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Fuel size={28} color="#2563eb" />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
});
