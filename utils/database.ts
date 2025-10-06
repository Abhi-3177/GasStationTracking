import { supabase } from '../lib/supabase';
import { DayBookRecord, DailyRecordData, Account, BalanceEntry } from '../types/daybook';
import { format, subDays } from 'date-fns';

// Helper to get the current user ID, throws error if not logged in
const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated. Please log in.');
  }
  return user.id;
};

// Day Book functions
export async function saveRecord(record: DayBookRecord): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('day_book_records')
    .upsert({ date: record.date, user_id: userId, record: record as any });

  if (error) {
    console.error('Error saving daybook record:', error);
    throw error;
  }
}

export async function getRecord(date: string): Promise<DayBookRecord | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('day_book_records')
    .select('record')
    .eq('date', date)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: "object not found"
    console.error('Error getting daybook record:', error);
    return null;
  }

  return data ? (data.record as DayBookRecord) : null;
}

export async function getPreviousRecord(currentDate: string): Promise<DayBookRecord | null> {
  const previousDate = format(subDays(new Date(currentDate), 1), 'yyyy-MM-dd');
  // This function automatically uses the user-scoped getRecord
  return getRecord(previousDate);
}

export async function getAllRecords(): Promise<DayBookRecord[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('day_book_records')
    .select('record')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error getting all daybook records:', error);
    return [];
  }

  return data.map(item => item.record as DayBookRecord);
}

export async function deleteRecord(date: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('day_book_records')
    .delete()
    .eq('date', date)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting daybook record:', error);
    throw error;
  }
}

// Daily Record functions
export async function saveDailyRecord(record: DailyRecordData): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('daily_records')
    .upsert({ date: record.date, user_id: userId, record: record as any });

  if (error) {
    console.error('Error saving daily record:', error);
    throw error;
  }
}

export async function getDailyRecord(date: string): Promise<DailyRecordData | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('daily_records')
    .select('record')
    .eq('date', date)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting daily record:', error);
    return null;
  }

  return data ? (data.record as DailyRecordData) : null;
}

export async function getAllDailyRecords(): Promise<DailyRecordData[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('daily_records')
      .select('record')
      .eq('user_id', userId)
      .order('date', { ascending: false });
  
    if (error) {
      console.error('Error getting all daily records:', error);
      return [];
    }
  
    return data.map(item => item.record as DailyRecordData);
}

export async function deleteDailyRecord(date: string): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase
        .from('daily_records')
        .delete()
        .eq('date', date)
        .eq('user_id', userId);

    if (error) {
        console.error('Error deleting daily record:', error);
        throw error;
    }
}

// Account functions
export async function saveAccount(account: Account): Promise<void> {
  const userId = await getUserId();
  const { balanceEntries, ...accountToSave } = account;

  const { error: accountError } = await supabase.from('accounts').upsert({
    ...accountToSave,
    user_id: userId,
  });

  if (accountError) {
    console.error('Error saving account:', accountError);
    throw accountError;
  }

  // Delete old entries and insert new ones for the current user
  const { error: deleteError } = await supabase.from('balance_entries')
    .delete()
    .eq('account_id', account.id)
    .eq('user_id', userId);
    
  if (deleteError) {
    console.error('Error deleting old balance entries:', deleteError);
    throw deleteError;
  }

  if (balanceEntries && balanceEntries.length > 0) {
    const entriesToInsert = balanceEntries.map(({ id, ...entry }) => ({
      ...entry,
      account_id: account.id,
      user_id: userId,
    }));
    const { error: insertError } = await supabase.from('balance_entries').insert(entriesToInsert);
    if (insertError) {
      console.error('Error inserting new balance entries:', insertError);
      throw insertError;
    }
  }
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('accounts')
    .select('*, balance_entries(*)')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error getting account:', error);
    return null;
  }
  
  return data ? { ...data, balanceEntries: data.balance_entries as BalanceEntry[] } as Account : null;
}

export async function getAllAccounts(): Promise<Account[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('accounts')
    .select('*, balance_entries(*)')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    console.error('Error getting all accounts:', error);
    return [];
  }

  return data.map(account => ({
    ...account,
    balanceEntries: account.balance_entries || [],
  })) as Account[];
}

export async function deleteAccount(accountId: string): Promise<void> {
  const userId = await getUserId();
  // RLS policy will prevent deleting if user_id doesn't match
  const { error } = await supabase.from('accounts').delete().eq('id', accountId).eq('user_id', userId);
  if (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}
