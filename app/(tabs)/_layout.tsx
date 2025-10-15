import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { BookOpen, History, ClipboardList, Settings, Users, BarChart2, PieChart } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function TabLayout() {
  const { session, signOut, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [session, isLoading, router]);

  if (isLoading || !session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        header: () => {
          let title = 'Day Book';
          if (route.name === 'daily-record') title = 'Daily Record';
          if (route.name === 'history') title = 'History';
          if (route.name === 'accounts') title = 'Accounts';
          if (route.name === 'reports') title = 'Reports';
          if (route.name === 'analytical') title = 'Analytics';
          if (route.name === 'settings') title = 'Settings';
          
          if (route.name === 'accounts') return null;
          
          return <Header title={title} showLogout={true} onLogout={signOut} />;
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Day Book',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="daily-record"
        options={{
          title: 'Daily Record',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
       <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
        }}
      />
       <Tabs.Screen
        name="analytical"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <PieChart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    }
});
