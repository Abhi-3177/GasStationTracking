import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { UploadCloud, File as FileIcon, CheckCircle, RefreshCw, AlertTriangle, X } from 'lucide-react-native';

import { bulkCreateAccounts } from '../utils/database';
import { useNotification } from '../context/NotificationContext';
import { useData } from '../context/DataContext';

type ProcessingStatus = 'idle' | 'confirming' | 'processing' | 'success' | 'error';

interface BulkAccountUploadProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function BulkAccountUpload({ visible, onClose, onSave }: BulkAccountUploadProps) {
  const { showNotification } = useNotification();
  const { refreshData } = useData();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [accountsToUpload, setAccountsToUpload] = useState<any[]>([]);

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        await processFile(file);
      }
    } catch (error: any) {
      showNotification(`File selection failed: ${error.message}`, 'error');
      resetState();
    }
  };

  const processFile = async (file: DocumentPicker.DocumentPickerAsset) => {
    setStatus('processing');
    setMessage('Reading file...');
    try {
      let workbook: XLSX.WorkBook;
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

      const nameKey = findKey(['name', 'account name']);
      const typeKey = findKey(['type', 'account type']);
      const contactKey = findKey(['contact', 'phone', 'contact number']);
      const addressKey = findKey(['address']);
      const balanceKey = findKey(['opening balance', 'balance']);

      if (!nameKey || !typeKey || !balanceKey) {
        throw new Error(`File must contain "Name", "Type", and "Opening Balance" columns. Found: ${originalHeaders.join(', ')}`);
      }

      const parsedAccounts = jsonData.map((row) => {
        const name = row[nameKey];
        const type = String(row[typeKey] || '').toLowerCase();
        const openingBalance = parseFloat(String(row[balanceKey]).replace(/,/g, ''));
        
        if (name && (type === 'factory' || type === 'transporter') && !isNaN(openingBalance)) {
          return {
            name: String(name).trim(),
            type,
            contact: contactKey ? String(row[contactKey] || '') : undefined,
            address: addressKey ? String(row[addressKey] || '') : undefined,
            openingBalance,
          };
        }
        return null;
      }).filter((acc): acc is NonNullable<typeof acc> => acc !== null);

      if (parsedAccounts.length === 0) {
        throw new Error('No valid account rows found. Check data format.');
      }

      setAccountsToUpload(parsedAccounts);
      setMessage(`Found ${parsedAccounts.length} valid accounts. Ready to import.`);
      setStatus('confirming');

    } catch (error: any) {
      console.error('Bulk account upload error:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleConfirmUpload = async () => {
    setStatus('processing');
    setMessage(`Importing ${accountsToUpload.length} accounts...`);
    try {
      await bulkCreateAccounts(accountsToUpload);
      setStatus('success');
      setMessage(`Success! Imported ${accountsToUpload.length} new accounts.`);
      refreshData();
      setTimeout(onClose, 1500); // Close modal after success
    } catch (error: any) {
      console.error('Bulk account import failed:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  const resetState = () => {
    setStatus('idle');
    setFileName(null);
    setMessage('');
    setAccountsToUpload([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk Account Upload</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.instructions}>
              Upload an Excel (.xlsx) or CSV file with the following columns: {'\n'}
              <Text style={styles.bold}>Name, Type</Text> (factory/transporter), and <Text style={styles.bold}>Opening Balance</Text>. {'\n'}
              Optional columns: <Text style={styles.bold}>Contact, Address</Text>.
            </Text>

            {status === 'idle' && (
              <TouchableOpacity style={styles.uploadButton} onPress={handleSelectFile}>
                <UploadCloud size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>Select File</Text>
              </TouchableOpacity>
            )}

            {(status !== 'idle') && (
              <View style={styles.statusContainer}>
                {fileName && <View style={styles.fileInfo}><FileIcon size={20} color="#6b7280" /><Text style={styles.fileName} numberOfLines={1}>{fileName}</Text></View>}
                <View style={styles.statusRow}>
                  {status === 'processing' && <ActivityIndicator size="small" color="#2563eb" />}
                  {status === 'confirming' && <CheckCircle size={16} color="#f59e0b" />}
                  {status === 'success' && <CheckCircle size={16} color="#059669" />}
                  {status === 'error' && <AlertTriangle size={16} color="#dc2626" />}
                  <Text style={[styles.statusText, status === 'error' && styles.errorText, status === 'success' && styles.successText, status === 'confirming' && styles.confirmText]}>{message}</Text>
                </View>
                {(status === 'error') && (
                  <TouchableOpacity style={styles.resetButton} onPress={resetState}>
                    <RefreshCw size={16} color="#2563eb" />
                    <Text style={styles.resetButtonText}>Try Another File</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          
          {status === 'confirming' && (
            <View style={styles.footer}>
              <TouchableOpacity style={[styles.footerButton, styles.cancelButton]} onPress={resetState}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.footerButton, styles.confirmButton]} onPress={handleConfirmUpload}>
                <Text style={styles.confirmButtonText}>Import Accounts</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  closeButton: { padding: 4 },
  content: { padding: 16, gap: 16 },
  instructions: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 8 },
  bold: { fontWeight: '600' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8 },
  uploadButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  statusContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#f9fafb' },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#374151', flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '500', flex: 1 },
  confirmText: { color: '#d97706' },
  successText: { color: '#059669' },
  errorText: { color: '#dc2626' },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 6 },
  resetButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  footer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  footerButton: { flex: 1, padding: 16, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { color: '#374151', fontWeight: '600' },
  confirmButton: { backgroundColor: '#059669' },
  confirmButtonText: { color: '#fff', fontWeight: '600' },
});
