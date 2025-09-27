import { DayBookRecord, CalculatedTotals } from '../types/daybook';

export function calculateTotals(record: DayBookRecord): CalculatedTotals {
  // Calculate litres sold
  const petrolLitres = record.machines.petrol.reduce(
    (total, machine) => total + Math.max(0, machine.closingReading - machine.openingReading),
    0
  );
  
  const dieselLitres = record.machines.diesel.reduce(
    (total, machine) => total + Math.max(0, machine.closingReading - machine.openingReading),
    0
  );

  // Calculate sales and round up to the next whole number
  const petrolSale = Math.ceil(petrolLitres * record.prices.petrol);
  const dieselSale = Math.ceil(dieselLitres * record.prices.diesel);
  const totalSale = petrolSale + dieselSale;

  // Calculate deductions
  const totalSviSales = record.deductions.sviSales.reduce(
    (total, svi) => total + svi.amount,
    0
  );
  
  const totalSales0332 = record.deductions.sales0332.reduce(
    (total, sale) => total + sale.amount,
    0
  );
  
  const totalCreditSales = record.deductions.creditSales.reduce(
    (total, credit) => total + credit.amount,
    0
  );
  
  const totalDeductions = totalSviSales + totalSales0332 + totalCreditSales;
  const cashSale = totalSale - totalDeductions;

  // Calculate expenses
  const totalGasCommissions = record.expenses.gasCommissions.reduce(
    (total, commission) => total + commission.amount,
    0
  );

  const totalAdditionalExpenses = record.expenses.additionalExpenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );
  
  const gasTestingExpense = 
    (record.expenses.gasTesting.petrolTestLitres * record.prices.petrol) +
    (record.expenses.gasTesting.dieselTestLitres * record.prices.diesel);
  
  const totalExpenses = totalGasCommissions + totalAdditionalExpenses + gasTestingExpense;
  const netSale = cashSale - totalExpenses;

  // Calculate payments
  const totalPayments = 
    record.payments.atmSale + 
    record.payments.phonePeSale + 
    record.payments.paytmSale + 
    record.payments.cashDeposit;

  const dayBalance = netSale - totalPayments;

  return {
    petrolLitres,
    dieselLitres,
    petrolSale,
    dieselSale,
    totalSale,
    totalDeductions,
    cashSale,
    gasTestingExpense,
    totalExpenses,
    netSale,
    totalPayments,
    dayBalance,
  };
}
