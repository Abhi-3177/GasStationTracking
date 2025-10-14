import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { ShoppingBag, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { OtherSale } from '../types/daybook';

interface OtherSalesSectionProps {
  otherSales: OtherSale[];
  onUpdateOtherSales: (sales: OtherSale[]) => void;
}

export function OtherSalesSection({ otherSales, onUpdateOtherSales }: OtherSalesSectionProps) {
  const handleAddSale = () => {
    const newSale: OtherSale = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
    };
    onUpdateOtherSales([...otherSales, newSale]);
  };

  const handleUpdateSale = (id: string, updates: Partial<OtherSale>) => {
    const updatedSales = otherSales.map(sale =>
      sale.id === id ? { ...sale, ...updates } : sale
    );
    onUpdateOtherSales(updatedSales);
  };

  const handleRemoveSale = (id: string) => {
    const updatedSales = otherSales.filter(sale => sale.id !== id);
    onUpdateOtherSales(updatedSales);
  };

  const totalOtherSales = otherSales.reduce((total, sale) => total + sale.amount, 0);

  return (
    <Card>
      <View style={styles.header}>
        <ShoppingBag size={20} color="#f59e0b" />
        <Text style={styles.title}>Other Sales</Text>
      </View>
      
      <View style={styles.salesContainer}>
        {otherSales.map(sale => (
          <View key={sale.id} style={styles.saleRow}>
            <View style={styles.saleNameInput}>
              <TextInput
                style={styles.textInput}
                value={sale.name}
                onChangeText={(text) => handleUpdateSale(sale.id, { name: text })}
                placeholder="Product name"
              />
            </View>
            <View style={styles.saleAmountInput}>
              <NumberInput
                value={sale.amount}
                onChangeValue={(value) => handleUpdateSale(sale.id, { amount: value })}
                placeholder="0.00"
                precision={2}
              />
            </View>
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity onPress={() => handleRemoveSale(sale.id)} style={styles.removeButton}>
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddSale} style={styles.addButtonRow}>
                <Plus size={16} color="#059669" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {otherSales.length === 0 && (
          <TouchableOpacity onPress={handleAddSale} style={styles.standaloneAddButton}>
            <Plus size={16} color="#2563eb" />
            <Text style={styles.standaloneAddButtonText}>Add Other Sale</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {totalOtherSales > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Total Other Sales:</Text>
          <Text style={styles.summaryValue}>₹{totalOtherSales.toFixed(2)}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  salesContainer: {
    gap: 8,
  },
  saleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  saleNameInput: {
    flex: 2,
  },
  saleAmountInput: {
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  addButtonRow: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#ecfdf5',
  },
  standaloneAddButton: {
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
  standaloneAddButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
});
