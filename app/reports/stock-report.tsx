import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Plus, Trash2, Droplets } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { NumberInput } from '../../components/NumberInput';
import { DateSelector } from '../../components/DateSelector';
import { DayRangePicker } from '../../components/DayRangePicker';
import { getDayBookRecordsForDateRange, getStockOrdersForDateRange, addStockOrder, deleteStockOrder } from '../../utils/database';
import { useNotification } from '../../context/NotificationContext';
import { useData } from '../../context/DataContext';
import { formatLitres } from '../../utils/formatters';
import { StockOrder } from '../../types/daybook';

interface StockData {
  opening: number;
  ordered: number;
  sold: number;
  bookClosing: number;
  actualClosing: number;
  diff: number;
}

export default function StockReportScreen() {
  const { showNotification } = useNotification();
  const { dataVersion } = useData();
  // DEFINITIVE FIX: Default date range to the current month.
  const [dateRange, setDateRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const [isLoading, setIsLoading] = useState(false);
  
  const [stockOrders, setStockOrders] = useState<StockOrder[]>([]);
  const [petrolStock, setPetrolStock] = useState<StockData | null>(null);
  const [dieselStock, setDieselStock] = useState<StockData | null>(null);
  
  const [physicalOpeningPetrol, setPhysicalOpeningPetrol] = useState(0);
  const [physicalClosingPetrol, setPhysicalClosingPetrol] = useState(0);
  const [physicalOpeningDiesel, setPhysicalOpeningDiesel] = useState(0);
  const [physicalClosingDiesel, setPhysicalClosingDiesel] = useState(0);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [newOrder, setNewOrder] = useState({ date: new Date(), fuelType: 'diesel' as 'petrol' | 'diesel', litres: 0 });

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const [dayBooks, fetchedStockOrders] = await Promise.all([
        getDayBookRecordsForDateRange(startDate, endDate),
        getStockOrdersForDateRange(startDate, endDate),
      ]);
      setStockOrders(fetchedStockOrders);

      const calculateStock = (fuelType: 'petrol' | 'diesel'): StockData => {
        const opening = fuelType === 'petrol' ? physicalOpeningPetrol : physicalOpeningDiesel;
        const actualClosing = fuelType === 'petrol' ? physicalClosingPetrol : physicalClosingDiesel;
        
        const sold = dayBooks.reduce((sum, r) => {
            const litres = r.machines[fuelType].reduce((s, m) => s + Math.max(0, (m.closingReading || 0) - (m.openingReading || 0)), 0);
            return sum + litres;
        }, 0);

        const ordered = fetchedStockOrders.filter(o => o.fuel_type === fuelType).reduce((sum, o) => sum + o.litres, 0);
        
        const bookClosing = opening + ordered - sold;
        const diff = actualClosing - bookClosing;
        return { opening, ordered, sold, bookClosing, actualClosing, diff };
      };

      setPetrolStock(calculateStock('petrol'));
      setDieselStock(calculateStock('diesel'));

    } catch (error: any) {
      showNotification(`Error loading report data: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, showNotification, physicalOpeningPetrol, physicalClosingPetrol, physicalOpeningDiesel, physicalClosingDiesel]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData, dataVersion]);

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
      loadReportData();
    } catch (error: any) {
      showNotification(`Failed to add order: ${error.message}`, 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteStockOrder(orderId);
      showNotification('Stock order deleted.', 'success');
      loadReportData();
    } catch (error: any) {
      showNotification(`Failed to delete order: ${error.message}`, 'error');
    }
  };
  
  const renderStockCard = (title: string, data: StockData | null, color: string) => {
    if (!data) return null;
    return (
      <Card style={{ borderColor: color, borderWidth: 1, marginBottom: 16 }}>
        <Text style={[styles.stockTitle, { color }]}>{title}</Text>
        <View style={styles.row}><Text style={styles.label}>Opening Stock</Text><Text style={styles.value}>{formatLitres(data.opening)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>+ Fuel Ordered</Text><Text style={styles.value}>{formatLitres(data.ordered)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>- Fuel Sold</Text><Text style={styles.value}>- {formatLitres(data.sold)}</Text></View>
        <View style={[styles.row, styles.subtotal]}><Text style={styles.label}>= Book Closing Stock</Text><Text style={styles.value}>{formatLitres(data.bookClosing)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Actual Closing Stock</Text><Text style={styles.value}>{formatLitres(data.actualClosing)}</Text></View>
        <View style={[styles.row, styles.total]}>
            <Text style={[styles.totalLabel, data.diff < 0 && styles.negative]}>Shortage / Surplus</Text>
            <Text style={[styles.totalValue, data.diff < 0 && styles.negative]}>{formatLitres(data.diff)}</Text>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.title}>Filters</Text>
            <DayRangePicker range={dateRange} onRangeChange={setDateRange} />
          </Card>

          <Card>
            <Text style={styles.title}>Physical Stock (in Litres)</Text>
            <View style={styles.physicalStockRow}>
                <View style={styles.inputGroup}><Text style={styles.inputLabel}>Opening Petrol</Text><NumberInput value={physicalOpeningPetrol} onChangeValue={setPhysicalOpeningPetrol} /></View>
                <View style={styles.inputGroup}><Text style={styles.inputLabel}>Closing Petrol</Text><NumberInput value={physicalClosingPetrol} onChangeValue={setPhysicalClosingPetrol} /></View>
            </View>
            <View style={styles.physicalStockRow}>
                <View style={styles.inputGroup}><Text style={styles.inputLabel}>Opening Diesel</Text><NumberInput value={physicalOpeningDiesel} onChangeValue={setPhysicalOpeningDiesel} /></View>
                <View style={styles.inputGroup}><Text style={styles.inputLabel}>Closing Diesel</Text><NumberInput value={physicalClosingDiesel} onChangeValue={setPhysicalClosingDiesel} /></View>
            </View>
          </Card>
          
          <Card>
            <View style={styles.orderHeader}>
              <Text style={styles.title}>Stock Orders in Period</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setIsFormVisible(true)}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add Order</Text>
              </TouchableOpacity>
            </View>
            {stockOrders.length > 0 ? stockOrders.map(order => (
              <View key={order.id} style={styles.orderRow}>
                <Text>{format(new Date(order.date), 'dd/MM/yy')}</Text>
                <Text style={{textTransform: 'capitalize'}}>{order.fuel_type}</Text>
                <Text>{formatLitres(order.litres)}</Text>
                <TouchableOpacity onPress={() => handleDeleteOrder(order.id)}><Trash2 size={16} color="#dc2626" /></TouchableOpacity>
              </View>
            )) : <Text style={styles.noDataText}>No stock orders logged for this period.</Text>}
          </Card>

          {isLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <>
              {renderStockCard('Petrol Stock', petrolStock, '#7c3aed')}
              {renderStockCard('Diesel Stock', dieselStock, '#059669')}
            </>
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
                        <TouchableOpacity style={styles.saveButton} onPress={handleAddOrder}><Text style={styles.saveButtonText}>Save Order</Text></TouchableOpacity>
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
  stockTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: '#374151' },
  value: { fontSize: 14, fontWeight: '500' },
  subtotal: { borderTopWidth: 1, paddingTop: 8, marginTop: 4, borderColor: '#e5e7eb' },
  total: { borderTopWidth: 2, paddingTop: 10, marginTop: 6, borderColor: '#9ca3af' },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 16, fontWeight: '700' },
  negative: { color: '#dc2626' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  addButtonText: { color: '#fff', fontWeight: '500', fontSize: 12 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  noDataText: { textAlign: 'center', fontStyle: 'italic', color: '#6b7280', paddingVertical: 10 },
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
  saveButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
  saveButtonText: { fontWeight: '600', color: '#fff' },
  physicalStockRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
});
