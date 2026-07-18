import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadSettings } from './settings'

interface SettingsContextValue {
  settings: Record<string, string>
  reloadSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>(() => loadSettings())
  const value = useMemo<SettingsContextValue>(
    () => ({ settings, reloadSettings: () => setSettings(loadSettings()) }),
    [settings],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings harus dipakai di dalam <SettingsProvider>')
  return ctx
}
