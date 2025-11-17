import { supabase } from '../lib/supabase';
import { DayBookRecord, Account, DailyRecord, PaymentReceived, CreditSale, Sale0332, BalanceEntry, Transaction, SviSale, StockOrder, AgedDebtor, StockReport, Sale0332BreakdownEntry } from '../types/daybook';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

// --- Text Formatting Helpers ---
const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const toUpperCase = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.toUpperCase().trim();
};


// Helper to get current user's ID
const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  return session.user.id;
};

// --- START: Auto-account creation and linking logic ---
async function linkAccountIdsForEntries<T extends { name: string; accountId?: string | null }>(
  entries: T[],
  userId: string
): Promise<{ processedEntries: T[]; newAccountsCreated: boolean }> {
  if (!entries || entries.length === 0) {
    return { processedEntries: entries, newAccountsCreated: false };
  }

  const namesToLink = new Set<string>();
  entries.forEach(entry => {
    if (entry.name && !entry.accountId) {
      namesToLink.add(toTitleCase(entry.name.trim()));
    }
  });

  if (namesToLink.size === 0) {
    return { processedEntries: entries, newAccountsCreated: false };
  }

  const { data: existingAccounts, error: fetchError } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('user_id', userId);

  if (fetchError) {
    console.error("Auto-linking failed: Could not fetch existing accounts.", fetchError);
    return { processedEntries: entries, newAccountsCreated: false }; // Return original on error
  }

  const existingAccountMap = new Map(
    (existingAccounts || []).map(acc => [acc.name.trim().toLowerCase(), acc.id])
  );

  const newAccountNames: string[] = [];
  for (const name of namesToLink) {
    if (!existingAccountMap.has(name.toLowerCase())) {
      newAccountNames.push(name);
    }
  }

  let newAccountsCreated = false;
  if (newAccountNames.length > 0) {
    const accountsToInsert = newAccountNames.map(name => ({
      name,
      type: 'factory' as 'factory' | 'transporter',
      user_id: userId,
    }));

    const { data: createdAccounts, error: createError } = await supabase
      .from('accounts')
      .insert(accountsToInsert)
      .select('id, name');

    if (createError) {
      console.error("Failed to auto-create new accounts:", createError);
    } else if (createdAccounts) {
      newAccountsCreated = true;
      createdAccounts.forEach(acc => {
        existingAccountMap.set(acc.name.trim().toLowerCase(), acc.id);
      });
    }
  }

  const processedEntries = entries.map(entry => {
    if (entry.name && !entry.accountId) {
      const accountId = existingAccountMap.get(toTitleCase(entry.name.trim()).toLowerCase());
      if (accountId) {
        return { ...entry, accountId };
      }
    }
    return entry;
  });

  return { processedEntries, newAccountsCreated };
}
// --- END: Auto-account creation and linking logic ---


// --- Day Book Functions ---

export async function saveRecord(record: DayBookRecord): Promise<void> {
  const userId = await getUserId();

  // Create a mutable copy to apply formatting
  const formattedRecord: DayBookRecord = JSON.parse(JSON.stringify(record));

  // --- START: Apply Capitalization ---
  const formatSale = (sale: CreditSale | Sale0332 | SviSale) => ({
    ...sale,
    name: toTitleCase(sale.name),
    vehicleNumber: toUpperCase(sale.vehicleNumber),
  });

  formattedRecord.deductions.creditSales = (formattedRecord.deductions.creditSales || []).map(formatSale);
  formattedRecord.deductions.sales0332 = (formattedRecord.deductions.sales0332 || []).map(formatSale);
  formattedRecord.deductions.sviSales = (formattedRecord.deductions.sviSales || []).map(formatSale);


  formattedRecord.otherSales = (formattedRecord.otherSales || []).map(s => ({ ...s, name: toTitleCase(s.name) }));
  formattedRecord.cashTransactions = (formattedRecord.cashTransactions || []).map(i => ({ ...i, name: toTitleCase(i.name), comment: toTitleCase(i.comment) }));
  
  formattedRecord.expenses.gasCommissions = (formattedRecord.expenses.gasCommissions || []).map(e => ({ ...e, name: toTitleCase(e.name) }));
  formattedRecord.expenses.additionalExpenses = (formattedRecord.expenses.additionalExpenses || []).map(e => ({ ...e, name: toTitleCase(e.name) }));
  
  formattedRecord.payments.cashDeposits = (formattedRecord.payments.cashDeposits || []).map(d => ({ ...d, description: toTitleCase(d.description) }));
  // --- END: Apply Capitalization ---

  const salesToProcess = [
    ...(formattedRecord.deductions.creditSales || []),
    ...(formattedRecord.deductions.sales0332 || []),
    ...(formattedRecord.deductions.sviSales || []),
    ...(formattedRecord.cashTransactions || []),
  ];

  const { processedEntries } = await linkAccountIdsForEntries(salesToProcess, userId);
  
  // Re-distribute the processed entries back to the record
  formattedRecord.deductions.creditSales = [];
  formattedRecord.deductions.sales0332 = [];
  formattedRecord.deductions.sviSales = [];
  formattedRecord.cashTransactions = [];

  processedEntries.forEach((entry: any) => {
    if (entry.type === 'in' || entry.type === 'out') {
        formattedRecord.cashTransactions.push(entry);
    } else {
        const saleNameLower = entry.name.toLowerCase().trim();
        if (saleNameLower === 'svi') {
            formattedRecord.deductions.sviSales.push(entry);
        } else if (saleNameLower === 'svi 0332') {
            formattedRecord.deductions.sales0332.push(entry);
        } else {
            formattedRecord.deductions.creditSales.push(entry);
        }
    }
  });


  const { error } = await supabase
    .from('day_book_records')
    .upsert({
      date: formattedRecord.date,
      user_id: userId,
      record: formattedRecord as any,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'date, user_id' });

  if (error) {
    console.error('Error saving Day Book record:', error);
    throw error;
  }
}

export async function getRecord(date: string): Promise<DayBookRecord | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('day_book_records')
    .select('record')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: "The result contains 0 rows"
    console.error('Error fetching Day Book record:', error);
    throw error;
  }
  return data ? data.record as DayBookRecord : null;
}

export async function getPreviousRecord(currentDate: string): Promise<DayBookRecord | null> {
  const previousDate = format(subDays(new Date(currentDate), 1), 'yyyy-MM-dd');
  return getRecord(previousDate);
}

export async function getAllRecords(): Promise<DayBookRecord[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('day_book_records')
    .select('record')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching all Day Book records:', error);
    throw error;
  }
  return data.map(item => item.record as DayBookRecord);
}

export async function getRecordsForMonth(year: number, month: number): Promise<{ dayBook: DayBookRecord; dailyRecord: DailyRecord | null; }[]> {
    const userId = await getUserId();
    const startDate = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month)), 'yyyy-MM-dd');

    const { data: dayBooks, error: dayBookError } = await supabase
        .from('day_book_records')
        .select('record')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (dayBookError) {
        console.error('Error fetching records for month:', dayBookError);
        throw dayBookError;
    }
    if (!dayBooks) return [];

    const { data: dailyRecords, error: dailyRecordError } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

    if (dailyRecordError) {
        console.error('Error fetching daily records for month:', dailyRecordError);
        // We can continue without daily records if they fail
    }

    const { data: allPayments, error: paymentsError } = await supabase
        .from('payments_received')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (paymentsError) {
        console.error('Error fetching payments for month:', paymentsError);
    }

    const dailyRecordMap = new Map<string, DailyRecord>();
    (dailyRecords || []).forEach(dr => {
        dailyRecordMap.set(dr.date, {
            ...dr,
            bankReconciliation: (dr.bank_reconciliation as any) || [],
            paymentsReceived: (allPayments || []).filter(p => p.date === dr.date).map(p => ({
                id: p.id,
                date: p.date,
                accountId: p.account_id,
                amount: p.amount,
                description: p.description || '',
                receiptNumber: p.receipt_number || '',
                paymentMethod: p.payment_method || '',
                user_id: p.user_id,
                created_at: p.created_at,
            })),
        });
    });

    return dayBooks.map(item => {
        const dayBook = item.record as DayBookRecord;
        return {
            dayBook,
            dailyRecord: dailyRecordMap.get(dayBook.date) || null,
        };
    });
}

export async function getDayBookRecordsForDateRange(startDate: string, endDate: string): Promise<DayBookRecord[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('day_book_records')
        .select('record')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (error) {
        console.error('Error fetching day book records for date range:', error);
        throw error;
    }
    return (data || []).map(item => item.record as DayBookRecord);
}

export async function deleteRecordsForDate(date: string): Promise<void> {
  const { error } = await supabase.rpc('delete_records_for_date', {
    record_date: date,
  });

  if (error) {
    console.error('Error calling delete_records_for_date RPC:', error);
    throw new Error(`Database deletion failed: ${error.message}. Please check database permissions or function definition.`);
  }
}

export async function deleteAllUserData(): Promise<void> {
    const { error } = await supabase.rpc('delete_all_user_data');
    if (error) {
        console.error('Error calling delete_all_user_data RPC:', error);
        throw new Error(`Failed to delete all user data: ${error.message}`);
    }
}

// --- Account Functions ---

export async function saveAccount(account: Account): Promise<void> {
  const userId = await getUserId();
  
  const { id, balanceEntries, createdAt, currentBalance, lastPaymentDate, ...accountData } = account;

  const formattedAccountData = {
    ...accountData,
    name: toTitleCase(accountData.name),
    address: toTitleCase(accountData.address),
  };

  const formattedBalanceEntries = (balanceEntries || []).map(entry => ({
    ...entry,
    description: toTitleCase(entry.description),
    amount: Math.round((entry.amount || 0) * 100) / 100,
  }));

  const isNewAccount = !id || !id.includes('-');

  const accountToUpsert = {
    ...formattedAccountData,
    user_id: userId,
    ...(!isNewAccount && { id: id }),
  };

  const { data: savedAccount, error: accountError } = await supabase
    .from('accounts')
    .upsert(accountToUpsert)
    .select()
    .single();

  if (accountError || !savedAccount) throw accountError || new Error('Failed to save account.');

  const savedAccountId = savedAccount.id;

  await supabase.from('balance_entries').delete().eq('account_id', savedAccountId);

  if (formattedBalanceEntries.length > 0) {
    const entriesToInsert = formattedBalanceEntries.map(({ id: entryId, ...entry }) => ({
      ...entry,
      account_id: savedAccountId,
      user_id: userId,
    }));
    const { error: insertError } = await supabase.from('balance_entries').insert(entriesToInsert);
    if (insertError) throw insertError;
  }
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const userId = await getUserId();
  
  const { data: accountData, error: accountError } = await supabase
    .from('accounts')
    .select('*, balance_entries(*)')
    .eq('user_id', userId)
    .eq('id', accountId)
    .single();

  if (accountError && accountError.code !== 'PGRST116') throw accountError;
  if (!accountData) return null;

  return {
    ...accountData,
    createdAt: accountData.created_at,
    balanceEntries: (accountData.balance_entries as any[]) || [],
  } as Account;
}

export async function getAllAccounts(): Promise<Account[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        console.error("Error loading accounts from DB:", error);
        throw error;
    }
    if (!data) {
        return [];
    }

    // This ensures that even if balance_entries is null in the DB, it's a safe empty array in the app.
    return data
        .map(account => {
            if (!account || !account.id) {
                return null;
            }
            return {
                ...account,
                createdAt: account.created_at,
                balanceEntries: [],
            } as Account;
        })
        .filter((account): account is Account => account !== null);
}

export async function getAccountByName(name: string): Promise<Account | null> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('name', toTitleCase(name))
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as Account | null;
}

export async function deleteAccount(accountId: string): Promise<void> {
  const userId = await getUserId();
  await supabase.from('balance_entries').delete().eq('account_id', accountId);
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);
        
  if (error) throw error;
}

export async function getTransactionsForAccount(accountId: string): Promise<Transaction[]> {
    const userId = await getUserId();
    const allTransactions: Transaction[] = [];

    // Fetch sent receipts for this account
    const { data: sentReceiptsData, error: sentReceiptsError } = await supabase
        .from('sent_receipts')
        .select('transaction_id')
        .eq('user_id', userId)
        .eq('account_id', accountId);
    
    if (sentReceiptsError) {
        console.error("Could not fetch sent receipts status:", sentReceiptsError);
    }
    const sentTxIds = new Set((sentReceiptsData || []).map(r => r.transaction_id));

    // 1. Fetch Balance Entries
    const { data: balanceEntries, error: balanceError } = await supabase
        .from('balance_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('account_id', accountId);
    if (balanceError) throw balanceError;
    if (balanceEntries) {
        allTransactions.push(...balanceEntries.map(be => ({ ...be, id: `be:${be.id}`, isSent: sentTxIds.has(`be:${be.id}`) })));
    }

    // 2. Fetch Payments Received
    const { data: paymentsReceived, error: paymentsError } = await supabase
        .from('payments_received')
        .select('*, accounts(name)')
        .eq('user_id', userId)
        .eq('account_id', accountId);
    if (paymentsError) throw paymentsError;
    if (paymentsReceived) {
        allTransactions.push(...paymentsReceived.map(pr => {
            const id = `pr:${pr.id}`;
            const isPaytm = pr.accounts?.name.toLowerCase() === 'paytm';
            return {
                id,
                date: pr.date,
                description: pr.description || `Payment Received`,
                type: 'credit',
                amount: pr.amount,
                receiptNumber: isPaytm ? undefined : (pr.receipt_number || undefined),
                transactionId: isPaytm ? (pr.receipt_number || undefined) : undefined,
                paymentMethod: pr.payment_method || undefined,
                isSent: sentTxIds.has(id),
            };
        }));
    }

    // 3. Fetch Day Book Records
    const { data: dayBookRecords, error: dayBookError } = await supabase
        .from('day_book_records')
        .select('date, record')
        .eq('user_id', userId);
    if (dayBookError) throw dayBookError;
    if (dayBookRecords) {
        dayBookRecords.forEach(dbr => {
            const record = dbr.record as DayBookRecord;
            if (!record) return;

            const processSales = (sales: (CreditSale | Sale0332 | SviSale)[], type: string, prefix: string) => {
                (sales || []).forEach(sale => {
                    if (sale.accountId === accountId) {
                        const id = `${prefix}:${dbr.date}:${sale.id}`;
                        allTransactions.push({
                            id,
                            date: dbr.date,
                            description: type,
                            type: 'debit',
                            amount: sale.amount,
                            receiptNumber: sale.receiptNumber || undefined,
                            vehicleNumber: sale.vehicleNumber || undefined,
                            isSent: sentTxIds.has(id),
                        });
                    }
                });
            };
            
            processSales(record.deductions?.creditSales, 'Credit Sale', 'cs');
            processSales(record.deductions?.sales0332, '0332 Sale', 's0');
            processSales(record.deductions?.sviSales, 'SVI Sale', 'sv');
            
            (record.cashTransactions || []).forEach(trans => {
                if (trans.accountId === accountId) {
                    const prefix = `ct_${trans.type}`;
                    const id = `${prefix}:${dbr.date}:${trans.id}`;
                    allTransactions.push({
                        id,
                        date: dbr.date,
                        description: `Cash ${trans.type === 'in' ? 'Received' : 'Given'}${trans.comment ? `: ${trans.comment}` : ''}`,
                        type: trans.type === 'in' ? 'credit' : 'debit',
                        amount: trans.amount,
                        isSent: sentTxIds.has(id),
                    });
                }
            });
        });
    }

    // 4. Fetch Daily Records for 0332 Sales
    const { data: dailyRecords, error: dailyRecordsError } = await supabase
        .from('daily_records')
        .select('date, sales_0332_breakdown')
        .eq('user_id', userId);
        
    if (dailyRecordsError) {
        console.error("Error fetching daily records for ledger:", dailyRecordsError);
    } else if (dailyRecords) {
        dailyRecords.forEach(dr => {
            const breakdown = dr.sales_0332_breakdown as Sale0332BreakdownEntry[] | null;
            if (breakdown && Array.isArray(breakdown)) {
                breakdown.forEach(entry => {
                    if (entry.accountId === accountId) {
                        const id = `vs0332:${dr.date}:${entry.id}`;
                        allTransactions.push({
                            id,
                            date: dr.date,
                            description: '0332 Vehicle Sale',
                            type: 'debit',
                            amount: entry.amount,
                            vehicleNumber: '0332',
                            isSent: sentTxIds.has(id),
                        });
                    }
                });
            }
        });
    }

    // Sort all transactions by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return allTransactions;
}

export async function getFilteredAccountTransactions(accountId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    const allTransactions = await getTransactionsForAccount(accountId);
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return allTransactions.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        return txDate >= start && txDate <= end;
    });
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_transaction', {
    p_transaction_id: transactionId,
  });
  if (error) {
    console.error('Error calling delete_transaction RPC:', error);
    throw new Error(`Database deletion failed: ${error.message}`);
  }
}

export async function getAccountsWithLastPayment(): Promise<Account[]> {
    const userId = await getUserId();
    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        console.error("Error loading accounts from DB:", error);
        throw error;
    }
    if (!accounts) return [];

    const accountsWithDetails = await Promise.all(
        accounts.map(async (account) => {
            const [transactions, lastPayment] = await Promise.all([
                getTransactionsForAccount(account.id),
                supabase
                    .from('payments_received')
                    .select('date')
                    .eq('account_id', account.id)
                    .order('date', { ascending: false })
                    .limit(1)
                    .single()
            ]);

            const balance = transactions.reduce((bal, tx) => {
                return bal + (tx.type === 'credit' ? tx.amount : -tx.amount);
            }, 0);

            return { 
                ...account, 
                balanceEntries: [],
                currentBalance: balance,
                lastPaymentDate: lastPayment.data?.date || null,
            } as Account;
        })
    );

    return accountsWithDetails;
}

export async function bulkCreateAccounts(accounts: { name: string; type: 'factory' | 'transporter'; contact?: string; address?: string; openingBalance: number }[]): Promise<void> {
    const { error } = await supabase.rpc('bulk_create_accounts', {
        accounts_data: accounts,
    });
    if (error) {
        console.error('Error calling bulk_create_accounts RPC:', error);
        throw error;
    }
}

// --- Stock Order Functions ---
export async function addStockOrder(order: { date: string; fuel_type: 'petrol' | 'diesel'; litres: number }): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('stock_orders').insert({ ...order, user_id: userId });
    if (error) throw error;
}

export async function getStockOrdersForDateRange(startDate: string, endDate: string): Promise<StockOrder[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('stock_orders')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function getStockOrdersForMonth(year: number, month: number): Promise<StockOrder[]> {
    const startDate = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month)), 'yyyy-MM-dd');
    return getStockOrdersForDateRange(startDate, endDate);
}

export async function deleteStockOrder(orderId: string): Promise<void> {
    const { error } = await supabase.from('stock_orders').delete().eq('id', orderId);
    if (error) throw error;
}

// --- Stock Report Functions ---
export async function getLatestStockReport(): Promise<StockReport | null> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('stock_reports')
        .select('*')
        .eq('user_id', userId)
        .order('end_date', { ascending: false })
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching latest stock report:', error);
        throw error;
    }
    return data ? (data as StockReport) : null;
}

export async function saveStockReport(report: StockReport): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('stock_reports').upsert({ ...report, user_id: userId });
    if (error) {
        console.error('Error saving stock report:', error);
        throw error;
    }
}


// --- Analytics Functions ---
export async function getMonthlyFuelSales() {
  const { data, error } = await supabase.rpc('get_monthly_fuel_sales');
  if (error) throw error;
  return data;
}

export async function getAccountSalesFluctuation(currentMonthStart: string, percentageThreshold: number) {
  const { data, error } = await supabase.rpc('get_account_sales_fluctuation', {
    current_month_start: currentMonthStart,
    percentage_threshold: percentageThreshold,
  });
  if (error) throw error;
  return data;
}

export async function getAgedDebtorsReport(): Promise<AgedDebtor[]> {
    const { data, error } = await supabase.rpc('get_aged_debtors_report');
    if (error) {
        console.error('Error fetching aged debtors report:', error);
        throw error;
    }
    return data || [];
}

// --- Daily Record Functions ---
export async function getDailyRecord(date: string): Promise<DailyRecord | null> {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('daily_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
  
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Daily Record:', error);
      throw error;
    }
    if (!data) return null;

    const { data: payments, error: paymentsError } = await supabase
        .from('payments_received')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date);

    if (paymentsError) {
        console.error(`Error fetching payments for ${date}:`, paymentsError);
    }

    const mappedPayments = (payments || []).map(p => ({
        id: p.id,
        date: p.date,
        accountId: p.account_id,
        amount: p.amount,
        description: p.description || '',
        receiptNumber: p.receipt_number || '',
        paymentMethod: p.payment_method || '',
        user_id: p.user_id,
        created_at: p.created_at,
    }));

    return {
        ...data,
        bankReconciliation: (data.bank_reconciliation as any) || [],
        sales0332Breakdown: (data.sales_0332_breakdown as any) || [],
        paymentsReceived: mappedPayments,
    };
}

export async function getDailyRecordsForDateRange(startDate: string, endDate: string): Promise<DailyRecord[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (error) {
        console.error('Error fetching daily records for date range:', error);
        throw error;
    }
    return (data || []).map(dr => ({
        ...dr,
        bankReconciliation: (dr.bank_reconciliation as any) || [],
        sales0332Breakdown: (dr.sales_0332_breakdown as any) || [],
        paymentsReceived: [], // Not hydrated for this specific report to keep it fast
    }));
}

export async function getAllDailyRecords(): Promise<DailyRecord[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching all Daily Records:', error);
        throw error;
    }
    return (data || []).map(dr => ({
        ...dr,
        bankReconciliation: (dr.bank_reconciliation as any) || [],
        sales0332Breakdown: (dr.sales_0332_breakdown as any) || [],
        paymentsReceived: [], // This is simplified; full fetch is complex here
    }));
}

export async function saveDailyRecord(record: DailyRecord): Promise<void> {
    const userId = await getUserId();
    const { paymentsReceived, ...recordToSave } = record; // Exclude paymentsReceived

    // New logic for account creation from 0332 breakdown
    if (recordToSave.sales0332Breakdown && recordToSave.sales0332Breakdown.length > 0) {
        const { processedEntries } = await linkAccountIdsForEntries(recordToSave.sales0332Breakdown, userId);
        recordToSave.sales0332Breakdown = processedEntries;
    }
    
    const { error } = await supabase
        .from('daily_records')
        .upsert({
            date: recordToSave.date,
            user_id: userId,
            bank_reconciliation: recordToSave.bankReconciliation as any,
            sales_0332_breakdown: recordToSave.sales0332Breakdown as any,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'date, user_id' });

    if (error) {
        console.error('Error saving Daily Record:', error);
        throw error;
    }
}

export async function addPaymentReceived(payment: Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('payments_received').insert({
        date: payment.date,
        user_id: userId,
        account_id: payment.accountId,
        amount: payment.amount,
        description: payment.description,
        receipt_number: payment.receiptNumber,
        payment_method: payment.paymentMethod,
    });
    if (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error('This Receipt Number or Transaction ID has already been used.');
      }
      console.error('Error adding payment received:', error);
      throw error;
    }
}

export async function updatePaymentReceived(paymentId: string, updates: Partial<Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>>): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase
        .from('payments_received')
        .update({
            date: updates.date,
            account_id: updates.accountId,
            amount: updates.amount,
            description: updates.description,
            receipt_number: updates.receiptNumber,
            payment_method: updates.paymentMethod,
        })
        .eq('id', paymentId)
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error updating payment received:', error);
        throw error;
    }
}

export async function deletePaymentReceived(paymentId: string): Promise<void> {
    const { error } = await supabase.from('payments_received').delete().eq('id', paymentId);
    if (error) throw error;
}

export async function addCreditSaleToDayBook(sale: Omit<CreditSale, 'id' | 'lastEdited'>, date: string): Promise<void> {
    const record = await getRecord(date);
    const newSale: CreditSale = {
        ...sale,
        id: Date.now().toString(),
        lastEdited: 'amount',
    };
    if (record) {
        const updatedRecord = { ...record };
        updatedRecord.deductions.creditSales = [...(updatedRecord.deductions.creditSales || []), newSale];
        await saveRecord(updatedRecord);
    } else {
        const userId = await getUserId();
        const prevRecord = await getPreviousRecord(date);
        const newRecord = createNewRecord(date, prevRecord);
        newRecord.deductions.creditSales = [newSale];
        await saveRecord(newRecord);
    }
}

export async function bulkAddPayments(date: string, payments: { account_name: string; amount: number; description: string; receipt_number: string }[]): Promise<void> {
    const { error } = await supabase.rpc('bulk_add_payments_and_create_accounts', {
        p_date: date,
        payments_data: payments,
    });
    if (error) {
        console.error('Error calling bulk_add_payments RPC:', error);
        throw error;
    }
}

// --- System Account Helper ---
export async function getOrCreateSystemAccount(name: string): Promise<Account> {
  const userId = await getUserId();
  const titleCaseName = toTitleCase(name);

  const { data: existingAccount, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('name', titleCaseName)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error(`Error fetching system account "${titleCaseName}":`, fetchError);
    throw fetchError;
  }

  if (existingAccount) {
    return {
        ...existingAccount,
        createdAt: existingAccount.created_at,
        balanceEntries: [],
    } as Account;
  }

  const { data: newAccount, error: createError } = await supabase
    .from('accounts')
    .insert({
      name: titleCaseName,
      type: 'factory', // Default type
      user_id: userId,
    })
    .select()
    .single();
  
  if (createError || !newAccount) {
    console.error(`Error creating system account "${titleCaseName}":`, createError);
    throw createError || new Error('Failed to create system account.');
  }
  
  return {
    ...newAccount,
    createdAt: newAccount.created_at,
    balanceEntries: [],
  } as Account;
}

// --- Follow Up Functions ---
export async function markReceiptsAsSent(receipts: { transaction_id: string; account_id: string; receipt_number: string | null; amount: number; transaction_date: string }[]): Promise<void> {
    const userId = await getUserId();
    const receiptsToInsert = receipts.map(r => ({ ...r, user_id: userId }));
    
    const { error } = await supabase
        .from('sent_receipts')
        .insert(receiptsToInsert, { onConflict: 'user_id, transaction_id' });

    if (error) {
        console.error('Error marking receipts as sent:', error);
        throw error;
    }
}
