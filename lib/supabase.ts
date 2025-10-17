import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
}

// A simple in-memory storage for server-side rendering where AsyncStorage is not available.
const memoryStorage = {
  getItem: (key: string) => {
    return null;
  },
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
};

// Check if we are in a server-side environment (e.g., during Expo Router's static export)
const isServer = typeof window === 'undefined';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use memoryStorage on the server and AsyncStorage on the client.
    storage: isServer ? memoryStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
