import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { BarChart2 } from 'lucide-react-native';
import { format } from 'date-fns';

import { Card } from './Card';
import { getMonthlyFuelSales } from '../utils/database';
import { useNotification } from '../context/NotificationContext';
import { formatLitres } from '../utils/formatters';

interface MonthlySale {
  month_start: string;
  total_petrol_litres: number;
  total_diesel_litres: number;
}

interface TooltipData {
  month: string;
  total: number;
  petrol: number;
  diesel: number;
  position: { x: number; y: number };
}

const Bar = ({ data, maxValue, onShowTooltip }: { data: MonthlySale, maxValue: number, onShowTooltip: (event: any, data: MonthlySale) => void }) => {
    const totalLitres = (data.total_petrol_litres || 0) + (data.total_diesel_litres || 0);
    const barHeight = totalLitres > 0 ? (totalLitres / maxValue) * 100 : 0;
    
    const petrolHeight = totalLitres > 0 ? ((data.total_petrol_litres || 0) / totalLitres) * 100 : 0;
    const dieselHeight = totalLitres > 0 ? ((data.total_diesel_litres || 0) / totalLitres) * 100 : 0;
    
    const height = useSharedValue(0);

    useEffect(() => {
        height.value = withTiming(barHeight, { duration: 800, easing: Easing.out(Easing.exp) });
    }, [barHeight]);

    const animatedStyle = useAnimatedStyle(() => {
        return { height: `${height.value}%` };
    });

    return (
        <View style={styles.barWrapper}>
            <TouchableOpacity style={{width: '100%', height: '100%', alignItems: 'center'}} onPress={(e) => onShowTooltip(e.nativeEvent, data)}>
                <Animated.View style={[styles.bar, animatedStyle]}>
                    <View style={{ height: `${dieselHeight}%`, backgroundColor: '#059669' }} />
                    <View style={{ height: `${petrolHeight}%`, backgroundColor: '#7c3aed' }} />
                </Animated.View>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{format(new Date(data.month_start), 'MMM')}</Text>
        </View>
    );
};


export function MonthlySalesChart() {
  const { showNotification } = useNotification();
  const [salesData, setSalesData] = useState<MonthlySale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMonthlyFuelSales();
      setSalesData(data);
    } catch (error: any) {
      showNotification(`Error loading sales chart data: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxValue = useMemo(() => {
    const maxSale = Math.max(...salesData.map(d => (d.total_petrol_litres || 0) + (d.total_diesel_litres || 0)), 0);
    return Math.ceil(maxSale / 10000) * 10000 || 10000;
  }, [salesData]);

  const yAxisLabels = useMemo(() => Array.from({ length: 5 }, (_, i) => Math.round((maxValue / 4) * i)), [maxValue]);

  const handleShowTooltip = (event: any, data: MonthlySale) => {
    setTooltip({
      month: format(new Date(data.month_start), 'MMMM yyyy'),
      total: (data.total_petrol_litres || 0) + (data.total_diesel_litres || 0),
      petrol: data.total_petrol_litres || 0,
      diesel: data.total_diesel_litres || 0,
      position: { x: event.pageX, y: event.pageY },
    });
  };

  return (
    <Card>
      <View style={styles.header}>
        <BarChart2 size={20} color="#1f2937" />
        <Text style={styles.title}>Monthly Fuel Sales (Last 12 Months)</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ height: 220 }} />
      ) : salesData.length === 0 ? (
        <Text style={styles.noDataText}>No sales data available to display chart.</Text>
      ) : (
        <View style={styles.chartArea}>
          <View style={styles.yAxis}>
            {yAxisLabels.reverse().map(label => (
              <Text key={label} style={styles.yAxisLabel}>{formatLitres(label)}</Text>
            ))}
          </View>
          <View style={styles.chartContainer}>
            {salesData.map(item => (
              <Bar key={item.month_start} data={item} maxValue={maxValue} onShowTooltip={handleShowTooltip} />
            ))}
          </View>
        </View>
      )}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#7c3aed' }]} /><Text style={styles.legendText}>Petrol</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#059669' }]} /><Text style={styles.legendText}>Diesel</Text></View>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={!!tooltip}
        onRequestClose={() => setTooltip(null)}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTooltip(null)}>
            {tooltip && (
                <View style={[styles.tooltip, { top: tooltip.position.y - 120, left: tooltip.position.x - 75 }]}>
                    <Text style={styles.tooltipTitle}>{tooltip.month}</Text>
                    <View style={styles.tooltipRow}><Text style={styles.tooltipLabel}>Total:</Text><Text style={styles.tooltipValue}>{formatLitres(tooltip.total)}</Text></View>
                    <View style={styles.tooltipRow}><Text style={styles.tooltipLabel}>Petrol:</Text><Text style={styles.tooltipValue}>{formatLitres(tooltip.petrol)}</Text></View>
                    <View style={styles.tooltipRow}><Text style={styles.tooltipLabel}>Diesel:</Text><Text style={styles.tooltipValue}>{formatLitres(tooltip.diesel)}</Text></View>
                </View>
            )}
        </TouchableOpacity>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  chartArea: { flexDirection: 'row', height: 220 },
  yAxis: { justifyContent: 'space-between', paddingRight: 8 },
  yAxisLabel: { fontSize: 10, color: '#9ca3af' },
  chartContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 4 },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 },
  bar: { width: '50%', borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  monthLabel: { fontSize: 10, color: '#6b7280' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendColor: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 12, color: '#374151' },
  noDataText: { textAlign: 'center', padding: 20, color: '#6b7280', fontStyle: 'italic' },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    width: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: 6,
  },
  tooltipTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
    paddingBottom: 4,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tooltipLabel: {
    color: '#d1d5db',
    fontSize: 12,
  },
  tooltipValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
