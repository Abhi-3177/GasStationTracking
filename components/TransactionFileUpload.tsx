import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { format, isValid } from 'date-fns';
import { UploadCloud, File as FileIcon, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react-native';

import { Card } from './Card';
import { getOrCreateSystemAccount, addPaymentReceived } from '../utils/database';
import { useNotification } from '../context/NotificationContext';
import { useData } from '../context/DataContext';

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

function parseDateString(dateInput: any): Date | null {
  if (dateInput === null || dateInput === undefined) return null;

  if (dateInput instanceof Date && isValid(dateInput)) {
    return new Date(Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate()));
  }

  if (typeof dateInput === 'number' && dateInput > 1) {
    const excelDate = new Date((dateInput - 25569) * 86400 * 1000);
    if (isValid(excelDate)) {
      return new Date(Date.UTC(excelDate.getUTCFullYear(), excelDate.getUTCMonth(), excelDate.getUTCDate()));
    }
  }

  if (typeof dateInput !== 'string') return null;
  
  const cleanedString = dateInput.trim().replace(/^['"]|['"]$/g, '');
  
  if (cleanedString === '') return null;

  const parsed = new Date(cleanedString);
  if (isValid(parsed)) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return null;
}

export function TransactionFileUpload() {
  const { showNotification } = useNotification();
  const { refreshData } = useData();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        setStatus('processing');
        setMessage('Reading file...');
        await processFile(file);
      }
    } catch (error: any) {
      showNotification(`File selection failed: ${error.message}`, 'error');
      resetState();
    }
  };

  const processFile = async (file: DocumentPicker.DocumentPickerAsset) => {
    try {
      let workbook: XLSX.WorkBook;
      setMessage('Reading file data...');
      
      if (Platform.OS === 'web') {
        const webFile = (file as any).file as File;
        if (!webFile) throw new Error('File object not found for web platform.');
        const arrayBuffer = await webFile.arrayBuffer();
        workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: true });
      } else {
        const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        workbook = XLSX.read(fileContent, { type: 'base64', cellDates: true });
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });

      if (jsonData.length === 0) throw new Error('File is empty or has no data rows.');

      const originalHeaders = Object.keys(jsonData[0]);
      const findKey = (aliases: string[]): string | undefined => {
        return originalHeaders.find(h => aliases.includes(h.trim().toLowerCase()));
      };

      const transactionIdKey = findKey(['transaction_id', 'transaction id']);
      const transactionDateKey = findKey(['transaction_date', 'transaction date']);
      const settledAmountKey = findKey(['settled_amount', 'settled amount']);

      if (!transactionIdKey || !transactionDateKey || !settledAmountKey) {
        throw new Error(`File must contain "Transaction_ID", "Transaction_Date", and "Settled_Amount" columns. Found: ${originalHeaders.join(', ')}`);
      }
      
      setMessage('Getting system account for Paytm...');
      const paytmAccount = await getOrCreateSystemAccount('Paytm');
      if (!paytmAccount) throw new Error('Could not get or create system account for Paytm.');

      let successCount = 0;
      let duplicateCount = 0;
      const errors: Record<string, number[]> = {};
      const importedDates = new Set<string>();

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2;

        const dateRaw = row[transactionDateKey];
        const amountRaw = row[settledAmountKey];
        const transactionId = row[transactionIdKey];

        const date = parseDateString(dateRaw);
        const amount = amountRaw !== null ? parseFloat(String(amountRaw).replace(/,/g, '')) : NaN;
        
        let primaryError: string | null = null;
        if (!date) {
            primaryError = 'Invalid date format';
        } else if (isNaN(amount) || amount <= 0) {
            primaryError = 'Invalid amount';
        } else if (!transactionId) {
            primaryError = 'Missing Transaction ID';
        }

        if (primaryError) {
            if (!errors[primaryError]) errors[primaryError] = [];
            errors[primaryError].push(rowNum);
        } else if (date) {
          const payment = {
            date: format(date, 'yyyy-MM-dd'),
            accountId: paytmAccount.id,
            amount: amount,
            description: 'Paytm Transaction',
            receiptNumber: String(transactionId),
            paymentMethod: 'Paytm',
          };

          try {
            await addPaymentReceived(payment);
            successCount++;
            importedDates.add(payment.date);
          } catch(e: any) {
            let reason = 'An unknown error occurred';
            
            // Check for unique constraint violation first
            if (e.message?.includes('duplicate key') || e.code === '23505' || e.message?.includes('already been used')) {
                duplicateCount++;
                continue; // Skip adding to errors list, as this is expected behavior
            } 
            // Check for RLS violation
            else if (e.message?.includes('row-level security')) {
                reason = 'Row-Level Security Policy Violation';
            }
            // Fallback to the actual Supabase message if available
            else {
                reason = e.message || 'Failed to save row.';
            }

            if (!errors[reason]) {
                errors[reason] = [];
            }
            errors[reason].push(rowNum);
          }
        }
      }
      
      const failedRowCount = Object.values(errors).reduce((sum, rows) => sum + rows.length, 0);

      if (successCount === 0 && failedRowCount > 0) {
        const errorSummary = Object.entries(errors)
            .map(([reason, rowNumbers]) => `- ${reason} (${rowNumbers.length} errors): Rows ${rowNumbers.slice(0, 10).join(', ')}${rowNumbers.length > 10 ? '...' : ''}`)
            .join('\n');
        throw new Error(`Processed ${jsonData.length} rows but found 0 valid entries. Errors found:\n${errorSummary}`);
      }

      setStatus('success');
      
      let dateInfo = '';
      if (importedDates.size > 0) {
          const dates = Array.from(importedDates).map(d => new Date(d));
          dates.sort((a, b) => a.getTime() - b.getTime());
          
          const firstDate = dates[0];
          const lastDate = dates[dates.length - 1];
          
          const tzOffset1 = firstDate.getTimezoneOffset() * 60000;
          const adjustedFirstDate = new Date(firstDate.getTime() + tzOffset1);

          if (dates.length === 1) {
              dateInfo = ` for ${format(adjustedFirstDate, 'dd-MMM-yyyy')}`;
          } else {
              const tzOffset2 = lastDate.getTimezoneOffset() * 60000;
              const adjustedLastDate = new Date(lastDate.getTime() + tzOffset2);
              dateInfo = ` for dates between ${format(adjustedFirstDate, 'dd-MMM-yyyy')} and ${format(adjustedLastDate, 'dd-MMM-yyyy')}`;
          }
      }

      let finalMessage = `Success! Imported ${successCount} new transactions${dateInfo}.`;
      if (duplicateCount > 0) {
        finalMessage += ` Skipped ${duplicateCount} duplicates.`;
      }
      if (failedRowCount > 0) {
        const errorSummary = Object.entries(errors)
            .map(([reason, rowNumbers]) => `- ${reason} (${rowNumbers.length} errors): Rows ${rowNumbers.slice(0, 10).join(', ')}${rowNumbers.length > 10 ? '...' : ''}`)
            .join('\n');
        finalMessage += `\nSkipped ${failedRowCount} rows with errors. Errors found:\n${errorSummary}`;
      }
      setMessage(finalMessage);
      refreshData();

    } catch (error: any) {
      console.error('Paytm log upload error:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  const resetState = () => {
    setStatus('idle');
    setFileName(null);
    setMessage('');
  };

  return (
    <Card>
      <View style={styles.uploadHeader}>
        <UploadCloud size={20} color="#0ea5e9" />
        <Text style={styles.uploadTitle}>Paytm Transaction Log Upload</Text>
      </View>
      <Text style={styles.uploadSubtitle}>
        Upload your detailed Paytm settlement report to automatically add each transaction to the respective Daily Record.
      </Text>

      {status === 'idle' && (
        <TouchableOpacity style={styles.uploadButton} onPress={handleSelectFile}>
          <Text style={styles.uploadButtonText}>Select & Upload Paytm Log</Text>
        </TouchableOpacity>
      )}

      {(status === 'processing' || status === 'success' || status === 'error') && (
        <View style={styles.statusContainer}>
          {fileName && <View style={styles.fileInfo}><FileIcon size={20} color="#6b7280" /><Text style={styles.fileName} numberOfLines={1}>{fileName}</Text></View>}
          <View style={styles.statusRow}>
            {status === 'processing' && <ActivityIndicator size="small" color="#0ea5e9" />}
            {status === 'success' && <CheckCircle size={16} color="#059669" />}
            {status === 'error' && <AlertTriangle size={16} color="#dc2626" />}
            <Text style={[styles.statusText, status === 'error' && styles.errorText, status === 'success' && styles.successText]}>{message}</Text>
          </View>
          {(status === 'success' || status === 'error') && (
            <TouchableOpacity style={styles.resetButton} onPress={resetState}>
              <RefreshCw size={16} color="#2563eb" />
              <Text style={styles.resetButtonText}>Upload Another File</Text>
            </TouchableOpacity>
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
  uploadButton: { backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  uploadButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  statusContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#f9fafb' },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#374151', flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '500', flex: 1 },
  successText: { color: '#059669' },
  errorText: { color: '#dc2626' },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 6 },
  resetButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
});
