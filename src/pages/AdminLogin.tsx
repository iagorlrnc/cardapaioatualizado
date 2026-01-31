import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";

interface AdminLoginProps {
  onSwitchToLogin: () => void;
  onSwitchToEmployee: () => void;
}

type UserType = "admin" | "employee";

const generateSlug = (value: string) => {
  const base = value
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
};

export default function AdminLogin({
  onSwitchToLogin,
  onSwitchToEmployee,
}: AdminLoginProps) {
  const [showRegister, setShowRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Register state
  const [userType, setUserType] = useState<UserType>("admin");
  const [regUsername, setRegUsername] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [adminAuthUsername, setAdminAuthUsername] = useState("");
  const [adminAuthPassword, setAdminAuthPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(username, password);

    if (!success) {
      setError("Credenciais inválidas");
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    // Validações básicas
    if (!regUsername.trim()) {
      setRegError("Nome de usuário é obrigatório");
      return;
    }

    // Para admin e funcionário, validar campos adicionais
    if (!regPhone.trim()) {
      setRegError("Telefone é obrigatório");
      return;
    }

    if (regPassword.length < 6) {
      setRegError("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError("As senhas não coincidem");
      return;
    }

    if (!adminAuthUsername.trim() || !adminAuthPassword.trim()) {
      setRegError("Autenticação de admin é obrigatória");
      return;
    }

    setRegLoading(true);

    try {
      // Verificar se o admin existe e tem a senha correta
      const { data: adminUser } = await supabase
        .from("users")
        .select("*")
        .eq("username", adminAuthUsername)
        .eq("is_admin", true)
        .maybeSingle();

      if (!adminUser || adminUser.password_hash !== adminAuthPassword) {
        setRegError("Credenciais de administrador inválidas");
        setRegLoading(false);
        return;
      }

      // Verificar se o nome de usuário já existe
      const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("username", regUsername)
        .maybeSingle();

      if (existingUser) {
        setRegError("Nome de usuário já existe");
        setRegLoading(false);
        return;
      }

      // Preparar dados do novo usuário
      const newUserData: any = {
        username: regUsername,
        password_hash: regPassword,
        slug: generateSlug(regUsername),
        is_admin: userType === "admin",
        is_employee: userType === "employee",
      };

      newUserData.phone = regPhone;

      // Criar novo usuário
      const { error: insertError } = await supabase
        .from("users")
        .insert(newUserData);

      if (insertError) {
        setRegError(`Erro ao criar usuário: ${insertError.message}`);
        setRegLoading(false);
        return;
      }

      const userTypeLabel =
        userType === "admin" ? "Administrador" : "Funcionário";

      toast.success(
        `${userTypeLabel} criado com sucesso! Faça login para continuar.`,
      );

      // Limpar formulário e voltar para login
      setRegUsername("");
      setRegPhone("");
      setRegPassword("");
      setRegConfirmPassword("");
      setAdminAuthUsername("");
      setAdminAuthPassword("");
      setUserType("admin");
      setShowRegister(false);
    } catch (error) {
      console.error("Erro ao registrar usuário:", error);
      setRegError("Erro ao criar usuário");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <img src="/assets/.png" className="w-16 h-16 object-contain mb-2" />
          <h1 className="text-4xl font-bold text-white mb-2 text-center">
            Nome
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-2xl p-8">
          {!showRegister ? (
            <>
              <h2 className="text-2xl font-bold text-center mb-6 text-black">
                Login Administrador
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setShowRegister(true)}
                  className="w-full text-sm text-white bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition font-semibold"
                >
                  Cadastro
                </button>

                <div className="text-center space-y-3">
                  <button
                    onClick={onSwitchToEmployee}
                    className="block w-full text-sm text-gray-600 hover:text-black transition"
                  >
                    Acesso Funcionário{" "}
                    <span className="font-semibold">Login Funcionário</span>
                  </button>

                  <button
                    onClick={onSwitchToLogin}
                    className="text-sm text-gray-600 hover:text-black transition"
                  >
                    Voltar ao <span className="font-semibold">Login</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mb-6 text-black">
                Cadastro
              </h2>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Usuário
                  </label>
                  <select
                    value={userType}
                    onChange={(e) => {
                      setUserType(e.target.value as UserType);
                      setRegUsername("");
                      setRegPhone("");
                      setRegPassword("");
                      setRegConfirmPassword("");
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition bg-white"
                  >
                    <option value="admin">Administrador</option>
                    <option value="employee">Funcionário</option>
                  </select>
                </div>

                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome de Usuário
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Senha
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar Senha
                    </label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Autenticação de Administrador
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Apenas administradores existentes podem criar novas contas.
                  </p>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome de Usuário do Admin
                    </label>
                    <input
                      type="text"
                      value={adminAuthUsername}
                      onChange={(e) => setAdminAuthUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Senha do Admin
                    </label>
                    <input
                      type="password"
                      value={adminAuthPassword}
                      onChange={(e) => setAdminAuthPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </div>

                {regError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                    {regError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regLoading ? "Cadastrando..." : "Cadastrar"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-sm text-gray-600 hover:text-black transition"
                >
                  Voltar ao <span className="font-semibold">Login</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
