import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { format, isValid } from 'date-fns';
import { UploadCloud, File as FileIcon, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react-native';

import { Card } from './Card';
import { addStockOrder } from '../utils/database';
import { useNotification } from '../context/NotificationContext';
import { useData } from '../context/DataContext';

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

/**
 * Parses a date from various possible formats found in Excel files.
 * It's designed to be strict and avoid incorrect fallbacks.
 * @param dateInput The value from the Excel cell.
 * @returns A valid Date object in UTC, or null if parsing fails.
 */
function parseDateString(dateInput: any): Date | null {
  if (dateInput === null || dateInput === undefined) return null;

  // 1. Handle Excel Serial Numbers (if it's a number)
  if (typeof dateInput === 'number' && dateInput > 1) {
    const excelDate = new Date((dateInput - 25569) * 86400 * 1000);
    if (isValid(excelDate)) {
      return new Date(Date.UTC(excelDate.getUTCFullYear(), excelDate.getUTCMonth(), excelDate.getUTCDate()));
    }
  }

  if (typeof dateInput !== 'string') return null;

  const trimmed = dateInput.trim();
  if (trimmed === '') return null;

  // 2. Handle 'DD-Mon-YY' or 'DD-Mon-YYYY' (e.g., "11-Oct-25" or "11-Oct-2025")
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

  // 3. Handle 'DD/MM/YYYY' or 'DD-MM-YYYY'
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

  // If no format matches, return null. This prevents incorrect fallbacks.
  return null;
}


export function StockOrderUpload() {
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

      const sheet1Name = 'Table 1';
      const sheet3Name = 'Table 3';

      if (!workbook.SheetNames.includes(sheet1Name) || !workbook.SheetNames.includes(sheet3Name)) {
        throw new Error(`File must contain sheets named "${sheet1Name}" and "${sheet3Name}".`);
      }

      const sheet1 = workbook.Sheets[sheet1Name];
      const sheet1Json: any[][] = XLSX.utils.sheet_to_json(sheet1, { header: 1, raw: false, defval: '' });
      let orderDate: Date | null = null;

      for (let i = 0; i < Math.min(sheet1Json.length, 20); i++) {
          const row = sheet1Json[i];
          if (!row || row.length === 0) continue;
          for (let j = 0; j < Math.min(row.length, 10); j++) {
              let cellValue = row[j];
              // Try to extract a date-like string from a longer string
              if (typeof cellValue === 'string') {
                  const dateMatch = cellValue.match(/(\d{1,2}[-/\s][a-zA-Z]{3,}[-/\s]\d{2,4}|\d{1,2}[-/\s]\d{1,2}[-/\s]\d{2,4})/);
                  if (dateMatch && dateMatch[0]) {
                      cellValue = dateMatch[0];
                  }
              }
              const parsedDate = parseDateString(cellValue);
              if (parsedDate) {
                  orderDate = parsedDate;
                  break;
              }
          }
          if (orderDate) break;
      }

      if (!orderDate) {
        throw new Error(`Could not find any valid date in the first 20 rows of the "${sheet1Name}" sheet.`);
      }

      const sheet3 = workbook.Sheets[sheet3Name];
      const sheet3Json: any[][] = XLSX.utils.sheet_to_json(sheet3, { header: 1, raw: false, defval: '' });

      const headerRowIndex = sheet3Json.findIndex(row => 
        row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('material')) &&
        row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('quantity'))
      );

      if (headerRowIndex === -1) {
        throw new Error(`Could not find a header row containing both "Material" and "Quantity" in sheet '${sheet3Name}'.`);
      }

      const headers = sheet3Json[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
      const materialCodeIndex = headers.findIndex(h => h.includes('material'));
      const quantityIndex = headers.findIndex(h => h.includes('quantity'));

      if (materialCodeIndex === -1 || quantityIndex === -1) {
        throw new Error(`Could not find required columns in sheet '${sheet3Name}'. Found headers: ${headers.join(', ')}`);
      }

      const dataRows = sheet3Json.slice(headerRowIndex + 1);
      let totalOrdersAdded = 0;
      let totalQuantityKL = 0;

      for (const row of dataRows) {
        if (!row || row.length <= Math.max(materialCodeIndex, quantityIndex) || row.every(cell => cell === '')) continue;

        const materialCode = String(row[materialCodeIndex] || '').toUpperCase();
        const quantityKL = parseFloat(String(row[quantityIndex] || '0').replace(/,/g, ''));
        
        if ((materialCode.includes('HSD') || materialCode.includes('EBMS')) && !isNaN(quantityKL) && quantityKL > 0) {
          const order = {
            date: format(orderDate, 'yyyy-MM-dd'),
            fuel_type: materialCode.includes('HSD') ? 'diesel' : 'petrol',
            litres: quantityKL * 1000,
          };
          await addStockOrder(order);
          totalOrdersAdded++;
          totalQuantityKL += quantityKL;
        }
      }

      if (totalOrdersAdded === 0) {
        throw new Error(`Processed ${dataRows.length} rows from sheet '${sheet3Name}' but found 0 valid orders. Please check that 'Material' column contains 'HSD' or 'EBMS' and 'Quantity' is a valid number.`);
      }

      setStatus('success');
      const formattedDate = format(orderDate, 'dd-MMM-yyyy');
      setMessage(`Success! Added ${totalOrdersAdded} order(s) for ${formattedDate} totaling ${totalQuantityKL.toFixed(3)} KL.`);
      refreshData();

    } catch (error: any) {
      console.error('Stock Order upload error:', error);
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
        <UploadCloud size={20} color="#f59e0b" />
        <Text style={styles.uploadTitle}>Bulk Stock Order Upload</Text>
      </View>
      <Text style={styles.uploadSubtitle}>
        Upload an Excel file with your purchase orders. The system will look for a 'Table 1' sheet with a date and a 'Table 3' sheet with order details.
      </Text>

      {status === 'idle' && (
        <TouchableOpacity style={styles.uploadButton} onPress={handleSelectFile}>
          <Text style={styles.uploadButtonText}>Select & Upload Order File</Text>
        </TouchableOpacity>
      )}

      {(status === 'processing' || status === 'success' || status === 'error') && (
        <View style={styles.statusContainer}>
          {fileName && <View style={styles.fileInfo}><FileIcon size={20} color="#6b7280" /><Text style={styles.fileName} numberOfLines={1}>{fileName}</Text></View>}
          <View style={styles.statusRow}>
            {status === 'processing' && <ActivityIndicator size="small" color="#f59e0b" />}
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
  uploadButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  uploadButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  statusContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#f9fafb' },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#374151', flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '500', flex: 1 },
  successText: { color: '#059669' },
  errorText: { color: '#dc2626' },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10, backgroundColor: '#eff6ff', borderRadius: 6 },
  resetButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
});
