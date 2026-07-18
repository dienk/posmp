import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface UIContextValue {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const value = useMemo<UIContextValue>(
    () => ({ sidebarOpen, toggleSidebar: () => setSidebarOpen((v) => !v), setSidebarOpen }),
    [sidebarOpen],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI harus dipakai di dalam <UIProvider>')
  return ctx
}
