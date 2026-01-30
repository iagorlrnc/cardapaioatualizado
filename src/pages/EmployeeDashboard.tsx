import { useState, useEffect } from "react";
import { LogOut, ChevronDown, Trash2, Lock, Unlock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, Order } from "../lib/supabase";
import { toast } from "react-toastify";

const formatOrderNumericId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  if (hash < 100) hash += 100;
  return String(hash).padStart(3, "0");
};

const getPaymentMethodLabel = (paymentMethod: string) => {
  switch (paymentMethod) {
    case "pix":
      return "PIX";
    case "dinheiro":
      return "Dinheiro";
    case "cartao_credito":
      return "Cartão de Crédito";
    case "cartao_debito":
      return "Cartão de Débito";
    default:
      return paymentMethod;
  }
};

export default function EmployeeDashboard() {
  const { logout, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"orders" | "tables">("orders");
  const [allUsers, setAllUsers] = useState<
    Array<{ id: string; username: string }>
  >([]);
  const [sessionUsers, setSessionUsers] = useState<Set<string>>(new Set());

  const fetchOrders = async () => {
    try {
      // Primeiro busca os pedidos básicos
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Erro ao buscar pedidos:", ordersError);
        setOrders([]);
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Busca os usuários
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username");

      // Busca os itens de cada pedido
      const orderIds = ordersData.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, menu_items(*)")
        .in("order_id", orderIds);

      // Monta os dados completos
      const completeOrders = ordersData.map((order) => {
        const user = usersData?.find((u) => u.id === order.user_id);
        const assignedEmployee = usersData?.find(
          (u) => u.id === order.assigned_to,
        );
        const items =
          itemsData?.filter((item) => item.order_id === order.id) || [];
        return {
          ...order,
          users: user ? { username: user.username } : { username: "Cliente" },
          assignedEmployee: assignedEmployee
            ? { username: assignedEmployee.username }
            : null,
          order_items: items,
        };
      });

      setOrders(completeOrders as any[]);
      setLoading(false);
    } catch (error) {
      console.error("Erro na busca de pedidos:", error);
      setOrders([]);
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data } = await supabase
        .from("users")
        .select("id, username")
        .eq("is_admin", false)
        .eq("is_employee", false)
        .order("username");
      setAllUsers(data || []);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  };

  const loadSessionUsers = async () => {
    try {
      const { data } = await supabase
        .from("active_sessions")
        .select("username");
      const usernames = new Set(data?.map((s: any) => s.username) || []);
      setSessionUsers(usernames);
    } catch (error) {
      console.error("Erro ao buscar sessões:", error);
    }
  };

  const reserveTable = async (username: string) => {
    try {
      const user = allUsers.find((u) => u.username === username);
      if (!user) return;

      const { error } = await supabase.from("active_sessions").upsert(
        {
          user_id: user.id,
          username: user.username,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        toast.error("Erro ao reservar mesa: " + error.message);
        return;
      }

      toast.success(`Mesa ${username} reservada!`);
      loadSessionUsers();
    } catch (error) {
      console.error("Erro ao reservar mesa:", error);
      toast.error("Erro ao reservar mesa");
    }
  };

  const releaseTable = async (username: string) => {
    try {
      const user = allUsers.find((u) => u.username === username);
      if (!user) return;

      const { error } = await supabase
        .from("active_sessions")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        toast.error("Erro ao liberar mesa: " + error.message);
        return;
      }

      toast.success(`Mesa ${username} liberada!`);
      loadSessionUsers();
    } catch (error) {
      console.error("Erro ao liberar mesa:", error);
      toast.error("Erro ao liberar mesa");
    }
  };

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("active", true);

    if (data) {
      // Not needed anymore, but keeping for compatibility
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from("order_items")
      .select(
        `
        *,
        menu_items (*)
      `,
      )
      .eq("order_id", orderId);

    if (data) {
      // Not needed anymore, but keeping for compatibility
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchOrders();
    fetchAllUsers();
    loadSessionUsers();

    const interval = setInterval(() => {
      fetchOrders();
      loadSessionUsers();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleOrderClick = async (order: Order) => {
    // Not needed anymore
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      // Se o status é "preparing" ou "cancelled", marcar que esse funcionário aceitou/cancelou o pedido
      const updateData: any = { status: newStatus };

      if (
        (newStatus === "preparing" || newStatus === "cancelled") &&
        user?.id
      ) {
        // Verificar se o funcionário existe no banco antes de salvar
        const { data: employeeExists } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (employeeExists) {
          updateData.assigned_to = user.id;
        } else {
          console.warn("Funcionário não encontrado no banco de dados");
          toast.warn(
            "Aviso: Não foi possível atribuir o pedido a você. Por favor, faça login novamente.",
          );
        }
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) {
        toast.error("Erro ao atualizar pedido: " + error.message);
        return;
      }

      // Mensagens de feedback baseadas no status
      const statusMessages: Record<string, string> = {
        preparing: "Pedido aceito! Você começou a preparar.",
        ready: "Pedido pronto para entrega!",
        completed: "Pedido finalizado!",
        cancelled: "Pedido cancelado.",
      };

      const message = statusMessages[newStatus] || "Pedido atualizado!";
      toast.success(message);

      fetchOrders();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar pedido. Tente novamente.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    await supabase.from("orders").update({ hidden: true }).eq("id", orderId);
    toast.error("Pedido removido da lista!");
    fetchOrders();
  };

  const toggleUserAccordion = (username: string) => {
    const newSet = new Set(expandedUsers);
    if (newSet.has(username)) {
      newSet.delete(username);
    } else {
      newSet.add(username);
    }
    setExpandedUsers(newSet);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Aguardando",
      preparing: "Preparando",
      ready: "Pronto",
      completed: "Finalizado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Carregando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Painel de Pedidos
            </h1>
            <button
              onClick={logout}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Sair"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
          <div className="flex gap-4 border-t">
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-3 font-semibold transition ${
                activeTab === "orders"
                  ? "border-b-2 border-black text-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Pedidos
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={`px-4 py-3 font-semibold transition ${
                activeTab === "tables"
                  ? "border-b-2 border-black text-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Mesas
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {activeTab === "orders" ? (
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Pedidos</h2>
            <div className="space-y-4">
              {(() => {
                const ordersByUser = orders
                  .filter((order) => !order.hidden)
                  .reduce(
                    (acc, order) => {
                      const username = order.users?.username || "Cliente";
                      if (!acc[username]) acc[username] = [];
                      acc[username].push(order);
                      return acc;
                    },
                    {} as Record<string, typeof orders>,
                  );

                return Object.keys(ordersByUser).length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Não há pedidos no momento
                  </p>
                ) : (
                  Object.entries(ordersByUser).map(([username, userOrders]) => (
                    <div
                      key={username}
                      className="border rounded-lg bg-gray-50"
                    >
                      <button
                        onClick={() => toggleUserAccordion(username)}
                        className="w-full text-left p-4 font-bold text-lg text-black hover:bg-gray-100 transition flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          Pedidos da Mesa {username}
                          {userOrders.some((o) => o.status === "pending") && (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                              Novo
                            </span>
                          )}
                          {userOrders.every(
                            (o) => o.status === "cancelled",
                          ) && (
                            <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                              Cancelado
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 transition-transform ${expandedUsers.has(username) ? "rotate-180" : ""}`}
                        />
                      </button>
                      {expandedUsers.has(username) && (
                        <div className="p-4 space-y-4">
                          {userOrders.map((order) => (
                            <div
                              key={order.id}
                              className="border rounded-lg p-4 bg-white"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-bold text-lg text-black">
                                      Pedido da Mesa{" "}
                                      {order.users?.username || "Cliente"}
                                    </h3>
                                    {order.assigned_to &&
                                      order.assignedEmployee && (
                                        <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
                                          Atendido por:{" "}
                                          {order.assignedEmployee.username}
                                        </span>
                                      )}
                                  </div>
                                  <p className="text-gray-600">
                                    Pedido #{formatOrderNumericId(order.id)}
                                  </p>
                                  <p className="text-gray-600">
                                    {new Date(order.created_at).toLocaleString(
                                      "pt-BR",
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-black">
                                    R$ {order.total.toFixed(2)}
                                  </p>
                                  {order.status === "pending" && (
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "preparing",
                                          )
                                        }
                                        className="px-3 py-1 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition"
                                      >
                                        Aceitar
                                      </button>
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "cancelled",
                                          )
                                        }
                                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "preparing" && (
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(order.id, "ready")
                                        }
                                        className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition flex-1"
                                      >
                                        Preparando
                                      </button>
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "cancelled",
                                          )
                                        }
                                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "ready" && (
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "completed",
                                          )
                                        }
                                        className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition flex-1"
                                      >
                                        Concluído
                                      </button>
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "cancelled",
                                          )
                                        }
                                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "completed" && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm">
                                        Finalizado
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteOrder(order.id)
                                        }
                                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                                        title="Ocultar pedido"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                  {order.status === "cancelled" && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm">
                                        Cancelado
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteOrder(order.id)
                                        }
                                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                                        title="Ocultar pedido"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                {order.order_items?.map((item) => (
                                  <div
                                    key={item.id}
                                    className="text-sm text-gray-700"
                                  >
                                    <div className="flex justify-between">
                                      <span>
                                        {item.quantity}x {item.menu_items?.name}
                                      </span>
                                      <span>
                                        R${" "}
                                        {(item.price * item.quantity).toFixed(
                                          2,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Informações adicionais do pedido */}
                              {(order.payment_method || order.observations) && (
                                <div className="mt-4 space-y-2">
                                  {order.payment_method && (
                                    <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                                      <p className="text-sm text-gray-700">
                                        <strong className="text-gray-900">
                                          Forma de Pagamento:
                                        </strong>{" "}
                                        {getPaymentMethodLabel(
                                          order.payment_method,
                                        )}
                                      </p>
                                    </div>
                                  )}
                                  {order.observations && (
                                    <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                                      <p className="text-sm text-gray-700">
                                        <strong className="text-gray-900">
                                          Observação:
                                        </strong>{" "}
                                        {order.observations}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Mesas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allUsers.map((user) => {
                const isActive = sessionUsers.has(user.username);
                return (
                  <div
                    key={user.id}
                    className={`border rounded-lg p-6 ${
                      isActive
                        ? "bg-orange-50 border-orange-300"
                        : "bg-green-50 border-green-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">
                        Mesa {user.username}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          isActive
                            ? "bg-orange-500 text-white"
                            : "bg-green-500 text-white"
                        }`}
                      >
                        {isActive ? "Em uso" : "Disponível"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {isActive ? (
                        <button
                          onClick={() => releaseTable(user.username)}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <Unlock className="w-4 h-4" />
                          Liberar
                        </button>
                      ) : (
                        <button
                          onClick={() => reserveTable(user.username)}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          Reservar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
