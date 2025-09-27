export interface MachineReading {
  id: string;
  name: string;
  openingReading: number;
  closingReading: number;
}

export interface CreditSale {
  id: string;
  name: string;
  litres: number;
  fuelType: 'petrol' | 'diesel';
  amount: number;
  lastEdited: 'litres' | 'amount';
}

export interface SviSale {
  id: string;
  name: string;
  litres: number;
  fuelType: 'petrol' | 'diesel';
  amount: number;
  lastEdited: 'litres' | 'amount';
}

export interface Sale0332 {
  id: string;
  name: string;
  litres: number;
  fuelType: 'petrol' | 'diesel';
  amount: number;
  lastEdited: 'litres' | 'amount';
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
