import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DataMode = "real" | "simulated" | "comparison";

type Ctx = {
  mode: DataMode;
  setMode: (m: DataMode) => void;
};

const DataModeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "spheremaxxing.dataMode";

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataMode>("simulated");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as DataMode | null;
    if (saved === "real" || saved === "simulated" || saved === "comparison") setMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return <DataModeContext.Provider value={{ mode, setMode }}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be used inside DataModeProvider");
  return ctx;
}
