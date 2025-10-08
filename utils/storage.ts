import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayBookRecord, Account } from '../types/daybook';
import { format, subDays } from 'date-fns';

const STORAGE_PREFIX = 'daybook_';
const ACCOUNT_PREFIX = 'account_';
const ACCOUNTS_LIST_KEY = 'accounts_list';

export function getStorageKey(date: string): string {
  return `${STORAGE_PREFIX}${date}`;
}

export function getAccountKey(accountId: string): string {
  return `${ACCOUNT_PREFIX}${accountId}`;
}

// Day Book functions
export async function saveRecord(record: DayBookRecord): Promise<void> {
  const key = getStorageKey(record.date);
  await AsyncStorage.setItem(key, JSON.stringify(record));
}

export async function getRecord(date: string): Promise<DayBookRecord | null> {
  try {
    const key = getStorageKey(date);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting record:', error);
    return null;
  }
}

export async function getPreviousRecord(currentDate: string): Promise<DayBookRecord | null> {
  const previousDate = format(subDays(new Date(currentDate), 1), 'yyyy-MM-dd');
  return getRecord(previousDate);
}

export async function getAllRecords(): Promise<DayBookRecord[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const dayBookKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    const records: DayBookRecord[] = [];
    for (const key of dayBookKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        records.push(JSON.parse(data));
      }
    }
    
    return records;
  } catch (error) {
    console.error('Error getting all records:', error);
    return [];
  }
}

export async function deleteRecord(date: string): Promise<void> {
  const key = getStorageKey(date);
  await AsyncStorage.removeItem(key);
}

// Account functions
export async function saveAccount(account: Account): Promise<void> {
  const key = getAccountKey(account.id);
  await AsyncStorage.setItem(key, JSON.stringify(account));
  
  // Update accounts list
  const accountsList = await getAllAccounts();
  const existingIndex = accountsList.findIndex(a => a.id === account.id);
  
  if (existingIndex >= 0) {
    accountsList[existingIndex] = account;
  } else {
    accountsList.push(account);
  }
  
  await AsyncStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(accountsList.map(a => a.id)));
}

export async function getAccount(accountId: string): Promise<Account | null> {
  try {
    const key = getAccountKey(accountId);
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting account:', error);
    return null;
  }
}

export async function getAllAccounts(): Promise<Account[]> {
  try {
    const accountsListData = await AsyncStorage.getItem(ACCOUNTS_LIST_KEY);
    const accountIds: string[] = accountsListData ? JSON.parse(accountsListData) : [];
    
    const accounts: Account[] = [];
    for (const accountId of accountIds) {
      const account = await getAccount(accountId);
      if (account) {
        accounts.push(account);
      }
    }
    
    return accounts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error getting all accounts:', error);
    return [];
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  const key = getAccountKey(accountId);
  await AsyncStorage.removeItem(key);
  
  // Update accounts list
  const accountsListData = await AsyncStorage.getItem(ACCOUNTS_LIST_KEY);
  const accountIds: string[] = accountsListData ? JSON.parse(accountsListData) : [];
  const updatedIds = accountIds.filter(id => id !== accountId);
  await AsyncStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(updatedIds));
}
