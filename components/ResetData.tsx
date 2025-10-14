import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Trash2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react-native';

import { ConfirmModal } from './ConfirmModal';
import { deleteAllUserData } from '../utils/database';
import { useAuth } from '../context/AuthContext';

export function ResetData() {
  const { signOut } = useAuth();
  const [status, setStatus] = useState<'idle' | 'deleting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const progress = useRef(new Animated.Value(0)).current;
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [percentage, setPercentage] = useState('0');

  const progressPercentage = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });

  useEffect(() => {
    const listener = progressPercentage.addListener(({ value }) => {
      setPercentage(Math.round(value).toString());
    });
    return () => {
      progressPercentage.removeListener(listener);
    };
  }, [progressPercentage]);

  const handleDeleteAllData = () => {
    setIsConfirmModalVisible(true);
  };

  const performDeleteAllData = async () => {
    setIsConfirmModalVisible(false);
    setStatus('deleting');
    setMessage('Deleting all data...');
    progress.setValue(0);

    Animated.timing(progress, { toValue: 0.5, duration: 1500, useNativeDriver: false }).start();

    try {
      await deleteAllUserData();
      setMessage('Deletion successful. Restarting app...');
      
      Animated.timing(progress, { toValue: 1, duration: 500, useNativeDriver: false }).start(() => {
        setStatus('success');
        setTimeout(signOut, 1000);
      });

    } catch (error: any) {
      console.error("Error deleting all data:", error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const progressColor = status === 'error' ? '#dc2626' : '#059669';

  if (status === 'idle') {
    return (
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAllData}>
        <Trash2 size={16} color="#ffffff" />
        <Text style={styles.deleteButtonText}>Reset All Application Data</Text>
        <ConfirmModal
          visible={isConfirmModalVisible}
          title="Confirm Reset"
          message="Are you sure you want to reset all application data? This action is irreversible and will permanently remove all day books, daily records, and accounts."
          onCancel={() => setIsConfirmModalVisible(false)}
          onConfirm={performDeleteAllData}
          confirmText="RESET"
          isDestructive={true}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusRow}>
        {status === 'deleting' && <ActivityIndicator size="small" color="#dc2626" />}
        {status === 'success' && <CheckCircle size={16} color="#059669" />}
        {status === 'error' && <AlertTriangle size={16} color="#dc2626" />}
        <Text style={[styles.statusText, status === 'success' ? styles.successText : styles.errorText]}>
          {message}
        </Text>
      </View>
      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: progressColor }]} />
        <Text style={styles.progressText}>{percentage}%</Text>
      </View>
      {status === 'error' && (
        <TouchableOpacity style={styles.resetButton} onPress={() => setStatus('idle')}>
          <RefreshCw size={16} color="#2563eb" />
          <Text style={styles.resetButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
    deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 8 },
    deleteButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    statusContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#f9fafb' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    statusText: { fontSize: 14, fontWeight: '500', color: '#dc2626', flex: 1 },
    successText: { color: '#059669' },
    errorText: { color: '#dc2626' },
    progressBarContainer: { height: 24, backgroundColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', width: '100%', justifyContent: 'center' },
    progressBar: { height: '100%', borderRadius: 12 },
    progressText: { position: 'absolute', alignSelf: 'center', color: '#ffffff', fontWeight: 'bold', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 6 },
    resetButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
});
