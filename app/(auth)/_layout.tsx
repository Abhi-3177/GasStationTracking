import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function AuthLayout() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If the user is signed in and we are not still loading, redirect them away.
    if (!isLoading && session) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading]);

  // While loading, show a spinner to prevent flashing the login screen.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Only render the auth stack if there is no session.
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    }
});
