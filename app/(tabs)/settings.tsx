import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Animated, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { format, isValid, parse } from 'date-fns';
import { Settings as SettingsIcon, UploadCloud, File as FileIcon, CheckCircle, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { getDailyRecord, saveDailyRecord, deleteAllUserData } from '../../utils/database';
import { clearAllLocalStorage } from '../../utils/storage';
import { BankReconciliationEntry } from '../../types/daybook';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

type ProcessingStatus = 'idle' | 'confirming' | 'processing' | 'success' | 'error';
type PaymentType = 'phonePeSale' | 'paytmSale';

/**
 * A robust, timezone-safe date parsing function that correctly handles DD/MM/YYYY.
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  // Specifically handle DD/MM/YYYY
  const parsedDate = parse(trimmed, 'dd/MM/yyyy', new Date());
  if (isValid(parsedDate)) {
    return parsedDate;
  }

  // Fallback for other common formats like YYYY-MM-DD or native Date strings
  const fallbackDate = new Date(trimmed);
  if (isValid(fallbackDate)) {
    // Adjust for timezone if it's just a date string without time
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const timezoneOffset = fallbackDate.getTimezoneOffset() * 60000;
        return new Date(fallbackDate.getTime() + timezoneOffset);
    }
    return fallbackDate;
  }

  return null;
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { refreshData } = useData();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [fileToProcess, setFileToProcess] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType>('phonePeSale');
  const [fileName, setFileName] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileToProcess(file);
        setFileName(file.name);

        const lowerCaseName = file.name.toLowerCase();
        if (lowerCaseName.includes('paytm')) {
          setSelectedPaymentType('paytmSale');
        } else {
          setSelectedPaymentType('phonePeSale');
        }
        setStatus('confirming');
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message}`);
      resetState();
    }
  };

  const handleProcessConfirmedFile = async () => {
    if (!fileToProcess) {
      Alert.alert('Error', 'No file selected.');
      return;
    }
    setStatus('processing');
    setProcessingMessage('Reading file...');
    progress.setValue(0);
    await processFile(fileToProcess, selectedPaymentType);
  };

  const processFile = async (file: DocumentPicker.DocumentPickerAsset, paymentType: PaymentType) => {
    if (!user) {
      setStatus('error');
      setProcessingMessage('Authentication error: User not found.');
      return;
    }

    try {
      let workbook: XLSX.WorkBook;
      setProcessingMessage('Reading file data...');
      
      if (Platform.OS === 'web') {
        const webFile = (file as any).file as File;
        if (!webFile) throw new Error('File object not found for web platform.');
        const arrayBuffer = await webFile.arrayBuffer();
        workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: true });
      } else {
        const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        workbook = XLSX.read(fileContent, { type: 'base64', cellDates: true });
      }

      setProcessingMessage('Parsing spreadsheet data...');
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) throw new Error('File is empty or has no data rows.');

      const headers: string[] = jsonData[0].map(h => typeof h === 'string' ? h.trim() : h);
      const settlementDateIndex = headers.indexOf('SettlementDate');
      const amountIndex = headers.indexOf('Amount');

      if (settlementDateIndex === -1 || amountIndex === -1) {
        throw new Error('Required columns "SettlementDate" or "Amount" not found.');
      }
      
      const settlementsByDate: { [date: string]: number } = {};
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const settlementDateRaw = row[settlementDateIndex];
        const amountRaw = row[amountIndex];
        
        const settlementDate = parseDateString(settlementDateRaw);
        const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(amountRaw);
        
        if (settlementDate && !isNaN(amount)) {
          const dateKey = format(settlementDate, 'yyyy-MM-dd');
          settlementsByDate[dateKey] = (settlementsByDate[dateKey] || 0) + amount;
        }
      }

      setProcessingMessage('Updating database records...');
      let updatedCount = 0;
      let totalProcessedAmount = 0;

      for (const date in settlementsByDate) {
        const dailyRecord = await getDailyRecord(date);
        const settlementAmount = settlementsByDate[date];

        if (dailyRecord) {
          const newReconciliation = dailyRecord.bankReconciliation.map(entry =>
            entry.type === paymentType ? { ...entry, actual: settlementAmount } : entry
          ) as BankReconciliationEntry[];
          await saveDailyRecord({ ...dailyRecord, bankReconciliation: newReconciliation });
        } else {
          const newReconciliation: BankReconciliationEntry[] = [
            { type: 'atmSale', expected: 0, actual: 0, matched: false },
            { type: 'phonePeSale', expected: 0, actual: 0, matched: false },
            { type: 'paytmSale', expected: 0, actual: 0, matched: false },
            { type: 'cashDeposit', expected: 0, actual: 0, matched: false },
          ];
          const entryToUpdate = newReconciliation.find(e => e.type === paymentType);
          if (entryToUpdate) entryToUpdate.actual = settlementAmount;
          await saveDailyRecord({
            date: date,
            user_id: user.id,
            bankReconciliation: newReconciliation,
            paymentsReceived: [],
          });
        }
        updatedCount++;
        totalProcessedAmount += settlementAmount;
      }

      if (updatedCount > 0) {
        setStatus('success');
        const datesUpdated = Object.keys(settlementsByDate);
        let successMessage = '';
        if (updatedCount === 1) {
          const dateForDisplay = parse(datesUpdated[0], 'yyyy-MM-dd', new Date());
          const friendlyDate = format(dateForDisplay, 'PPP');
          successMessage = `Success! Updated record for ${friendlyDate} with a total of ₹${totalProcessedAmount.toFixed(2)}.`;
        } else {
          successMessage = `Success! Updated ${updatedCount} daily records with a total of ₹${totalProcessedAmount.toFixed(2)}.`;
        }
        setProcessingMessage(successMessage);
        refreshData(); // Trigger app-wide data refresh
        Animated.timing(progress, { toValue: 1, duration: 500, useNativeDriver: false }).start();
      } else {
        setStatus('error');
        setProcessingMessage('No valid settlement data found to process. Please check the file contents and format.');
      }

    } catch (error: any) {
      console.error('File processing error:', error);
      setStatus('error');
      setProcessingMessage(`Error: ${error.message}`);
    }
  };

  const resetState = () => {
    setStatus('idle');
    setFileToProcess(null);
    setFileName(null);
    setProcessingMessage('');
    progress.setValue(0);
  };
  
  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete All Data',
      'Are you absolutely sure? This will permanently delete all day book records, accounts, and daily records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setStatus('processing');
            setProcessingMessage('Deleting all data...');
            progress.setValue(0);
            Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }).start();

            try {
              await deleteAllUserData();
              await clearAllLocalStorage();
              setProcessingMessage('All data deleted successfully. App will now restart.');
              setStatus('success');

              setTimeout(() => {
                signOut(); // This will log the user out and reset the app state
              }, 1500);

            } catch (error: any) {
              console.error('Error deleting all data:', error);
              setStatus('error');
              setProcessingMessage(`Failed to delete data: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const renderUploadState = () => {
    if (status === 'idle') {
      return (
        <TouchableOpacity style={styles.uploadButton} onPress={handleFileUpload}>
          <Text style={styles.uploadButtonText}>Upload & Process File</Text>
        </TouchableOpacity>
      );
    }
    
    if (status === 'confirming') {
      return (
        <View style={styles.statusContainer}>
          <View style={styles.fileInfo}>
            <FileIcon size={20} color="#6b7280" />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          </View>
          <Text style={styles.confirmLabel}>Confirm payment type for this file:</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, selectedPaymentType === 'phonePeSale' && styles.typeButtonActive]}
              onPress={() => setSelectedPaymentType('phonePeSale')}
            >
              <Text style={[styles.typeButtonText, selectedPaymentType === 'phonePeSale' && styles.typeButtonTextActive]}>PhonePe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, selectedPaymentType === 'paytmSale' && styles.typeButtonActive]}
              onPress={() => setSelectedPaymentType('paytmSale')}
            >
              <Text style={[styles.typeButtonText, selectedPaymentType === 'paytmSale' && styles.typeButtonTextActive]}>Paytm</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={resetState}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.processButton]} onPress={handleProcessConfirmedFile}>
              <Text style={styles.processButtonText}>Process File</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    return (
      <View style={styles.statusContainer}>
        <View style={styles.fileInfo}>
          <FileIcon size={20} color="#6b7280" />
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
        </View>

        {status === 'processing' && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.statusText}>{processingMessage}</Text>
          </View>
        )}

        {(status === 'success' || status === 'error') && (
          <>
            <View style={styles.statusRow}>
              {status === 'success' ? <CheckCircle size={16} color="#059669" /> : <AlertTriangle size={16} color="#dc2626" />}
              <Text style={[styles.statusText, status === 'success' ? styles.successText : styles.errorText]}>
                {processingMessage}
              </Text>
            </View>
            {status === 'success' && (
              <View style={styles.progressBarContainer}>
                <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
              </View>
            )}
            <TouchableOpacity style={styles.resetButton} onPress={resetState}>
              <RefreshCw size={16} color="#2563eb" />
              <Text style={styles.resetButtonText}>Process Another File</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderDeleteState = () => {
    const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    if (status === 'processing' && processingMessage.includes('Deleting')) {
      return (
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#dc2626" />
            <Text style={[styles.statusText, styles.errorText]}>{processingMessage}</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: '#dc2626' }]} />
          </View>
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
        onPress={handleDeleteAllData}
        disabled={isDeleting || status === 'processing'}
      >
        <Trash2 size={16} color="#ffffff" />
        <Text style={styles.deleteButtonText}>Delete All Application Data</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Card>
              <View style={styles.headerSection}>
                <SettingsIcon size={24} color="#1f2937" />
                <Text style={styles.title}>App Settings</Text>
              </View>
            </Card>

            <Card>
              <View style={styles.uploadHeader}>
                <UploadCloud size={20} color="#2563eb" />
                <Text style={styles.uploadTitle}>Settlement File Processing</Text>
              </View>
              <Text style={styles.uploadSubtitle}>
                Upload your daily settlement file (CSV or Excel) to automatically update bank reconciliation records.
              </Text>
              {renderUploadState()}
            </Card>

            <Card style={styles.dangerZoneCard}>
              <View style={styles.dangerZoneHeader}>
                <AlertTriangle size={20} color="#991b1b" />
                <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              </View>
              <Text style={styles.dangerZoneSubtitle}>
                This action is destructive and cannot be undone. It will delete all records from the database and local storage.
              </Text>
              {renderDeleteState()}
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16 },
  headerSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  uploadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  uploadTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  uploadSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  uploadButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  uploadButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  statusContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#f9fafb' },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#374151', flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#2563eb', flex: 1 },
  successText: { color: '#059669' },
  errorText: { color: '#dc2626' },
  progressBarContainer: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#059669', borderRadius: 4 },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 6 },
  resetButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  confirmLabel: { fontSize: 14, color: '#374151', marginBottom: 12, fontWeight: '500' },
  typeSelector: { flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  typeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ffffff' },
  typeButtonActive: { backgroundColor: '#2563eb' },
  typeButtonText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  typeButtonTextActive: { color: '#ffffff' },
  confirmActions: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { color: '#374151', fontWeight: '600' },
  processButton: { backgroundColor: '#059669' },
  processButtonText: { color: '#ffffff', fontWeight: '600' },
  dangerZoneCard: {
    borderWidth: 2,
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dangerZoneTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#991b1b',
  },
  dangerZoneSubtitle: {
    fontSize: 14,
    color: '#b91c1c',
    marginBottom: 16,
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
