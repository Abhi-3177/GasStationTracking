export interface MachineReading {
  id: string;
  name: string;
  openingReading: number;
  closingReading: number;
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

export interface DayBookRecord {
  date: string;
  machines: {
    petrol: MachineReading[];
    diesel: MachineReading[];
  };
  prices: {
    petrol: number;
    diesel: number;
  };
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
    cashDeposit: number;
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
  dayBalance: number;
}

export interface BalanceEntry {
  id: string;
  date: string;
  description: string;
  type: 'credit' | 'debit'; // credit = advance from customer, debit = outstanding balance
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
}

// --- New Daily Record Types ---

export interface BankReconciliationEntry {
  type: 'atmSale' | 'phonePeSale' | 'paytmSale' | 'cashDeposit';
  expected: number;
  matched: boolean;
}

export interface PaymentReceived {
  id: string;
  date: string;
  accountId: string;
  amount: number;
  description: string;
  user_id: string;
  created_at: string;
}

export interface DailyRecord {
  date: string;
  user_id: string;
  bankReconciliation: BankReconciliationEntry[];
  paymentsReceived: PaymentReceived[];
}
