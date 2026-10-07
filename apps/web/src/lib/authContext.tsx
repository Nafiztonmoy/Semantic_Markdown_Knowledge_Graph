"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setStoredToken } from "./api";
interface User {
  id: string;
  email: string;
  display_name: string;
  status: string;
}
interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {}
});
export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshUser = async () => {
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  };
  const logout = async () => {
    await api.logout();
    setUser(null);
  };
  useEffect(() => {
    refreshUser();
  }, []);
  return <AuthContext.Provider value={{
    user,
    loading,
    refreshUser,
    logout
  }}>
      {children}
    </AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
