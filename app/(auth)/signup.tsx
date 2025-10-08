import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Fuel, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Please fill out all fields.');
      return;
    }

    setIsLoading(true);
    const trimmedEmail = email.trim();
    console.log('Attempting to sign up with email:', trimmedEmail);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail, // Use the trimmed email
        password,
      });

      console.log('Supabase signUp response:', { data, error });

      if (error) {
        console.error('Sign up failed with Supabase error:', error);
        if (error.message.includes("User already registered")) {
            Alert.alert('Sign Up Failed', 'An account with this email address already exists. Please log in instead.');
        } else {
            Alert.alert('Sign Up Failed', `[Code: ${error.code || 'Unknown'}] ${error.message}`);
        }
      } else {
        Alert.alert(
          'Sign Up Initiated',
          'Your account has been created. If email confirmation is required, please check your inbox to complete the process.'
        );
        router.replace('/(auth)/login');
      }
    } catch (e: any) {
      console.error('An unexpected exception occurred during sign up:', e);
      Alert.alert(
        'Unexpected Error',
        e.message || 'An unknown error occurred. Please check the console for more details.'
      );
    } finally {
      console.log('Sign up process finished.');
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Fuel size={48} color="#2563eb" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us to start tracking your sales.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              {showPassword ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{isLoading ? 'Creating Account...' : 'Sign Up'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>Log In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1f2937', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  form: { gap: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' },
  inputIcon: { marginHorizontal: 12 },
  input: { flex: 1, height: 50, paddingRight: 12, fontSize: 16, color: '#1f2937' },
  eyeIcon: { padding: 12 },
  button: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: '#6b7280' },
  linkText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
