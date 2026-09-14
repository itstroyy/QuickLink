'use client'

import { createContext, useContext, useEffect } from 'react'

type SaveHandler = () => Promise<void>
const EditorSaveContext = createContext<((handler: SaveHandler | null) => void) | null>(null)

export function EditorSaveProvider({ register, children }: { register: (handler: SaveHandler | null) => void; children: React.ReactNode }) {
  return <EditorSaveContext.Provider value={register}>{children}</EditorSaveContext.Provider>
}

export function useEditorSave(handler: SaveHandler) {
  const register = useContext(EditorSaveContext)
  useEffect(() => {
    if (!register) return
    register(handler)
    return () => register(null)
  }, [handler, register])
  return Boolean(register)
}
