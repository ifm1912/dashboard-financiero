'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

// Presets disponibles
export type DateRangePreset = '7d' | '30d' | '90d' | '12m' | 'all';

// Rango de fechas calculado
export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

// Contexto completo
interface DateRangeContextType {
  preset: DateRangePreset;
  setPreset: (preset: DateRangePreset) => void;
  dateRange: DateRange;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

// Calcula startDate y endDate basado en el preset
function calculateDateRange(preset: DateRangePreset): DateRange {
  if (preset === 'all') {
    return { startDate: null, endDate: null };
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  switch (preset) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '12m':
      startDate.setMonth(startDate.getMonth() - 12);
      break;
  }

  return { startDate, endDate };
}

interface DateRangeProviderProps {
  children: ReactNode;
}

export function DateRangeProvider({ children }: DateRangeProviderProps) {
  const [preset, setPreset] = useState<DateRangePreset>('all');

  const dateRange = useMemo(() => calculateDateRange(preset), [preset]);

  const value = useMemo(
    () => ({ preset, setPreset, dateRange }),
    [preset, dateRange]
  );

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextType {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
}
