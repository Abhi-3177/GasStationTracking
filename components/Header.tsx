import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Fuel, LogOut } from 'lucide-react-native';

interface HeaderProps {
  title?: string;
  showLogout?: boolean;
  onLogout?: () => void;
}

export function Header({ title = 'Staff Day Book', showLogout = false, onLogout }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Fuel size={28} color="#2563eb" />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {showLogout && onLogout && (
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <LogOut size={24} color="#374151" />
        </TouchableOpacity>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  logoutButton: {
    padding: 8,
  },
});
