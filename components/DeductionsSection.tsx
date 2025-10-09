import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { CreditSale, SviSale, Sale0332, DayBookRecord, Account } from '../types/daybook';
import { CalculatedTotals } from '../types/daybook';

interface DeductionsSectionProps {
  prices: DayBookRecord['prices'];
  deductions: DayBookRecord['deductions'];
  totals: CalculatedTotals;
  accounts: Account[];
  onUpdateDeductions: (deductions: DayBookRecord['deductions']) => void;
}

export function DeductionsSection({ prices, deductions, totals, accounts, onUpdateDeductions }: DeductionsSectionProps) {

  // This effect recalculates the dependent value (litres or amount) whenever the master prices change.
  useEffect(() => {
    let needsUpdate = false;
    const newDeductions = JSON.parse(JSON.stringify(deductions)); // Deep copy to avoid mutation issues

    const processSales = (sales: (SviSale | Sale0332 | CreditSale)[]) => {
      return sales.map(sale => {
        const price = sale.fuelType === 'petrol' ? prices.petrol : prices.diesel;
        if (price > 0) {
          if (sale.lastEdited === 'litres') {
            const newAmount = Math.ceil(sale.litres * price);
            if (newAmount !== sale.amount) {
              needsUpdate = true;
              sale.amount = newAmount;
            }
          } else { // lastEdited === 'amount'
            const newLitres = parseFloat((sale.amount / price).toFixed(2));
            if (Math.abs(newLitres - sale.litres) > 1e-9) {
              needsUpdate = true;
              sale.litres = newLitres;
            }
          }
        }
        return sale;
      });
    };

    const updatedSviSales = processSales(newDeductions.sviSales);
    const updatedSales0332 = processSales(newDeductions.sales0332);
    const updatedCreditSales = processSales(newDeductions.creditSales);

    if (needsUpdate) {
      onUpdateDeductions({ 
        ...newDeductions, 
        sviSales: updatedSviSales,
        sales0332: updatedSales0332,
        creditSales: updatedCreditSales,
      });
    }
  }, [prices]);

  // Calculate fuel distribution validation
  const totalDistributedLitres = 
    (deductions.sviSales || []).reduce((total, sale) => total + (sale.litres || 0), 0) +
    (deductions.sales0332 || []).reduce((total, sale) => total + (sale.litres || 0), 0) +
    (deductions.creditSales || []).reduce((total, sale) => total + (sale.litres || 0), 0);
  
  const totalSoldLitres = (totals.petrolLitres || 0) + (totals.dieselLitres || 0);
  const distributionMismatch = Math.abs(totalDistributedLitres - totalSoldLitres) > 0.01;

  const updateSale = (
    type: 'sviSales' | 'sales0332' | 'creditSales',
    id: string,
    updates: Partial<SviSale> | Partial<Sale0332> | Partial<CreditSale>
  ) => {
    const newSales = deductions[type].map(sale =>
      sale.id === id ? { ...sale, ...updates } : sale
    );
    onUpdateDeductions({ ...deductions, [type]: newSales });
  };

  // SVI Sales functions
  const addSviSale = () => {
    const newSviSale: SviSale = {
      id: Date.now().toString(),
      name: '',
      litres: 0,
      fuelType: 'diesel',
      amount: 0,
      lastEdited: 'litres',
      vehicleNumber: '',
    };
    onUpdateDeductions({ ...deductions, sviSales: [...deductions.sviSales, newSviSale] });
  };
  const removeSviSale = (id: string) => onUpdateDeductions({ ...deductions, sviSales: deductions.sviSales.filter(svi => svi.id !== id) });

  // 0332 Sales functions
  const addSale0332 = () => {
    const newSale0332: Sale0332 = {
      id: Date.now().toString(),
      name: '',
      litres: 0,
      fuelType: 'diesel',
      amount: 0,
      lastEdited: 'litres',
      vehicleNumber: '',
    };
    onUpdateDeductions({ ...deductions, sales0332: [...deductions.sales0332, newSale0332] });
  };
  const removeSale0332 = (id: string) => onUpdateDeductions({ ...deductions, sales0332: deductions.sales0332.filter(sale => sale.id !== id) });

  // Credit Sales functions
  const addCreditSale = () => {
    const newCreditSale: CreditSale = {
      id: Date.now().toString(),
      name: '',
      litres: 0,
      fuelType: 'diesel',
      amount: 0,
      lastEdited: 'litres',
      vehicleNumber: '',
    };
    onUpdateDeductions({ ...deductions, creditSales: [...deductions.creditSales, newCreditSale] });
  };
  const removeCreditSale = (id: string) => onUpdateDeductions({ ...deductions, creditSales: deductions.creditSales.filter(c => c.id !== id) });

  const renderLitreBasedSale = (
    sale: SviSale | Sale0332 | CreditSale,
    type: 'sviSales' | 'sales0332' | 'creditSales',
    addFn: () => void,
    removeFn: (id: string) => void,
    placeholder: string
  ) => {
    const handleLitresChange = (litres: number) => {
      const price = sale.fuelType === 'petrol' ? prices.petrol : prices.diesel;
      const amount = Math.ceil(litres * price);
      updateSale(type, sale.id, { litres, amount, lastEdited: 'litres' });
    };

    const handleAmountChange = (amount: number) => {
      const price = sale.fuelType === 'petrol' ? prices.petrol : prices.diesel;
      const litres = price > 0 ? parseFloat((amount / price).toFixed(2)) : 0;
      updateSale(type, sale.id, { amount, litres, lastEdited: 'amount' });
    };

    const handleFuelTypeChange = (fuelType: 'petrol' | 'diesel') => {
      let updates: Partial<SviSale> = { fuelType };
      const price = fuelType === 'petrol' ? prices.petrol : prices.diesel;
      if (sale.lastEdited === 'litres') {
        updates.amount = Math.ceil(sale.litres * price);
      } else { // lastEdited === 'amount'
        updates.litres = price > 0 ? parseFloat((sale.amount / price).toFixed(2)) : 0;
      }
      updateSale(type, sale.id, updates);
    };

    const useAutocomplete = type === 'creditSales' || type === 'sales0332';

    return (
      <View key={sale.id} style={styles.saleRow}>
        <View style={styles.flex2}>
          {useAutocomplete ? (
            <AccountAutocomplete
              accounts={accounts}
              value={sale.name}
              onValueChange={name => updateSale(type, sale.id, { name, accountId: undefined })}
              onAccountSelect={account => updateSale(type, sale.id, { name: account.name, accountId: account.id })}
              placeholder={placeholder}
            />
          ) : (
            <TextInput 
              style={styles.textInput} 
              value={sale.name} 
              onChangeText={name => updateSale(type, sale.id, { name })} 
              placeholder={placeholder} 
            />
          )}
        </View>
        
        <View style={styles.flex1}>
          <TextInput 
            style={styles.textInput} 
            value={sale.vehicleNumber || ''} 
            onChangeText={vehicleNumber => updateSale(type, sale.id, { vehicleNumber })} 
            placeholder="Vehicle No" 
          />
        </View>
        
        <View style={styles.flex1}>
          <NumberInput 
            value={sale.litres} 
            onChangeValue={handleLitresChange} 
            placeholder="Litres" 
            precision={2} 
            style={sale.lastEdited === 'amount' ? styles.autoCalculatedInput : null} 
          />
        </View>

        <View style={styles.fuelTypeSelector}>
          <TouchableOpacity 
            style={[styles.fuelTypeButton, sale.fuelType === 'petrol' && styles.fuelTypeActive]} 
            onPress={() => handleFuelTypeChange('petrol')}
          >
            <Text style={[styles.fuelTypeText, sale.fuelType === 'petrol' && styles.fuelTypeActiveText]}>P</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.fuelTypeButton, sale.fuelType === 'diesel' && styles.fuelTypeActive]} 
            onPress={() => handleFuelTypeChange('diesel')}
          >
            <Text style={[styles.fuelTypeText, sale.fuelType === 'diesel' && styles.fuelTypeActiveText]}>D</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flex1}>
          <NumberInput 
            value={sale.amount} 
            onChangeValue={handleAmountChange} 
            placeholder="Amount" 
            precision={0} 
            style={sale.lastEdited === 'litres' ? styles.autoCalculatedInput : null} 
          />
        </View>

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity onPress={() => removeFn(sale.id)} style={styles.removeButton}>
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
          <TouchableOpacity onPress={addFn} style={styles.addButtonRow}>
            <Plus size={16} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Card>
      <View style={styles.header}>
        <Minus size={20} color="#dc2626" />
        <Text style={styles.title}>Deductions from Total Sale</Text>
      </View>
      
      {distributionMismatch && (
        <View style={styles.validationWarning}>
          <AlertTriangle size={16} color="#f59e0b" />
          <Text style={styles.validationText}>
            Sold {totalSoldLitres.toFixed(2)}L, Distributed {totalDistributedLitres.toFixed(2)}L
          </Text>
        </View>
      )}
      
      <Section title="SVI Sales">
        {(deductions.sviSales || []).map(svi => renderLitreBasedSale(svi, 'sviSales', addSviSale, removeSviSale, "SVI sale description"))}
        {(deductions.sviSales || []).length === 0 && (
          <TouchableOpacity onPress={addSviSale} style={styles.standaloneAddButton}>
            <Plus size={16} color="#2563eb" />
            <Text style={styles.standaloneAddButtonText}>Add SVI Sale</Text>
          </TouchableOpacity>
        )}
      </Section>

      <Section title="0332 Sales">
        {(deductions.sales0332 || []).map(sale => renderLitreBasedSale(sale, 'sales0332', addSale0332, removeSale0332, "0332 Account Name"))}
        {(deductions.sales0332 || []).length === 0 && (
          <TouchableOpacity onPress={addSale0332} style={styles.standaloneAddButton}>
            <Plus size={16} color="#2563eb" />
            <Text style={styles.standaloneAddButtonText}>Add 0332 Sale</Text>
          </TouchableOpacity>
        )}
      </Section>
      
      <Section title="Credit Sales">
        {(deductions.creditSales || []).map(credit => renderLitreBasedSale(credit, 'creditSales', addCreditSale, removeCreditSale, "Company/Transporter name"))}
        {(deductions.creditSales || []).length === 0 && (
          <TouchableOpacity onPress={addCreditSale} style={styles.standaloneAddButton}>
            <Plus size={16} color="#2563eb" />
            <Text style={styles.standaloneAddButtonText}>Add Credit Sale</Text>
          </TouchableOpacity>
        )}
      </Section>
      
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Deductions:</Text>
          <Text style={styles.summaryValue}>₹{(totals.totalDeductions || 0).toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.cashSaleRow]}>
          <Text style={styles.cashSaleLabel}>Cash Sale:</Text>
          <Text style={styles.cashSaleValue}>₹{(totals.cashSale || 0).toFixed(2)}</Text>
        </View>
      </View>
    </Card>
  );
}

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <View style={styles.salesSection}>
    <View style={styles.salesHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  validationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  validationText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  salesSection: { marginBottom: 16 },
  salesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  saleRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  textInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#ffffff', color: '#1f2937' },
  removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
  addButtonRow: { padding: 8, borderRadius: 6, backgroundColor: '#ecfdf5' },
  actionButtonsContainer: { flexDirection: 'row', gap: 4 },
  summarySection: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#1f2937' },
  cashSaleRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, marginBottom: 0 },
  cashSaleLabel: { fontSize: 16, fontWeight: '600', color: '#374151' },
  cashSaleValue: { fontSize: 16, fontWeight: '700', color: '#059669' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  fuelTypeSelector: { flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, overflow: 'hidden' },
  fuelTypeButton: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#ffffff' },
  fuelTypeActive: { backgroundColor: '#2563eb' },
  fuelTypeText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  fuelTypeActiveText: { color: '#ffffff' },
  autoCalculatedInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
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
    marginTop: 8,
  },
  standaloneAddButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
});
