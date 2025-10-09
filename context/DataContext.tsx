import React, { createContext, useState, useContext, PropsWithChildren, useCallback } from 'react';

interface DataContextType {
  dataVersion: number;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: PropsWithChildren) {
  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = useCallback(() => {
    setDataVersion(prevVersion => prevVersion + 1);
  }, []);

  const value = { dataVersion, refreshData };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
