import { Tabs, Redirect } from 'expo-router';
import { BookOpen, Users, History, ClipboardList, Settings } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';

export default function TabLayout() {
  const { session, signOut } = useAuth();

  if (!session) {
    return <Redirect href="/" />;
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
          if (route.name === 'settings') title = 'Settings';
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
