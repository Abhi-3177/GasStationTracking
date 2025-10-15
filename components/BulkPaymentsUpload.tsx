import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { UploadCloud, File as FileIcon, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react-native';

import { bulkAddPayments } from '../utils/database';
import { useNotification } from '../context/NotificationContext';
import { useData } from '../context/DataContext';

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

interface BulkPaymentsUploadProps {
  date: string;
}

export function BulkPaymentsUpload({ date }: BulkPaymentsUploadProps) {
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
        workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      } else {
        const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        workbook = XLSX.read(fileContent, { type: 'base64' });
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      if (jsonData.length === 0) throw new Error('File is empty or has no data rows.');

      const originalHeaders = Object.keys(jsonData[0]);
      const findKey = (aliases: string[]): string | undefined => {
        return originalHeaders.find(h => aliases.includes(h.trim().toLowerCase()));
      };

      const accountNameKey = findKey(['account name', 'account_name', 'account']);
      const amountKey = findKey(['amount']);
      const descriptionKey = findKey(['description', 'desc']);
      const receiptNumberKey = findKey(['receipt number', 'receipt_number', 'receipt no']);

      if (!accountNameKey || !amountKey) {
        throw new Error(`File must contain "Account Name" and "Amount" columns. Found: ${originalHeaders.join(', ')}`);
      }
      
      const paymentsToUpload = jsonData.map((row, index) => {
        const accountName = row[accountNameKey];
        const amount = parseFloat(String(row[amountKey]).replace(/,/g, ''));

        if (accountName && !isNaN(amount) && amount > 0) {
          return {
            account_name: String(accountName).trim(),
            amount: amount,
            description: descriptionKey ? String(row[descriptionKey] || '') : '',
            receipt_number: receiptNumberKey ? String(row[receiptNumberKey] || '') : '',
          };
        }
        return null;
      }).filter((p): p is NonNullable<typeof p> => p !== null);


      if (paymentsToUpload.length === 0) {
        throw new Error('No valid payment rows found in the file. Check data format.');
      }

      setMessage(`Saving ${paymentsToUpload.length} payments to the database...`);
      await bulkAddPayments(date, paymentsToUpload);

      setStatus('success');
      setMessage(`Success! Imported ${paymentsToUpload.length} payments for ${date}.`);
      refreshData();

    } catch (error: any) {
      console.error('Bulk payments upload error:', error);
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
    <View style={styles.container}>
        {status === 'idle' ? (
            <TouchableOpacity style={styles.uploadButton} onPress={handleSelectFile}>
                <UploadCloud size={16} color="#2563eb" />
                <Text style={styles.uploadButtonText}>Bulk Upload</Text>
            </TouchableOpacity>
        ) : (
            <View style={styles.statusContainer}>
                <View style={styles.statusRow}>
                    {status === 'processing' && <ActivityIndicator size="small" color="#2563eb" />}
                    {status === 'success' && <CheckCircle size={16} color="#059669" />}
                    {status === 'error' && <AlertTriangle size={16} color="#dc2626" />}
                    <Text style={[styles.statusText, status === 'error' && styles.errorText, status === 'success' && styles.successText]} numberOfLines={2}>{message}</Text>
                </View>
                {(status === 'success' || status === 'error') && (
                    <TouchableOpacity style={styles.resetButton} onPress={resetState}>
                        <RefreshCw size={14} color="#2563eb" />
                        <Text style={styles.resetButtonText}>Upload Another</Text>
                    </TouchableOpacity>
                )}
            </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  statusContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  successText: {
    color: '#059669',
  },
  errorText: {
    color: '#dc2626',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    marginLeft: 12,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
});
