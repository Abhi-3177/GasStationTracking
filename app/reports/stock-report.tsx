import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Plus, Trash2, Save, Calculator } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { DayRangePicker } from '../../components/DayRangePicker';
import { ReportMachineReadings } from '../../components/ReportMachineReadings';
import { StockLevelCard } from '../../components/StockLevelCard';
import { PhysicalStockInput } from '../../components/PhysicalStockInput';
import { ReportCalculationSummary } from '../../components/ReportCalculationSummary';
import { DateSelector } from '../../components/DateSelector';
import { NumberInput } from '../../components/NumberInput';
import { getStockOrdersForDateRange, addStockOrder, deleteStockOrder, getDayBookRecordsForDateRange, getLatestStockReport, saveStockReport } from '../../utils/database';
import { useNotification } from '../../context/NotificationContext';
import { useData } from '../../context/DataContext';
import { formatLitres } from '../../utils/formatters';
import { StockOrder, StockReport, StockReportData } from '../../types/daybook';

const createNewReport = (lastReport: StockReport | null): Omit<StockReport, 'id' | 'user_id' | 'created_at' | 'report_data'> => {
    return {
        start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end_date: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
        opening_stock_petrol: lastReport?.closing_stock_petrol || 0,
        opening_stock_diesel: lastReport?.closing_stock_diesel || 0,
        closing_stock_petrol: 0, // This is now Physical Stock
        closing_stock_diesel: 0, // This is now Physical Stock
        opening_readings_petrol: lastReport?.closing_readings_petrol || Array(4).fill(0),
        opening_readings_diesel: lastReport?.closing_readings_diesel || Array(4).fill(0),
        closing_readings_petrol: Array(4).fill(0),
        closing_readings_diesel: Array(4).fill(0),
    };
};

export default function StockReportScreen() {
  const { showNotification } = useNotification();
  const { dataVersion, refreshData } = useData();
  const [report, setReport] = useState<Omit<StockReport, 'id' | 'user_id' | 'created_at' | 'report_data'>>(createNewReport(null));
  const [lastReport, setLastReport] = useState<StockReport | null>(null);
  const [stockOrders, setStockOrders] = useState<StockOrder[]>([]);
  
  const [petrolReportData, setPetrolReportData] = useState<StockReportData | null>(null);
  const [dieselReportData, setDieselReportData] = useState<StockReportData | null>(null);
  const [petrolDipReading, setPetrolDipReading] = useState('');
  const [dieselDipReading, setDieselDipReading] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [newOrder, setNewOrder] = useState({ date: new Date(), fuelType: 'diesel' as 'petrol' | 'diesel', litres: 0 });

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const latestReport = await getLatestStockReport();
      setLastReport(latestReport);
      setReport(createNewReport(latestReport));
    } catch (error: any) {
      showNotification(`Error loading initial data: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, dataVersion]);

  const loadStockOrders = useCallback(async () => {
    if (!report.start_date || !report.end_date) return;
    setIsOrdersLoading(true);
    try {
        const orders = await getStockOrdersForDateRange(report.start_date, report.end_date);
        setStockOrders(orders);
    } catch (error: any) {
        showNotification(`Failed to load stock orders: ${error.message}`, 'error');
    } finally {
        setIsOrdersLoading(false);
    }
  }, [report.start_date, report.end_date, showNotification]);

  useEffect(() => {
    loadStockOrders();
  }, [loadStockOrders]);

  const handleDateRangeChange = (range: { start: Date; end: Date }) => {
    setReport(prev => ({
        ...prev,
        start_date: format(range.start, 'yyyy-MM-dd'),
        end_date: format(range.end, 'yyyy-MM-dd'),
    }));
  };

  const handleUpdateReport = (updates: Partial<typeof report>) => {
    setReport(prev => ({ ...prev, ...updates }));
  };

  const handleUpdateReading = (type: 'opening' | 'closing', fuelType: 'petrol' | 'diesel', index: number, value: number) => {
    const field = `${type}_readings_${fuelType}` as keyof typeof report;
    const currentReadings = report[field] as number[];
    const newReadings = [...currentReadings];
    newReadings[index] = value;
    handleUpdateReport({ [field]: newReadings });
  };
  
  const handlePhysicalStockUpdate = (field: 'petrolDip' | 'dieselDip' | 'petrolVolume' | 'dieselVolume', value: string | number) => {
    if (field === 'petrolDip') setPetrolDipReading(value as string);
    if (field === 'dieselDip') setDieselDipReading(value as string);
    if (field === 'petrolVolume') handleUpdateReport({ closing_stock_petrol: value as number });
    if (field === 'dieselVolume') handleUpdateReport({ closing_stock_diesel: value as number });
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setPetrolReportData(null);
    setDieselReportData(null);
    try {
      const dayBookRecords = await getDayBookRecordsForDateRange(report.start_date, report.end_date);

      const calculateStock = (fuelType: 'petrol' | 'diesel'): StockReportData => {
        const openingReadings = report[`opening_readings_${fuelType}`];
        const closingReadings = report[`closing_readings_${fuelType}`];
        const openingStock = report[`opening_stock_${fuelType}`];
        const physicalStock = report[`closing_stock_${fuelType}`];

        const totalOpeningReading = openingReadings.reduce((sum, r) => sum + r, 0);
        const totalClosingReading = closingReadings.reduce((sum, r) => sum + r, 0);
        
        const totalSoldFromReading = totalClosingReading > totalOpeningReading ? totalClosingReading - totalOpeningReading : 0;
        
        const testingVolume = dayBookRecords.reduce((sum, record) => {
            const testLitres = fuelType === 'petrol' 
                ? record.expenses?.gasTesting?.petrolTestLitres 
                : record.expenses?.gasTesting?.dieselTestLitres;
            return sum + (testLitres || 0);
        }, 0);

        const finalSoldVolume = totalSoldFromReading - testingVolume;
        const stockOrdered = stockOrders.filter(o => o.fuel_type === fuelType).reduce((sum, o) => sum + o.litres, 0);
        const finalStockFromReport = openingStock + stockOrdered - finalSoldVolume;
        const surplusOrShortage = physicalStock - finalStockFromReport;
        
        return { totalSoldFromReading, testingVolume, finalSoldVolume, openingStock, stockOrdered, finalStockFromReport, physicalStock, surplusOrShortage };
      };

      const petrolData = calculateStock('petrol');
      const dieselData = calculateStock('diesel');
      
      setPetrolReportData(petrolData);
      setDieselReportData(dieselData);
      showNotification('Report calculated. Review the summary before saving.', 'info');

    } catch (error: any) {
      showNotification(`Error calculating report: ${error.message}`, 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveReport = async () => {
    if (!petrolReportData || !dieselReportData) {
      showNotification('Please calculate the report first before saving.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const reportToSave: StockReport = {
        ...report,
        report_data: { petrol: petrolReportData, diesel: dieselReportData },
        user_id: '' // Will be set in the database function
      };
      
      await saveStockReport(reportToSave);
      showNotification('Report saved successfully!', 'success');
      refreshData();
    } catch (error: any) {
      showNotification(`Error saving report: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOrder = async () => {
    if (newOrder.litres <= 0) {
      showNotification('Litres must be greater than zero.', 'error');
      return;
    }
    try {
      await addStockOrder({ ...newOrder, date: format(newOrder.date, 'yyyy-MM-dd') });
      showNotification('Stock order added successfully!', 'success');
      setIsFormVisible(false);
      setNewOrder({ date: new Date(), fuelType: 'diesel', litres: 0 });
      await loadStockOrders();
    } catch (error: any) {
      showNotification(`Failed to add order: ${error.message}`, 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteStockOrder(orderId);
      showNotification('Stock order deleted.', 'success');
      await loadStockOrders();
    } catch (error: any) {
      showNotification(`Failed to delete order: ${error.message}`, 'error');
    }
  };

  if (isLoading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#2563eb" /></SafeAreaView>;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.title}>Filters</Text>
            <DayRangePicker range={{ start: new Date(report.start_date), end: new Date(report.end_date) }} onRangeChange={handleDateRangeChange} />
          </Card>
          
          <Card>
            <View style={styles.orderHeader}>
              <Text style={styles.title}>Stock Orders in Period</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setIsFormVisible(true)}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add Order</Text>
              </TouchableOpacity>
            </View>
            {isOrdersLoading ? (
              <ActivityIndicator color="#2563eb" />
            ) : stockOrders.length > 0 ? stockOrders.map(order => (
              <View key={order.id} style={styles.orderRow}>
                <Text>{format(new Date(order.date), 'dd/MM/yy')}</Text>
                <Text style={{textTransform: 'capitalize'}}>{order.fuel_type}</Text>
                <Text>{formatLitres(order.litres)}</Text>
                <TouchableOpacity onPress={() => handleDeleteOrder(order.id)}><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
              </View>
            )) : <Text style={styles.noDataText}>No stock orders logged for this period. Add them to calculate correctly.</Text>}
          </Card>

          <StockLevelCard
            title="Opening Stock"
            subtitle="Values carried over from previous report."
            petrolStock={report.opening_stock_petrol}
            dieselStock={report.opening_stock_diesel}
            onUpdate={(fuel, value) => handleUpdateReport({ [`opening_stock_${fuel}`]: value })}
            editable={!lastReport}
          />

          <ReportMachineReadings
            title="Opening Readings"
            petrolReadings={report.opening_readings_petrol}
            dieselReadings={report.opening_readings_diesel}
            onUpdate={(fuel, idx, val) => handleUpdateReading('opening', fuel, idx, val)}
            editable={!lastReport}
          />

          <ReportMachineReadings
            title="Closing Readings"
            petrolReadings={report.closing_readings_petrol}
            dieselReadings={report.closing_readings_diesel}
            onUpdate={(fuel, idx, val) => handleUpdateReading('closing', fuel, idx, val)}
          />

          <PhysicalStockInput
            petrolDip={petrolDipReading}
            dieselDip={dieselDipReading}
            petrolVolume={report.closing_stock_petrol}
            dieselVolume={report.closing_stock_diesel}
            onUpdate={handlePhysicalStockUpdate}
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.calculateButton, isCalculating && styles.disabledButton]} onPress={handleCalculate} disabled={isCalculating}>
              {isCalculating ? <ActivityIndicator color="#fff" /> : <Calculator size={20} color="#fff" />}
              <Text style={styles.buttonText}>{isCalculating ? 'Calculating...' : 'Calculate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, (!petrolReportData || isSaving) && styles.disabledButton]} onPress={handleSaveReport} disabled={!petrolReportData || isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Save size={20} color="#fff" />}
              <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Save Report'}</Text>
            </TouchableOpacity>
          </View>

          {petrolReportData && (
            <ReportCalculationSummary title="Petrol" data={petrolReportData} color="#7c3aed" />
          )}
          {dieselReportData && (
            <ReportCalculationSummary title="Diesel" data={dieselReportData} color="#059669" />
          )}
        </ScrollView>

        <Modal visible={isFormVisible} transparent animationType="fade" onRequestClose={() => setIsFormVisible(false)}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Add Stock Order</Text>
                    <View style={styles.inputGroup}><Text style={styles.inputLabel}>Date</Text><DateSelector selectedDate={newOrder.date} onDateChange={d => setNewOrder(p => ({...p, date: d}))} /></View>
                    <View style={styles.inputGroup}><Text style={styles.inputLabel}>Fuel Type</Text>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity style={[styles.typeButton, newOrder.fuelType === 'petrol' && styles.typeActivePetrol]} onPress={() => setNewOrder(p => ({...p, fuelType: 'petrol'}))}><Text style={[styles.typeText, newOrder.fuelType === 'petrol' && styles.typeTextActive]}>Petrol</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.typeButton, newOrder.fuelType === 'diesel' && styles.typeActiveDiesel]} onPress={() => setNewOrder(p => ({...p, fuelType: 'diesel'}))}><Text style={[styles.typeText, newOrder.fuelType === 'diesel' && styles.typeTextActive]}>Diesel</Text></TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.inputGroup}><Text style={styles.inputLabel}>Litres</Text><NumberInput value={newOrder.litres} onChangeValue={l => setNewOrder(p => ({...p, litres: l}))} /></View>
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setIsFormVisible(false)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.modalSaveButton} onPress={handleAddOrder}><Text style={styles.modalSaveButtonText}>Save Order</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  addButtonText: { color: '#fff', fontWeight: '500', fontSize: 12 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  noDataText: { textAlign: 'center', fontStyle: 'italic', color: '#6b7280', paddingVertical: 10 },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  calculateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 12,
  },
  disabledButton: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  inputGroup: { gap: 4, flex: 1 },
  inputLabel: { fontSize: 14, color: '#6b7280' },
  typeSelector: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  typeButton: { flex: 1, padding: 12, alignItems: 'center' },
  typeActivePetrol: { backgroundColor: '#f5f3ff' },
  typeActiveDiesel: { backgroundColor: '#ecfdf5' },
  typeText: { fontWeight: '500' },
  typeTextActive: {},
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelButtonText: { fontWeight: '600', color: '#374151' },
  modalSaveButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
  modalSaveButtonText: { fontWeight: '600', color: '#fff' },
});
