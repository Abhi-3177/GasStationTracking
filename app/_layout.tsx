import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { AuthProvider } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { NotificationProvider } from '../context/NotificationContext';
import NotificationContainer from '../components/NotificationContainer';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <DataProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(reports)" />
            <Stack.Screen name="account/[id]" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
          <NotificationContainer />
        </NotificationProvider>
      </DataProvider>
    </AuthProvider>
  );
}
