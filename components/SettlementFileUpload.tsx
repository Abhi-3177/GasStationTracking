import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Animated } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { format, isValid, addDays } from 'date-fns';
import { UploadCloud, File as FileIcon, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react-native';

import { Card } from './Card';
import { getDailyRecord, saveDailyRecord } from '../utils/database';
import { BankReconciliationEntry } from '../types/daybook';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNotification } from '../context/NotificationContext';

type ProcessingStatus = 'idle' | 'confirming' | 'processing' | 'success' | 'error';
type PaymentType = 'phonePeSale' | 'paytmSale' | 'atmSale';

function parseDateString(dateInput: any): Date | null {
  if (dateInput === null || dateInput === undefined) return null;

  if (typeof dateInput === 'number') {
    const excelDate = new Date((dateInput - 25569) * 86400 * 1000);
    if (isValid(excelDate)) {
      return new Date(Date.UTC(excelDate.getUTCFullYear(), excelDate.getUTCMonth(), excelDate.getUTCDate()));
    }
  }

  if (typeof dateInput !== 'string') return null;

  const trimmed = dateInput.trim();
  if (trimmed === '') return null;

  const monthMap: { [key: string]: number } = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const dmyMatch = trimmed.match(/^(\d{1,2})[ -]([a-zA-Z]{3})[ -](\d{2,4})$/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthStr = dmyMatch[2].toLowerCase();
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    
    if (monthMap[monthStr] !== undefined) {
      const month = monthMap[monthStr];
      const date = new Date(Date.UTC(year, month, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        return date;
      }
    }
  }

  const dmySlashMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (dmySlashMatch) {
    const day = parseInt(dmySlashMatch[1], 10);
    const month = parseInt(dmySlashMatch[2], 10);
    let year = parseInt(dmySlashMatch[3], 10);
    if (year < 100) year += 2000;
    
    if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900 && year < 2100) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return date;
      }
    }
  }
  
  return null;
}

export function SettlementFileUpload() {
  const { user } = useAuth();
  const { refreshData } = useData();
  const { showNotification } = useNotification();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [fileToProcess, setFileToProcess] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType>('phonePeSale');
  const [fileName, setFileName] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState('');
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
        if (lowerCaseName.includes('atm')) setSelectedPaymentType('atmSale');
        else if (lowerCaseName.includes('paytm')) setSelectedPaymentType('paytmSale');
        else setSelectedPaymentType('phonePeSale');
        setStatus('confirming');
      }
    } catch (error: any) {
      showNotification(`File upload error: ${error.message}`, 'error');
      resetState();
    }
  };

  const handleProcessConfirmedFile = async () => {
    if (!fileToProcess) return;
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
        workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      } else {
        const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        workbook = XLSX.read(fileContent, { type: 'base64' });
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, cellDates: false, defval: '' });

      if (jsonData.length === 0) throw new Error('File is empty.');

      let headerRowIndex = -1;
      let headers: string[] = [];
      let settlementDateIndex = -1;
      let amountIndex = -1;

      const dateAliases = ['settlement date', 'settlementdate'];
      const amountAliases: { [key in PaymentType]: string[] } = {
          phonePeSale: ['amount'],
          paytmSale: ['amount'],
          atmSale: ['gross amount', 'amount']
      };
      const currentAmountAliases = amountAliases[paymentType];

      for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const normalizedRow = row.map(h => String(h || '').trim().toLowerCase());
          const foundDateAlias = dateAliases.find(alias => normalizedRow.includes(alias));
          const foundAmountAlias = currentAmountAliases.find(alias => normalizedRow.includes(alias));

          if (foundDateAlias && foundAmountAlias) {
              headerRowIndex = i;
              headers = row.map(h => String(h || '').trim());
              settlementDateIndex = normalizedRow.indexOf(foundDateAlias);
              amountIndex = normalizedRow.indexOf(foundAmountAlias);
              break; 
          }
      }

      if (headerRowIndex === -1 || settlementDateIndex === -1 || amountIndex === -1) {
          const expectedHeaders = `a date column (e.g., "Settlement Date") and an amount column (e.g., "${paymentType === 'atmSale' ? 'Gross Amount' : 'Amount'}")`;
          const foundHeaders = headers.length > 0 ? `Found headers: ${headers.filter(h => h).join(', ')}` : "Could not identify a valid header row in the file.";
          throw new Error(`Required columns not found. Please ensure your file contains ${expectedHeaders}. ${foundHeaders}`);
      }
      
      const dataRows = jsonData.slice(headerRowIndex + 1);
      
      const settlementsByDate: { [date: string]: number } = {};
      const processingErrors: string[] = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every(cell => cell === '')) continue;

        const settlementDateRaw = row[settlementDateIndex];
        const amountRaw = row[amountIndex];
        
        let settlementDate = parseDateString(settlementDateRaw);
        
        if (settlementDate && paymentType === 'atmSale') {
          settlementDate = addDays(settlementDate, 1);
        }

        let amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw).replace(/,/g, ''));
        
        if (settlementDate && !isNaN(amount)) {
          const dateKey = format(settlementDate, 'yyyy-MM-dd');
          settlementsByDate[dateKey] = (settlementsByDate[dateKey] || 0) + amount;
        } else {
          const rowNumber = headerRowIndex + i + 2;
          if (!settlementDate) processingErrors.push(`Row ${rowNumber}: Invalid date format for value "${settlementDateRaw}".`);
          if (isNaN(amount)) processingErrors.push(`Row ${rowNumber}: Invalid amount format for value "${amountRaw}".`);
        }
      }

      if (Object.keys(settlementsByDate).length === 0) {
        if (processingErrors.length > 0) throw new Error(`File processing failed. Found ${processingErrors.length} errors. First error: ${processingErrors[0]}`);
        else throw new Error('No valid settlement data found to process.');
      }

      setProcessingMessage('Updating database records...');
      let updatedCount = 0;
      let totalProcessedAmount = 0;

      for (const date in settlementsByDate) {
        const dailyRecord = await getDailyRecord(date);
        const settlementAmount = settlementsByDate[date];

        if (dailyRecord) {
          const newReconciliation = dailyRecord.bankReconciliation.map(entry => {
            if (entry.type === paymentType) {
              const isMatched = Math.abs(settlementAmount - entry.expected) <= 1;
              return { ...entry, actual: settlementAmount, matched: isMatched };
            }
            return entry;
          }) as BankReconciliationEntry[];
          await saveDailyRecord({ ...dailyRecord, bankReconciliation: newReconciliation });
        } else {
          const newReconciliation: BankReconciliationEntry[] = [
            { type: 'atmSale', expected: 0, actual: 0, matched: false },
            { type: 'phonePeSale', expected: 0, actual: 0, matched: false },
            { type: 'paytmSale', expected: 0, actual: 0, matched: false },
            { type: 'cashDeposit', expected: 0, actual: 0, matched: false },
          ];
          const entryToUpdate = newReconciliation.find(e => e.type === paymentType);
          if (entryToUpdate) {
            entryToUpdate.actual = settlementAmount;
            entryToUpdate.matched = Math.abs(settlementAmount - entryToUpdate.expected) <= 1;
          }
          await saveDailyRecord({ date, user_id: user.id, bankReconciliation: newReconciliation, paymentsReceived: [] });
        }
        updatedCount++;
        totalProcessedAmount += settlementAmount;
      }

      setStatus('success');
      let successMessage = `Success! Updated ${updatedCount} daily records with a total of ₹${totalProcessedAmount.toFixed(2)}.`;
      if (processingErrors.length > 0) successMessage += `\nWarning: Skipped ${processingErrors.length} rows due to formatting errors.`;
      setProcessingMessage(successMessage);
      refreshData();
      Animated.timing(progress, { toValue: 1, duration: 500, useNativeDriver: false }).start();

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

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Card>
      <View style={styles.uploadHeader}>
        <UploadCloud size={20} color="#2563eb" />
        <Text style={styles.uploadTitle}>Settlement File Processing</Text>
      </View>
      <Text style={styles.uploadSubtitle}>
        Upload your daily settlement file to automatically update bank reconciliation records.
      </Text>
      
      {status === 'idle' && (
        <TouchableOpacity style={styles.uploadButton} onPress={handleFileUpload}>
          <Text style={styles.uploadButtonText}>Upload & Process File</Text>
        </TouchableOpacity>
      )}
    
      {status === 'confirming' && (
        <View style={styles.statusContainer}>
          <View style={styles.fileInfo}><FileIcon size={20} color="#6b7280" /><Text style={styles.fileName} numberOfLines={1}>{fileName}</Text></View>
          <Text style={styles.confirmLabel}>Confirm file type:</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity style={[styles.typeButton, selectedPaymentType === 'atmSale' && styles.typeButtonActive]} onPress={() => setSelectedPaymentType('atmSale')}><Text style={[styles.typeButtonText, selectedPaymentType === 'atmSale' && styles.typeButtonTextActive]}>ATM</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.typeButton, selectedPaymentType === 'phonePeSale' && styles.typeButtonActive]} onPress={() => setSelectedPaymentType('phonePeSale')}><Text style={[styles.typeButtonText, selectedPaymentType === 'phonePeSale' && styles.typeButtonTextActive]}>PhonePe</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.typeButton, selectedPaymentType === 'paytmSale' && styles.typeButtonActive]} onPress={() => setSelectedPaymentType('paytmSale')}><Text style={[styles.typeButtonText, selectedPaymentType === 'paytmSale' && styles.typeButtonTextActive]}>Paytm</Text></TouchableOpacity>
          </View>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={resetState}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.processButton]} onPress={handleProcessConfirmedFile}><Text style={styles.processButtonText}>Process File</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {(status === 'processing' || status === 'success' || status === 'error') && (
        <View style={styles.statusContainer}>
          {fileName && <View style={styles.fileInfo}><FileIcon size={20} color="#6b7280" /><Text style={styles.fileName} numberOfLines={1}>{fileName}</Text></View>}
          {status === 'processing' && <View style={styles.statusRow}><ActivityIndicator size="small" color="#2563eb" /><Text style={styles.statusText}>{processingMessage}</Text></View>}
          {(status === 'success' || status === 'error') && (
            <>
              <View style={styles.statusRow}>
                {status === 'success' ? <CheckCircle size={16} color="#059669" /> : <AlertTriangle size={16} color="#dc2626" />}
                <Text style={[styles.statusText, status === 'success' ? styles.successText : styles.errorText]}>{processingMessage}</Text>
              </View>
              {status === 'success' && <View style={styles.progressBarContainer}><Animated.View style={[styles.progressBar, { width: progressWidth }]} /></View>}
              <TouchableOpacity style={styles.resetButton} onPress={resetState}><RefreshCw size={16} color="#2563eb" /><Text style={styles.resetButtonText}>Process Another File</Text></TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
    uploadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    uploadTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
    uploadSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
    uploadButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    uploadButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    statusContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#f9fafb' },
    fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    fileName: { fontSize: 14, fontWeight: '500', color: '#374151', flexShrink: 1 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    statusText: { fontSize: 14, fontWeight: '500', color: '#2563eb', flex: 1 },
    successText: { color: '#059669' },
    errorText: { color: '#dc2626' },
    progressBarContainer: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden', width: '100%' },
    progressBar: { height: '100%', borderRadius: 2, backgroundColor: '#059669' },
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
});
