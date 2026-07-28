

import { createContext, useContext, useState } from "react";

type DateFilterContextType = {
  fromDate: string;
  toDate: string;
  setFromDate: (d: string) => void;
  setToDate: (d: string) => void;
};

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  return (
    <DateFilterContext.Provider value={{ fromDate, toDate, setFromDate, setToDate }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return ctx;
}
