export interface MachineReading {
  id: string;
  name: string;
  openingReading: number;
  closingReading: number;
}

export interface OtherSale {
  id: string;
  name: string;
  amount: number;
}

export interface CashTransaction {
  id: string;
  accountId?: string;
  name: string;
  amount: number;
  type: 'in' | 'out'; // 'in' for received, 'out' for given
  comment?: string;
}

export interface CreditSale {
  id: string;
  name: string;
  accountId?: string;
  litres: number;
  fuelType: 'petrol' | 'diesel';
  amount: number;
  lastEdited: 'litres' | 'amount';
  vehicleNumber?: string;
  receiptNumber?: string;
  description?: string;
}

export interface SviSale {
  id: string;
  name: string;
  accountId?: string;
  litres: number;
  fuelType: 'petrol' | 'diesel';
  amount: number;
  lastEdited: 'litres' | 'amount';
  vehicleNumber?: string;
  receiptNumber?: string;
}

export interface Sale0332 {
  id: string;
  name: string;
  accountId?: string;
  litres: number;
  fuelType: 'petrol' | 'diesel';
  amount: number;
  lastEdited: 'litres' | 'amount';
  vehicleNumber?: string;
  receiptNumber?: string;
}

export interface GasCommission {
  id: string;
  name: string;
  amount: number;
}

export interface AdditionalExpense {
  id: string;
  name: string;
  amount: number;
}

export interface CashDepositEntry {
  id: string;
  amount: number;
  description?: string;
}

export interface DayBookRecord {
  date: string;
  cashCollected?: boolean;
  machines: {
    petrol: MachineReading[];
    diesel: MachineReading[];
  };
  prices: {
    petrol: number;
    diesel: number;
  };
  otherSales: OtherSale[];
  cashTransactions: CashTransaction[];
  deductions: {
    sviSales: SviSale[];
    sales0332: Sale0332[];
    creditSales: CreditSale[];
  };
  expenses: {
    gasCommissions: GasCommission[];
    additionalExpenses: AdditionalExpense[];
    gasTesting: {
      petrolTestLitres: number;
      dieselTestLitres: number;
    };
  };
  payments: {
    atmSale: number;
    phonePeSale: number;
    paytmSale: number;
    directPnbTransfer: number;
    cashDeposits: CashDepositEntry[];
  };
}

export interface CalculatedTotals {
  petrolLitres: number;
  dieselLitres: number;
  petrolSale: number;
  dieselSale: number;
  totalSale: number;
  totalDeductions: number;
  cashSale: number;
  gasTestingExpense: number;
  totalExpenses: number;
  netSale: number;
  totalPayments: number;
  totalCashIn: number;
  totalCashOut: number;
  previousDayBalance: number;
  dayBalance: number;
}

export interface BalanceEntry {
  id: string;
  date: string;
  description: string;
  type: 'credit' | 'debit';
  amount: number;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'factory' | 'transporter';
  contact?: string;
  address?: string;
  balanceEntries: BalanceEntry[];
  createdAt: string;
  currentBalance?: number;
  lastPaymentDate?: string | null;
}

export interface BankReconciliationEntry {
  type: 'atmSale' | 'phonePeSale' | 'paytmSale' | 'cashDeposit' | 'directPnbTransfer';
  expected: number;
  actual: number;
  matched: boolean;
}

export interface PaymentReceived {
  id: string;
  date: string;
  accountId: string;
  amount: number;
  description: string;
  receiptNumber?: string;
  paymentMethod?: string;
  user_id: string;
  created_at: string;
}

export interface DailyRecord {
  date: string;
  user_id: string;
  bankReconciliation: BankReconciliationEntry[];
  paymentsReceived: PaymentReceived[];
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'credit' | 'debit';
  amount: number;
  settlementStatus?: 'unsettled' | 'partially-settled' | 'fully-settled';
  settledAmount?: number;
  runningBalance?: number;
  // New fields for details
  receiptNumber?: string;
  vehicleNumber?: string;
  paymentMethod?: string;
  transactionId?: string; // For Paytm specifically
}

export interface StockOrder {
    id: string;
    user_id: string;
    date: string;
    fuel_type: 'petrol' | 'diesel';
    litres: number;
    created_at: string;
}

export interface AgedDebtor {
  account_id: string;
  account_name: string;
  account_type: string;
  total_outstanding: number;
  days_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
}
