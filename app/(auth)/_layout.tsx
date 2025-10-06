import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function AuthLayout() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
