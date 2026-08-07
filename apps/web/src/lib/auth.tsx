import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, setUnauthorizedHandler, tokens } from "./api/client";
import { authApi } from "./api/endpoints";
import type { AuthUser } from "./api/types";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        tokens.clear();
        setUser(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    void refreshUser();
    return () => setUnauthorizedHandler(null);
  }, [refreshUser]);

  const setSession = useCallback(
    (accessToken: string, refreshToken: string, nextUser: AuthUser) => {
      tokens.set(accessToken, refreshToken);
      setUser(nextUser);
      setLoading(false);
    },
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      refreshUser,
      setSession,
      signOut,
    }),
    [user, loading, refreshUser, setSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}

export function canCreateReservations(user: AuthUser | null): boolean {
  return user?.status === "active" && (user.role === "usuario" || user.role === "gerencia");
}

export function canCancel(user: AuthUser | null, organizerId: string): boolean {
  if (!user || user.status !== "active") return false;
  if (user.role === "gerencia") return true;
  return user.role === "usuario" && user.id === organizerId;
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}
