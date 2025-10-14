import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { NumberInput } from './NumberInput';
import { AccountAutocomplete } from './AccountAutocomplete';
import { DayBookRecord, Account, CreditSale, SviSale, Sale0332 } from '../types/daybook';
import { formatIndianCurrency, formatLitres } from '../utils/formatters';

interface DeductionsSectionProps {
  deductions: DayBookRecord['deductions'];
  prices: DayBookRecord['prices'];
  onUpdateDeductions: (deductions: DayBookRecord['deductions']) => void;
  accounts: Account[];
}

type SaleType = 'sviSales' | 'sales0332' | 'creditSales';
type SaleItem = CreditSale | SviSale | Sale0332;

const SaleEntryRow = ({ item, saleType, accounts, onUpdate, onRemove, prices }: {
    item: SaleItem;
    saleType: SaleType;
    accounts: Account[];
    onUpdate: (id: string, updates: Partial<SaleItem>) => void;
    onRemove: (id: string) => void;
    prices: DayBookRecord['prices'];
}) => {
    const isSviOr0332 = saleType === 'sviSales' || saleType === 'sales0332';
    const fuelPrice = item.fuelType === 'petrol' ? prices.petrol : prices.diesel;

    const handleAmountChange = (newAmount: number) => {
        const newLitres = fuelPrice > 0 ? newAmount / fuelPrice : item.litres;
        onUpdate(item.id, { amount: newAmount, litres: newLitres, lastEdited: 'amount' });
    };

    const handleLitresChange = (newLitres: number) => {
        const newAmount = newLitres * fuelPrice;
        onUpdate(item.id, { litres: newLitres, amount: newAmount, lastEdited: 'litres' });
    };

    return (
        <View style={styles.entryRow}>
            <View style={styles.rowTop}>
                {isSviOr0332 ? (
                    <TextInput
                        style={[styles.input, styles.readOnlyInput]}
                        value={item.name}
                        editable={false}
                    />
                ) : (
                    <AccountAutocomplete
                        accounts={accounts}
                        value={item.name}
                        onValueChange={(name) => onUpdate(item.id, { name, accountId: undefined })}
                        onAccountSelect={(account) => onUpdate(item.id, { name: account.name, accountId: account.id })}
                        placeholder="Account Name"
                    />
                )}
            </View>
            <View style={styles.rowBottom}>
                <TextInput
                    style={[styles.input, { flex: 1.5 }]}
                    value={item.vehicleNumber || ''}
                    onChangeText={(text) => onUpdate(item.id, { vehicleNumber: text })}
                    placeholder="Vehicle No."
                    autoCapitalize="characters"
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={item.receiptNumber || ''}
                    onChangeText={(text) => onUpdate(item.id, { receiptNumber: text })}
                    placeholder="Receipt No."
                    keyboardType="numeric"
                />
                <View style={styles.amountContainer}>
                    <NumberInput
                        value={item.amount || 0}
                        onChangeValue={handleAmountChange}
                        placeholder="Amount"
                        precision={2}
                    />
                </View>
                <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.removeButton}>
                    <Trash2 size={16} color="#dc2626" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const SaleGroup = ({ title, sales, saleType, accounts, onUpdate, onAdd, onRemove, prices }: {
    title: string;
    sales: SaleItem[];
    saleType: SaleType;
    accounts: Account[];
    onUpdate: (saleType: SaleType, id: string, updates: Partial<SaleItem>) => void;
    onAdd: (saleType: SaleType) => void;
    onRemove: (saleType: SaleType, id: string) => void;
    prices: DayBookRecord['prices'];
}) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => onAdd(saleType)}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
        </View>
        {sales.map(item => (
            <SaleEntryRow
                key={item.id}
                item={item}
                saleType={saleType}
                accounts={accounts}
                prices={prices}
                onUpdate={(id, updates) => onUpdate(saleType, id, updates)}
                onRemove={(id) => onRemove(saleType, id)}
            />
        ))}
        {sales.length === 0 && <Text style={styles.noDataText}>No {title.toLowerCase()} recorded.</Text>}
    </View>
);

export function DeductionsSection({ deductions, onUpdateDeductions, accounts, prices }: DeductionsSectionProps) {
    const handleUpdate = (saleType: SaleType, id: string, updates: Partial<SaleItem>) => {
        const currentSales = deductions[saleType] || [];
        const updatedSales = (currentSales as SaleItem[]).map(item =>
            item.id === id ? { ...item, ...updates } : item
        );
        onUpdateDeductions({ ...deductions, [saleType]: updatedSales });
    };

    const handleAdd = (saleType: SaleType) => {
        const newId = Date.now().toString();
        let newSale: SaleItem;
        if (saleType === 'sviSales') {
            newSale = { id: newId, name: 'SVI', amount: 0, litres: 0, fuelType: 'diesel', lastEdited: 'amount' };
        } else if (saleType === 'sales0332') {
            newSale = { id: newId, name: 'SVI 0332', amount: 0, litres: 0, fuelType: 'diesel', lastEdited: 'amount' };
        } else {
            newSale = { id: newId, name: '', amount: 0, litres: 0, fuelType: 'diesel', lastEdited: 'amount' };
        }
        const currentSales = deductions[saleType] || [];
        const updatedSales = [...(currentSales as SaleItem[]), newSale];
        onUpdateDeductions({ ...deductions, [saleType]: updatedSales });
    };

    const handleRemove = (saleType: SaleType, id: string) => {
        const currentSales = deductions[saleType] || [];
        const updatedSales = (currentSales as SaleItem[]).filter(item => item.id !== id);
        onUpdateDeductions({ ...deductions, [saleType]: updatedSales });
    };

    const totalDeductions =
        (deductions?.sviSales?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0) +
        (deductions?.sales0332?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0) +
        (deductions?.creditSales?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0);

    return (
        <Card>
            <View style={styles.header}>
                <Minus size={20} color="#dc2626" />
                <Text style={styles.title}>Deductions (Credit Sales)</Text>
            </View>

            <SaleGroup
                title="SVI Sales"
                sales={deductions?.sviSales || []}
                saleType="sviSales"
                accounts={accounts}
                prices={prices}
                onUpdate={handleUpdate}
                onAdd={handleAdd}
                onRemove={handleRemove}
            />
            <SaleGroup
                title="0332 Sales"
                sales={deductions?.sales0332 || []}
                saleType="sales0332"
                accounts={accounts}
                prices={prices}
                onUpdate={handleUpdate}
                onAdd={handleAdd}
                onRemove={handleRemove}
            />
            <SaleGroup
                title="General Credit Sales"
                sales={deductions?.creditSales || []}
                saleType="creditSales"
                accounts={accounts}
                prices={prices}
                onUpdate={handleUpdate}
                onAdd={handleAdd}
                onRemove={handleRemove}
            />

            <View style={styles.summarySection}>
                <Text style={styles.summaryLabel}>Total Deductions:</Text>
                <Text style={styles.summaryValue}>{formatIndianCurrency(totalDeductions)}</Text>
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
    section: { marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
    addButtonText: { color: '#fff', fontWeight: '500', fontSize: 12 },
    entryRow: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 8, gap: 8 },
    rowTop: { flexDirection: 'row' },
    rowBottom: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 12, fontSize: 14, backgroundColor: '#fff' },
    readOnlyInput: { backgroundColor: '#e5e7eb', color: '#4b5563' },
    amountContainer: { flex: 1 },
    removeButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },
    noDataText: { textAlign: 'center', fontStyle: 'italic', color: '#6b7280', padding: 10 },
    summarySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginTop: 16, borderWidth: 1, borderColor: '#dc2626' },
    summaryLabel: { fontSize: 14, fontWeight: '600', color: '#991b1b' },
    summaryValue: { fontSize: 16, fontWeight: '700', color: '#991b1b' },
});
