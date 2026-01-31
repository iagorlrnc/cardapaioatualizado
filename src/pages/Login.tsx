import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { QRCodeReader } from "../components/QRCodeReader";
import { supabase } from "../lib/supabase";

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToEmployee: () => void;
}

interface ClientUser {
  id: string;
  username: string;
}

export default function Login({
  onSwitchToRegister,
  onSwitchToEmployee,
}: LoginProps) {
  const [username, setUsername] = useState("");
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQRReader, setShowQRReader] = useState(false);
  const [loggedInUsers, setLoggedInUsers] = useState<string[]>([]);
  const { login } = useAuth();

  useEffect(() => {
    const fetchClientUsers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("users")
          .select("id, username")
          .eq("is_admin", false)
          .eq("is_employee", false)
          .order("username", { ascending: true });

        if (fetchError) throw fetchError;
        setClientUsers(data || []);
      } catch (err) {
        console.error("Erro ao buscar usuários:", err);
      }
    };

    // Carregar usuários logados da tabela active_sessions
    const loadLoggedInUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("active_sessions")
          .select("username");

        if (error) {
          console.error("Erro na query:", error);
          throw error;
        }
        const usernames = data?.map((session: any) => session.username) || [];
        console.log("Usuários logados encontrados:", usernames);
        setLoggedInUsers(usernames);
      } catch (err) {
        console.error("Erro ao buscar sessões ativas:", err);
      }
    };

    fetchClientUsers();
    loadLoggedInUsers();

    // Atualizar a cada 5 segundos
    const interval = setInterval(loadLoggedInUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(username);

    if (!success) {
      setError("Usuário não encontrado");
      setLoading(false);
    }
  };

  const handleQRCodeDetected = async (qrData: string) => {
    try {
      // Tenta interpretar como QR code de usuário (formato direto: username ou UUID)
      // Primeiro, tenta procurar pelo qr_code fixo na tabela de usuários
      const { data: userByQR } = await supabase
        .from("users")
        .select("username, is_admin, is_employee")
        .eq("qr_code", qrData)
        .eq("is_admin", false)
        .eq("is_employee", false)
        .single();

      if (userByQR) {
        // QR code de usuário válido
        handleQRLogin(userByQR.username);
        return;
      }

      // Se não encontrou, tenta como dados de carrinho
      const data = JSON.parse(qrData);
      if (data.table) {
        handleQRLogin(data.table);
      } else {
        setError("QR code inválido. Tente novamente.");
        setShowQRReader(false);
      }
    } catch {
      setError("Erro ao processar QR code");
      setShowQRReader(false);
    }
  };

  const handleQRLogin = async (table: string) => {
    setError("");
    setLoading(true);
    const success = await login(table, undefined, false, true); // isQRLogin = true

    if (!success) {
      setError("Erro ao acessar com QR code");
      setLoading(false);
    }
    setShowQRReader(false);
  };

  return (
    <div className="min-h-screen bg-[url('/assets/.jpg')] bg-cover bg-center flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="mb-6 flex flex-col items-center">
            <img
              src="/assets/.jpg"
              className="w-24 h-24 object-cover rounded-full mb-2"
            />
            <h1 className="text-4xl font-bold text-[#aa341c] mb-2 text-center">
              Nome
            </h1>
          </div>
          <h2 className="text-2xl font-bold text-center mb-6 text-[#aa341c]">
            Cardápio
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selecione sua Mesa
              </label>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#aa341c] focus:border-transparent outline-none transition bg-white"
                required
              >
                <option value="">-- Escolha uma mesa --</option>
                {clientUsers.map((user) => (
                  <option
                    key={user.id}
                    value={user.username}
                    disabled={loggedInUsers.includes(user.username)}
                  >
                    Mesa {user.username}
                    {loggedInUsers.includes(user.username) ? " (Em uso)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#aa341c] text-white py-3 rounded-lg font-semibold hover:bg-[#8f2e18] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => setShowQRReader(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              Ler QR Code
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToEmployee}
              className="block w-full text-sm text-gray-600 hover:text-[#aa341c] transition mb-3"
            >
              Acesso Funcionário{" "}
              <span className="font-semibold">Login Funcionário</span>
            </button>

            <button
              onClick={onSwitchToRegister}
              className="text-sm text-gray-600 hover:text-[#aa341c] transition"
            >
              Acesso Administrador{" "}
              <span className="font-semibold">Login Admin</span>
            </button>
          </div>
        </div>
      </div>

      {showQRReader && (
        <QRCodeReader
          onQRCodeDetected={handleQRCodeDetected}
          onClose={() => setShowQRReader(false)}
        />
      )}
    </div>
  );
}
