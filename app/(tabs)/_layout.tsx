import { Tabs, Redirect } from 'expo-router';
import { BookOpen, Receipt, Users, History, LogOut } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Alert } from 'react-native';

export default function TabLayout() {
  const { session, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  if (!session) {
    return <Redirect href="/(auth)/login" />;
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
          if (route.name === 'accounts') title = 'Accounts';
          if (route.name === 'history') title = 'History';
          return <Header title={title} showLogout onLogout={handleLogout} />;
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
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
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
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
