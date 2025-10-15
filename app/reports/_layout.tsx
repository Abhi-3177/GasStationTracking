import { Stack } from 'expo-router';
import React from 'react';

export default function ReportsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen 
        name="monthly-sales" 
        options={{ 
          title: 'Monthly Sales Summary',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }} 
      />
      <Stack.Screen 
        name="stock-report" 
        options={{ 
          title: 'Stock Report',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }} 
      />
      <Stack.Screen 
        name="aged-debtors" 
        options={{ 
          title: 'Aged Debtors Report',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }} 
      />
      <Stack.Screen 
        name="account-statement" 
        options={{ 
          title: 'Account Statement',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }} 
      />
    </Stack>
  );
}
