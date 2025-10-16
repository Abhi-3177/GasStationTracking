import { DayBookRecord, CalculatedTotals } from '../types/daybook';

export function calculateTotals(record: DayBookRecord, previousRecord: DayBookRecord | null): CalculatedTotals {
  const pLitres = (record?.machines?.petrol || []).reduce(
    (total, machine) => total + Math.max(0, (machine?.closingReading || 0) - (machine?.openingReading || 0)),
    0
  );
  
  const dLitres = (record?.machines?.diesel || []).reduce(
    (total, machine) => total + Math.max(0, (machine?.closingReading || 0) - (machine?.openingReading || 0)),
    0
  );

  const petrolPrice = record?.prices?.petrol || 0;
  const dieselPrice = record?.prices?.diesel || 0;

  const petrolSale = Math.ceil(pLitres * petrolPrice);
  const dieselSale = Math.ceil(dLitres * dieselPrice);
  
  const totalOtherSales = (record?.otherSales || []).reduce((total, sale) => total + (sale?.amount || 0), 0);
  
  const totalSale = petrolSale + dieselSale + totalOtherSales;

  const totalSviSales = (record?.deductions?.sviSales || []).reduce((total, svi) => total + (svi?.amount || 0), 0);
  const totalSales0332 = (record?.deductions?.sales0332 || []).reduce((total, sale) => total + (sale?.amount || 0), 0);
  const totalCreditSales = (record?.deductions?.creditSales || []).reduce((total, credit) => total + (credit?.amount || 0), 0);
  
  const totalCredit = totalSviSales + totalSales0332 + totalCreditSales;
  
  const cashSale = totalSale - totalCredit;

  const totalGasCommissions = (record?.expenses?.gasCommissions || []).reduce((total, commission) => total + (commission?.amount || 0), 0);
  const totalAdditionalExpenses = (record?.expenses?.additionalExpenses || []).reduce((total, expense) => total + (expense?.amount || 0), 0);
  
  const gasTesting = record?.expenses?.gasTesting || { petrolTestLitres: 0, dieselTestLitres: 0 };
  const gasTestingExpense = 
    ((gasTesting?.petrolTestLitres || 0) * petrolPrice) +
    ((gasTesting?.dieselTestLitres || 0) * dieselPrice);
  
  const totalExpenses = totalGasCommissions + totalAdditionalExpenses + gasTestingExpense;
  const netSale = cashSale - totalExpenses;

  const totalCashDeposits = (record?.payments?.cashDeposits || []).reduce((total, entry) => total + (entry?.amount || 0), 0);

  const totalPayments = 
    (record?.payments?.atmSale || 0) + 
    (record?.payments?.phonePeSale || 0) + 
    (record?.payments?.paytmSale || 0) + 
    (record?.payments?.directPnbTransfer || 0) + // New field
    totalCashDeposits;

  const totalCashIn = (record?.cashTransactions || []).reduce((total, trans) => total + (trans?.type === 'in' ? (trans?.amount || 0) : 0), 0);
  const totalCashOut = (record?.cashTransactions || []).reduce((total, trans) => total + (trans?.type === 'out' ? (trans?.amount || 0) : 0), 0);

  const previousDayBalance = 
    previousRecord && !previousRecord.cashCollected 
      ? calculateTotals(previousRecord, null).dayBalance 
      : 0;

  const dayBalance = netSale - totalPayments + totalCashIn - totalCashOut + previousDayBalance;

  return {
    petrolLitres: Number(pLitres) || 0,
    dieselLitres: Number(dLitres) || 0,
    petrolSale: Number(petrolSale) || 0,
    dieselSale: Number(dieselSale) || 0,
    totalSale: Number(totalSale) || 0,
    totalDeductions: Number(totalCredit) || 0,
    cashSale: Number(cashSale) || 0,
    gasTestingExpense: Number(gasTestingExpense) || 0,
    totalExpenses: Number(totalExpenses) || 0,
    netSale: Number(netSale) || 0,
    totalPayments: Number(totalPayments) || 0,
    totalCashIn: Number(totalCashIn) || 0,
    totalCashOut: Number(totalCashOut) || 0,
    previousDayBalance: Number(previousDayBalance) || 0,
    dayBalance: Number(dayBalance) || 0,
  };
}
