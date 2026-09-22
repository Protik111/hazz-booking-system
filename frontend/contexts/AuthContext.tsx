"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from "@/lib/api/endpoints";
import { setSessionExpiredHandler } from "@/lib/api/client";
import { useToast } from "@/contexts/ToastContext";
import type { User } from "@/lib/api/normalize";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth is cookie-based: the NestJS backend sets HttpOnly JWT cookies on
 * POST /auth/login. We don't store the token ourselves — the browser sends
 * it automatically on every request thanks to `credentials: "include"` in
 * the API client. On mount we call GET /auth/me to restore the session.
 *
 * The API client silently refreshes expired access tokens via
 * POST /auth/refresh on 401. If that refresh also fails, the client calls
 * the handler registered below to flip us into the "unauthenticated" state
 * and show a toast.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const toast = useToast();

  // Stable handler so the API client can call us back when a silent refresh
  // fails. Avoids importing React context into the client module.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
      toast.info({
        title: "Session expired",
        description: "Please log in again to continue.",
      });
    });
    return () => setSessionExpiredHandler(null);
  }, [toast]);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await apiLogin(email, password);
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const register = useCallback(
    async (name: string, email: string, phone: string, password: string) => {
      await apiRegister({ name, email, phone, password });
      // After registration, auto-login (the register endpoint does not set cookies)
      const me = await apiLogin(email, password);
      setUser(me);
      setStatus("authenticated");
      return me;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // If the server is unreachable we still clear local state.
    }
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
