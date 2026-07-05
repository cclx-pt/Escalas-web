/**
 * hooks/useAuth.jsx — sessão, papéis e fluxo OTP.
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import * as authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const u = await authService.fetchMe()
    setUser(u)
    return u
  }, [])

  useEffect(() => {
    let active = true
    authService
      .fetchMe()
      .then((u) => active && setUser(u))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const requestCode = useCallback((email) => authService.requestCode(email), [])

  const verifyCode = useCallback(async (email, code) => {
    const data = await authService.verifyCode(email, code)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      isApproved: !!user?.approved,
      isOrgAdmin: !!user?.isOrgAdmin,
      hasRole: (...roles) => !!user && (user.isOrgAdmin || roles.includes(user.role)),
      canManage: !!user && (user.isOrgAdmin || user.role === 'admin'),
      canSchedule: !!user && (user.isOrgAdmin || ['admin', 'leader'].includes(user.role)),
      requestCode,
      verifyCode,
      logout,
      refresh,
      setUser,
    }),
    [user, loading, requestCode, verifyCode, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
