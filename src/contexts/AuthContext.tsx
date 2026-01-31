import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase, User } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    username: string,
    password?: string,
    isEmployee?: boolean,
    isQRLogin?: boolean,
  ) => Promise<boolean>;
  loginBySlug: (slug: string, isQRLogin?: boolean) => Promise<boolean>;
  register: (
    username: string,
    phone: string,
    password: string,
    adminUsername: string,
    adminPassword: string,
  ) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutTimer, setLogoutTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("allblack_user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Se é um cliente (customer), inicia o timer de auto-logout
      if (!parsedUser.is_admin && !parsedUser.is_employee) {
        startAutoLogoutTimer();
      }
    }
    setLoading(false);
  }, []);

  const startAutoLogoutTimer = () => {
    // Limpar timer anterior se existir
    if (logoutTimer) {
      clearTimeout(logoutTimer);
    }
    // Inicia novo timer para 10 minutos (600000ms)
    const timer = setTimeout(() => {
      logout();
    }, 600000); // 10 minutos
    setLogoutTimer(timer);
  };

  const login = async (
    username: string,
    password?: string,
    isEmployee: boolean = false,
    isQRLogin: boolean = false,
  ): Promise<boolean> => {
    try {
      let query = supabase.from("users").select("*").eq("username", username);

      if (isEmployee) {
        // Employee login - precisa verificar senha E is_employee
        query = query.eq("is_employee", true).eq("is_admin", false);
      } else if (password) {
        // Admin login - precisa verificar senha E is_admin
        query = query.eq("is_admin", true);
      } else {
        // Customer login - não precisa de senha
        query = query.eq("is_admin", false).eq("is_employee", false);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        return false;
      }

      // Se precisa verificar senha (Admin ou Employee), verificar aqui
      if ((isEmployee || password) && data.password_hash !== password) {
        return false;
      }

      const userData: User = {
        id: data.id,
        username: data.username,
        phone: data.phone,
        is_admin: data.is_admin,
        is_employee: data.is_employee,
        slug: data.slug,
      };

      // Registrar sessão ativa
      try {
        const { error: sessionError } = await supabase
          .from("active_sessions")
          .upsert(
            {
              user_id: data.id,
              username: data.username,
              login_at: new Date().toISOString(),
              last_activity: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        if (sessionError) {
          console.error("Erro ao registrar sessão:", sessionError);
        } else {
          console.log(
            `Sessão registrada para: ${data.username}${isQRLogin ? " (via QR Code)" : ""}`,
          );
        }
      } catch (sessionError) {
        console.error("Erro ao registrar sessão:", sessionError);
      }

      setUser(userData);
      localStorage.setItem("allblack_user", JSON.stringify(userData));
      localStorage.setItem("app.current_user", username);

      // Se é um cliente (customer), inicia o timer de auto-logout
      if (!userData.is_admin && !userData.is_employee) {
        startAutoLogoutTimer();
      }

      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const loginBySlug = async (
    slug: string,
    isQRLogin: boolean = true,
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("slug", slug)
        .eq("is_admin", false)
        .eq("is_employee", false)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      const userData: User = {
        id: data.id,
        username: data.username,
        phone: data.phone,
        is_admin: data.is_admin,
        is_employee: data.is_employee,
        slug: data.slug,
      };

      try {
        const { error: sessionError } = await supabase
          .from("active_sessions")
          .upsert(
            {
              user_id: data.id,
              username: data.username,
              login_at: new Date().toISOString(),
              last_activity: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        if (sessionError) {
          console.error("Erro ao registrar sessão:", sessionError);
        } else {
          console.log(
            `Sessão registrada para: ${data.username}${isQRLogin ? " (via QR Code)" : ""}`,
          );
        }
      } catch (sessionError) {
        console.error("Erro ao registrar sessão:", sessionError);
      }

      setUser(userData);
      localStorage.setItem("allblack_user", JSON.stringify(userData));
      localStorage.setItem("app.current_user", data.username);

      // Se é um cliente (customer), inicia o timer de auto-logout
      if (!userData.is_admin && !userData.is_employee) {
        startAutoLogoutTimer();
      }

      return true;
    } catch (error) {
      console.error("Login by slug error:", error);
      return false;
    }
  };

  const register = async (
    username: string,
    phone: string,
    password: string,
    adminUsername: string,
    adminPassword: string,
  ): Promise<boolean> => {
    try {
      // Primeiro, verificar se o admin existe e tem a senha correta
      const { data: adminUser } = await supabase
        .from("users")
        .select("*")
        .eq("username", adminUsername)
        .eq("is_admin", true)
        .maybeSingle();

      if (!adminUser || adminUser.password_hash !== adminPassword) {
        return false; // Admin não encontrado ou senha incorreta
      }

      // Verificar se o nome de usuário já existe
      const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        return false;
      }

      const { error } = await supabase.from("users").insert({
        username,
        phone,
        password_hash: password,
        slug: (() => {
          const base = username
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
          const suffix =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID().slice(0, 8)
              : Math.random().toString(36).slice(2, 10);
          return base ? `${base}-${suffix}` : suffix;
        })(),
        is_admin: false,
      });

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Registration error:", error);
      return false;
    }
  };

  const logout = () => {
    // Limpar timer de auto-logout
    if (logoutTimer) {
      clearTimeout(logoutTimer);
      setLogoutTimer(null);
    }
    // A sessão ativa NÃO é removida no logout do cliente
    // A mesa permanece marcada como "em uso" até que o funcionário a libere explicitamente
    setUser(null);
    localStorage.removeItem("allblack_user");
    localStorage.removeItem("app.current_user");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginBySlug, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
