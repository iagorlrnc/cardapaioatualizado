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

  useEffect(() => {
    const storedUser = localStorage.getItem("allblack_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

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
      return true;
    } catch (error) {
      console.error("Login error:", error);
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
    // A sessão ativa NÃO é removida no logout do cliente
    // A mesa permanece marcada como "em uso" até que o funcionário a libere explicitamente
    setUser(null);
    localStorage.removeItem("allblack_user");
    localStorage.removeItem("app.current_user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
