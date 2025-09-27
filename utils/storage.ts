import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayBookRecord } from '../types/daybook';
import { format, subDays } from 'date-fns';

const STORAGE_PREFIX = 'daybook_';

export function getStorageKey(date: string): string {
  return `${STORAGE_PREFIX}${date}`;
}

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
