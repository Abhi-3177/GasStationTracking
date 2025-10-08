import { supabase } from '../lib/supabase';
import { DayBookRecord, Account, DailyRecord, PaymentReceived } from '../types/daybook';
import { format, subDays } from 'date-fns';

// Helper to get current user's ID
const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  return session.user.id;
};

// --- Day Book Functions ---

export async function saveRecord(record: DayBookRecord): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('day_book_records')
    .upsert({
      date: record.date,
      user_id: userId,
      record: record as any,
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

export async function deleteRecord(date: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('day_book_records')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);
  
  if (error) {
    console.error('Error deleting Day Book record:', error);
    throw error;
  }
}

// --- Account Functions ---

export async function saveAccount(account: Account): Promise<void> {
  const userId = await getUserId();
  const { id, balanceEntries, createdAt, ...accountData } = account;

  // Determine if it's a new account by checking if the ID is a timestamp string
  const isNewAccount = !id.includes('-');

  const accountToUpsert = {
    ...accountData,
    user_id: userId,
    ...(!isNewAccount && { id: id }), // Only include ID if it's an existing UUID
  };

  const { data: savedAccount, error: accountError } = await supabase
    .from('accounts')
    .upsert(accountToUpsert)
    .select()
    .single();

  if (accountError || !savedAccount) throw accountError || new Error('Failed to save account.');

  const savedAccountId = savedAccount.id;

  // Delete old balance entries and insert new ones
  await supabase.from('balance_entries').delete().eq('account_id', savedAccountId);

  if (balanceEntries && balanceEntries.length > 0) {
    const entriesToInsert = balanceEntries.map(({ id: entryId, ...entry }) => ({
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
    .select('*, balance_entries(*)')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) throw error;

  return data.map(account => ({
    ...account,
    createdAt: account.created_at,
    balanceEntries: (account.balance_entries as any[] || []),
  })) as Account[];
}

export async function deleteAccount(accountId: string): Promise<void> {
  const userId = await getUserId();
  // RLS and cascade delete on the DB should handle deleting related balance_entries
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);
        
  if (error) throw error;
}

// --- Daily Record and Payments Received Functions ---

export async function getDailyRecord(date: string): Promise<DailyRecord | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  
  const { data: payments, error: paymentsError } = await supabase
    .from('payments_received')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date);
    
  if (paymentsError) throw paymentsError;

  return {
    date: data.date,
    user_id: data.user_id,
    bankReconciliation: (data.bank_reconciliation as any) || [],
    paymentsReceived: payments || [],
  };
}

export async function saveDailyRecord(record: DailyRecord): Promise<void> {
  const userId = await getUserId();
  const { date, bankReconciliation, paymentsReceived } = record;

  // Upsert the main daily record
  const { error: dailyRecordError } = await supabase
    .from('daily_records')
    .upsert({
      date,
      user_id: userId,
      bank_reconciliation: bankReconciliation as any,
    }, { onConflict: 'date, user_id' });

  if (dailyRecordError) throw dailyRecordError;

  // We don't need to save payments received here as they are saved individually
}

export async function addPaymentReceived(payment: Omit<PaymentReceived, 'id' | 'user_id' | 'created_at'>): Promise<PaymentReceived> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('payments_received')
    .insert({ ...payment, user_id: userId })
    .select()
    .single();

  if (error || !data) throw error || new Error('Failed to add payment.');
  return data as PaymentReceived;
}

export async function deletePaymentReceived(paymentId: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('payments_received')
    .delete()
    .eq('id', paymentId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getPaymentsForAccount(accountId: string): Promise<PaymentReceived[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('payments_received')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId);
    
  if (error) throw error;
  return data as PaymentReceived[];
}
