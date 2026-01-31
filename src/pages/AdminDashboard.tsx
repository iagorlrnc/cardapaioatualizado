import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Users,
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  X,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, MenuItem, Order, OrderItem, User } from "../lib/supabase";
import { toast } from "react-toastify";
import jsPDF from "jspdf";

type TabType =
  | "dashboard"
  | "menu"
  | "deactivated"
  | "orders"
  | "users"
  | "performance";

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

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const formatOrderNumericId = (id: string) => {
  // deterministic hash to 3-digit numeric id (100-999)
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  if (hash < 100) hash += 100;
  return String(hash).padStart(3, "0");
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<
    (Order & { order_items?: OrderItem[]; users?: { username: string } })[]
  >([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    category: "hamburguer",
    newCategory: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [showUserModal, setShowUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: "",
    phone: "",
    password: "",
    is_admin: false,
    is_employee: false,
  });
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [employeePerformance, setEmployeePerformance] = useState<
    Array<{
      userId: string;
      username: string;
      totalOrders: number;
      totalRevenue: number;
      completedOrders: number;
      cancelledOrders: number;
      averageOrderValue: number;
    }>
  >([]);
  const [selectedEmployeeCancelledOrders, setSelectedEmployeeCancelledOrders] =
    useState<any[]>([]);
  const [selectedEmployeeForCancelled, setSelectedEmployeeForCancelled] =
    useState<string | null>(null);
  const [showAllRecentOrders, setShowAllRecentOrders] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchMenuItems();
    fetchOrders();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "orders" || activeTab === "dashboard") {
      const interval = setInterval(() => {
        fetchOrders();
      }, 3000); // Atualizar pedidos a cada 3 segundos

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "performance") {
      calculateEmployeePerformance();

      // Atualizar performance a cada 3 segundos
      const interval = setInterval(() => {
        calculateEmployeePerformance();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setMenuItems(data);
      setCategories([...new Set(data.map((item) => item.category))]);
    }
  };

  const fetchOrders = async () => {
    try {
      // Buscar pedidos básicos
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersError || !ordersData) {
        console.error("Erro ao buscar pedidos:", ordersError);
        setOrders([]);
        return;
      }

      // Buscar usuários
      const { data: usersData } = await supabase
        .from("users")
        .select("id, username");

      // Buscar itens de cada pedido
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, menu_items(*)");

      // Montar dados completos
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
          assigned_employee: assignedEmployee
            ? { username: assignedEmployee.username }
            : null,
          order_items: items,
        };
      });

      setOrders(completeOrders as any[]);
    } catch (error) {
      console.error("Erro na busca de pedidos:", error);
      setOrders([]);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUsers(data);
  };

  const calculateEmployeePerformance = async () => {
    // Buscar todos os funcionários
    const { data: employees } = await supabase
      .from("users")
      .select("*")
      .eq("is_employee", true);

    if (!employees) return;

    // Calcular performance de cada funcionário
    const performance = await Promise.all(
      employees.map(async (employee) => {
        // Buscar todos os pedidos onde esse funcionário foi atribuído
        // e que estão em status "ready", "completed" ou "cancelled"
        const { data: employeeOrders } = await supabase
          .from("orders")
          .select("*")
          .eq("assigned_to", employee.id)
          .neq("status", "pending")
          .neq("status", "preparing");

        const totalOrders =
          employeeOrders?.filter((o) => o.status !== "cancelled").length || 0;
        const completedOrders =
          employeeOrders?.filter((o) => o.status === "completed").length || 0;
        const cancelledOrders =
          employeeOrders?.filter((o) => o.status === "cancelled").length || 0;
        const totalRevenue =
          employeeOrders
            ?.filter((o) => o.status === "completed")
            .reduce((sum, order) => sum + order.total, 0) || 0;
        const averageOrderValue =
          completedOrders > 0 ? totalRevenue / completedOrders : 0;

        return {
          userId: employee.id,
          username: employee.username,
          totalOrders,
          completedOrders,
          cancelledOrders,
          totalRevenue,
          averageOrderValue,
        };
      }),
    );

    setEmployeePerformance(
      performance.sort((a, b) => b.totalRevenue - a.totalRevenue),
    );
  };

  const handleViewCancelledOrders = async (employeeId: string) => {
    setSelectedEmployeeForCancelled(employeeId);

    // Buscar pedidos cancelados deste funcionário
    const { data: cancelledOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_to", employeeId)
      .eq("status", "cancelled")
      .order("created_at", { ascending: false });

    setSelectedEmployeeCancelledOrders(cancelledOrders || []);
  };

  const generateDailyReport = async () => {
    setGeneratingReport(true);
    try {
      // Pegar data de hoje
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
      );

      // Buscar pedidos do dia com status concluído para calcular estatísticas
      const { data: dailyOrders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (ordersError || !dailyOrders) {
        console.error("Erro ao buscar pedidos:", ordersError);
        toast.error("Erro ao buscar pedidos");
        setGeneratingReport(false);
        return;
      }

      // Buscar itens dos pedidos para calcular top 5 vendidos
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("*, menu_items(name)")
        .in(
          "order_id",
          dailyOrders.map((o) => o.id),
        );

      // Calcular estatísticas
      const totalOrders = dailyOrders.length;
      const totalRevenue = dailyOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      );
      // Valores não usados neste novo relatório, mas mantidos para referência
      // const completedOrders = dailyOrders.filter(
      //   (o) => o.status === "completed",
      // ).length;
      // const cancelledOrders = dailyOrders.filter(
      //   (o) => o.status === "cancelled",
      // ).length;

      // Calcular top 5 itens mais vendidos
      const itemSalesMap = new Map<
        string,
        { quantity: number; name: string }
      >();
      orderItems?.forEach((item) => {
        const name =
          (item.menu_items as { name: string })?.name || "Item desconhecido";
        const current = itemSalesMap.get(name) || { quantity: 0, name };
        current.quantity += item.quantity;
        itemSalesMap.set(name, current);
      });

      const topItems = Array.from(itemSalesMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Calcular formas de pagamento com valor total
      const paymentMethodsData = new Map<
        string,
        { count: number; total: number }
      >();
      dailyOrders.forEach((order) => {
        const method = order.payment_method || "Não informado";
        const current = paymentMethodsData.get(method) || {
          count: 0,
          total: 0,
        };
        current.count += 1;
        current.total += order.total || 0;
        paymentMethodsData.set(method, current);
      });

      // Buscar informações detalhadas de funcionários
      const { data: employees } = await supabase
        .from("users")
        .select("id, username")
        .eq("is_employee", true);

      const employeePerformanceMap = new Map<
        string,
        {
          username: string;
          completedOrders: number;
          cancelledOrders: number;
          totalRevenue: number;
        }
      >();

      if (employees) {
        employees.forEach((emp) => {
          employeePerformanceMap.set(emp.id, {
            username: emp.username,
            completedOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
          });
        });

        // Calcular performance de cada funcionário
        dailyOrders.forEach((order) => {
          if (
            order.assigned_to &&
            employeePerformanceMap.has(order.assigned_to)
          ) {
            const perf = employeePerformanceMap.get(order.assigned_to)!;
            if (order.status === "completed") {
              perf.completedOrders += 1;
              perf.totalRevenue += order.total || 0;
            } else if (order.status === "cancelled") {
              perf.cancelledOrders += 1;
            }
          }
        });
      }

      // Criar PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // ========== CABEÇALHO ==========
      // Foto centralizada e redonda
      const imgWidth = 15;
      const imgHeight = 15;
      const xCenter = pageWidth / 2 - imgWidth / 2;

      // Função para criar imagem redonda
      const createCircleImage = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const size = 300;
          canvas.width = size;
          canvas.height = size;

          // Carregar imagem
          const img = new Image();
          img.crossOrigin = "anonymous";

          return new Promise<string>((resolve) => {
            img.onload = () => {
              // Desenhar círculo branco de fundo
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, size, size);

              // Criar clipping circle
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
              ctx.clip();

              // Desenhar imagem
              ctx.drawImage(img, 0, 0, size, size);

              // Retornar data URL
              resolve(canvas.toDataURL("image/png"));
            };

            img.onerror = () => {
              resolve(""); // Retornar vazio se falhar
            };

            img.src = "/public/assets/.jpg";
          });
        } catch (e) {
          console.warn("Erro ao criar imagem redonda:", e);
          return "";
        }
      };

      // Adicionar imagem redonda
      const circleImageData = await createCircleImage();
      if (circleImageData) {
        try {
          pdf.addImage(
            circleImageData,
            "PNG",
            xCenter,
            yPosition,
            imgWidth,
            imgHeight,
          );

          // Desenhar borda circular
          pdf.setDrawColor(170, 52, 28);
          pdf.setLineWidth(0.5);
          pdf.circle(
            xCenter + imgWidth / 2,
            yPosition + imgHeight / 2,
            imgWidth / 2,
            "S",
          );
        } catch (e) {
          console.warn("Erro ao adicionar imagem ao PDF:", e);
        }
      }

      yPosition += imgHeight + 8;

      // Subtítulo "Relatório diário" centralizado
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(21);
      pdf.setTextColor(51, 51, 51);
      pdf.text("Relatório Diário", pageWidth / 2, yPosition, {
        align: "center",
      });

      yPosition += 10;

      // Data por extenso no lado esquerdo
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(102, 102, 102);
      const dateStr = today.toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const capitalizedDateStr =
        dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      pdf.text(capitalizedDateStr, margin, yPosition);

      yPosition += 5;

      // Linha separadora
      pdf.setDrawColor(170, 52, 28);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);

      yPosition += 8;

      // ========== RESUMO GERAL ==========
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(170, 52, 28);
      pdf.text("Resumo Geral", margin, yPosition);

      yPosition += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0);

      pdf.text(`Total de Pedidos: ${totalOrders}`, margin + 3, yPosition);
      yPosition += 6;
      pdf.text(
        `Faturamento Total: R$ ${totalRevenue.toFixed(2)}`,
        margin + 3,
        yPosition,
      );

      yPosition += 10;

      // ========== TOP 5 ITENS MAIS VENDIDOS ==========
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(170, 52, 28);
      pdf.text("Itens Mais Vendidos", margin, yPosition);

      yPosition += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0);

      if (topItems.length > 0) {
        topItems.forEach((item, index) => {
          pdf.text(
            `${index + 1}. ${item.name} - ${item.quantity} unidades`,
            margin + 3,
            yPosition,
          );
          yPosition += 6;
        });
      } else {
        pdf.text("Sem vendas registradas", margin + 3, yPosition);
        yPosition += 6;
      }

      yPosition += 4;

      // ========== FORMAS DE PAGAMENTO ==========
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(170, 52, 28);
      pdf.text("Formas de Pagamento", margin, yPosition);

      yPosition += 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0);

      paymentMethodsData.forEach((data, method) => {
        const methodLabel =
          method === "pix"
            ? "PIX"
            : method === "dinheiro"
              ? "Dinheiro"
              : method === "cartao_credito"
                ? "Cartão de Crédito"
                : method === "cartao_debito"
                  ? "Cartão de Débito"
                  : method;
        pdf.text(
          `${methodLabel}: ${data.count} transações - R$ ${data.total.toFixed(2)}`,
          margin + 3,
          yPosition,
        );
        yPosition += 6;

        // Verificar se precisa de nova página
        if (yPosition > pageHeight - margin - 20) {
          pdf.addPage();
          yPosition = margin;
        }
      });

      yPosition += 4;

      // ========== PERFORMANCE DOS FUNCIONÁRIOS ==========
      if (employees && employees.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(170, 52, 28);
        pdf.text("Performance dos Funcionários", margin, yPosition);

        yPosition += 8;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(0);

        employeePerformanceMap.forEach((perf) => {
          const lineText = `${perf.username}: ${perf.completedOrders} finalizados, ${perf.cancelledOrders} cancelados, R$ ${perf.totalRevenue.toFixed(2)}`;
          pdf.text(lineText, margin + 3, yPosition);
          yPosition += 6;

          // Verificar se precisa de nova página
          if (yPosition > pageHeight - margin - 10) {
            pdf.addPage();
            yPosition = margin;
          }
        });
      }

      // Footer
      yPosition = pageHeight - margin - 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `Relatório gerado em ${new Date().toLocaleString("pt-BR")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" },
      );

      // Download PDF
      const fileName = `relatorio_diario_${today.toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      toast.success("Relatório gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório: " + (error as Error).message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();

    let imageUrl = formData.image_url;

    // Se há arquivo de imagem para upload
    if (imageFile) {
      try {
        const fileName = `${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-items")
          .upload(fileName, imageFile);

        if (uploadError) {
          toast.error("Erro ao fazer upload da imagem: " + uploadError.message);
          return;
        }

        // Obter URL pública da imagem
        const { data: publicUrl } = supabase.storage
          .from("menu-items")
          .getPublicUrl(fileName);

        imageUrl = publicUrl.publicUrl;
      } catch (error) {
        toast.error("Erro ao fazer upload da imagem: " + (error as Error).message);
        return;
      }
    }

    const itemData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      image_url: imageUrl,
      category: formData.newCategory || formData.category,
      active: true,
    };

    if (editingItem) {
      await supabase
        .from("menu_items")
        .update(itemData)
        .eq("id", editingItem.id);
    } else {
      await supabase.from("menu_items").insert(itemData);
    }

    // Adicionar nova categoria ao array categories imediatamente
    if (formData.newCategory && !categories.includes(formData.newCategory)) {
      setCategories((prev) => [...new Set([...prev, formData.newCategory])]);
    }

    setShowMenuModal(false);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview("");
    setFormData({
      name: "",
      description: "",
      price: "",
      image_url: "",
      category: "hamburguer",
      newCategory: "",
    });
    fetchMenuItems();
    toast.success(editingItem ? "Item atualizado com sucesso!" : "Item adicionado com sucesso!");
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Verificar se o usuário já existe
      const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("username", userFormData.username)
        .maybeSingle();

      if (existingUser) {
        toast.error("Erro: Este usuário já existe no sistema!");
        return;
      }

      // Gerar telefone padrão quando não informado
      const phone = userFormData.phone || "0000000000";

      const { error } = await supabase.from("users").insert({
        username: userFormData.username,
        phone: phone,
        password_hash: userFormData.password,
        slug: generateSlug(userFormData.username),
        is_admin: userFormData.is_admin,
        is_employee: userFormData.is_employee,
      });

      if (error) {
        toast.error("Erro ao criar usuário: " + error.message);
        return;
      }

      setShowUserModal(false);
      setUserFormData({
        username: "",
        phone: "",
        password: "",
        is_admin: false,
        is_employee: false,
      });
      fetchUsers();
      toast.success("Usuário criado com sucesso!");
    } catch (error) {
      toast.error("Erro ao criar usuário: " + (error as Error).message);
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      image_url: item.image_url,
      category: item.category,
      newCategory: "",
    });
    setShowMenuModal(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm("Deseja realmente excluir este item?")) {
      try {
        // Verificar se o item está em algum pedido
        const { data: orderItems, error: checkError } = await supabase
          .from("order_items")
          .select("id")
          .eq("menu_item_id", id);

        if (checkError) {
          toast.error("Erro ao verificar pedidos: " + checkError.message);
          return;
        }

        if (orderItems && orderItems.length > 0) {
          toast.warning(
            "Não é possível excluir este item porque ele está associado a pedidos existentes. Desative o item em vez de excluí-lo.",
          );
          return;
        }

        // Se não há pedidos, pode deletar
        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", id);
        if (error) {
          toast.error("Erro ao excluir item: " + error.message);
          return;
        }
        toast.success("Item excluído com sucesso!");
        fetchMenuItems();
      } catch (error) {
        toast.error("Erro ao excluir item: " + (error as Error).message);
      }
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await supabase
      .from("menu_items")
      .update({ active: !currentActive })
      .eq("id", id);
    fetchMenuItems();
  };

  const handleDeleteOrder = async (orderId: string) => {
    await supabase.from("orders").update({ hidden: true }).eq("id", orderId);
    toast.error("Pedido removido da lista!");
    fetchOrders();
  };

  const handleClearData = async () => {
    if (
      confirm(
        "⚠️ ATENÇÃO: Esta ação irá APAGAR TODOS os pedidos permanentemente do banco de dados. Esta ação não pode ser desfeita. Deseja continuar?",
      )
    ) {
      try {
        await supabase
          .from("orders")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        toast.success("Todos os pedidos foram apagados permanentemente!");
        fetchOrders();
      } catch (error) {
        toast.error("Erro ao limpar dados: " + (error as Error).message);
      }
    }
  };

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    if (
      confirm(
        `Deseja ${currentAdmin ? "remover" : "conceder"} permissão de administrador?`,
      )
    ) {
      await supabase
        .from("users")
        .update({ is_admin: !currentAdmin, is_employee: false })
        .eq("id", userId);
      fetchUsers();
    }
  };

  const handleToggleEmployee = async (
    userId: string,
    currentEmployee: boolean,
  ) => {
    if (
      confirm(
        `Deseja ${currentEmployee ? "remover" : "conceder"} permissão de funcionário?`,
      )
    ) {
      await supabase
        .from("users")
        .update({ is_employee: !currentEmployee, is_admin: false })
        .eq("id", userId);
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await supabase.from("users").delete().eq("id", userId);
      fetchUsers();
      toast.error("Usuário removido com sucesso!");
    } catch (error) {
      toast.error("Erro ao remover usuário: " + (error as Error).message);
    }
  };

  const toggleUserAccordion = (username: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(username)) {
        newSet.delete(username);
      } else {
        newSet.add(username);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-white text-black shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === "dashboard"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="max-[480px]:hidden">Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab("menu")}
                className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === "menu"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Edit2 className="w-5 h-5" />
                <span className="max-[480px]:hidden">Editar</span>
              </button>
              <button
                onClick={() => setActiveTab("deactivated")}
                className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === "deactivated"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <X className="w-5 h-5" />
                <span className="max-[480px]:hidden">Desativados</span>
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === "orders"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="max-[480px]:hidden">Pedidos</span>
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === "users"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="max-[480px]:hidden">Usuários</span>
              </button>
              <button
                onClick={() => setActiveTab("performance")}
                className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                  activeTab === "performance"
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="max-[480px]:hidden">Performance</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === "deactivated" && (
              <div>
                <h2 className="text-2xl font-bold text-black mb-6">
                  Itens Desativados
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {menuItems.filter((item) => !item.active).length === 0 ? (
                    <p className="text-gray-500 col-span-full">
                      Nenhum item desativado.
                    </p>
                  ) : (
                    menuItems
                      .filter((item) => !item.active)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="border rounded-lg overflow-hidden opacity-50 bg-gray-100"
                        >
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="p-3">
                            <h3 className="font-bold text-base mb-1 text-black">
                              {item.name}
                            </h3>
                            <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">
                              {item.category}
                            </p>
                            <p
                              className="text-gray-600 text-sm mb-2"
                              style={{
                                minHeight: "5.5em",
                                lineHeight: "1.375em",
                                overflow: "hidden",
                                display: "block",
                              }}
                            >
                              {item.description}
                            </p>
                            <p className="text-lg font-bold text-black mb-3">
                              R$ {item.price.toFixed(2)}
                            </p>
                            <button
                              onClick={() =>
                                handleToggleActive(item.id, item.active)
                              }
                              className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-base font-bold"
                            >
                              Ativar Item
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
            {activeTab === "dashboard" && (
              <div>
                <h2 className="text-2xl font-bold text-black mb-6">
                  Dashboard
                </h2>

                {/* Cards de estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Pedidos Hoje
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {
                            orders.filter((order) => {
                              const today = new Date().toDateString();
                              const orderDate = new Date(
                                order.created_at,
                              ).toDateString();
                              return (
                                orderDate === today &&
                                order.status !== "cancelled"
                              );
                            }).length
                          }
                        </p>
                      </div>
                      <ShoppingBag className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Receita Hoje
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          R${" "}
                          {orders
                            .filter((order) => {
                              const today = new Date().toDateString();
                              const orderDate = new Date(
                                order.created_at,
                              ).toDateString();
                              return (
                                orderDate === today &&
                                order.status !== "cancelled"
                              );
                            })
                            .reduce((sum, order) => sum + order.total, 0)
                            .toFixed(2)}
                        </p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Usuários
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {users.length}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Itens no Cardápio
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {menuItems.length}
                        </p>
                      </div>
                      <Edit2 className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>
                </div>

                {/* Status dos pedidos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Status dos Pedidos
                    </h3>
                    <div className="space-y-4">
                      {/* Pipeline de pedidos */}
                      <div className="border-l-4 border-yellow-400 pl-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Em Fila
                          </span>
                          <span className="text-lg font-bold text-yellow-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) => order.status === "pending")
                                .length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Aguardando aprovação
                        </p>
                      </div>

                      <div className="border-l-4 border-blue-400 pl-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Em Preparo
                          </span>
                          <span className="text-lg font-bold text-blue-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) => order.status === "preparing")
                                .length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Sendo preparado</p>
                      </div>

                      <div className="border-l-4 border-green-400 pl-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Pronto
                          </span>
                          <span className="text-lg font-bold text-green-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) => order.status === "ready")
                                .length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Aguardando retirada
                        </p>
                      </div>

                      <div className="border-l-4 border-gray-400 pl-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Finalizado
                          </span>
                          <span className="text-lg font-bold text-gray-600">
                            {
                              orders.filter(
                                (order) => order.status === "completed",
                              ).length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Pedido concluído
                        </p>
                      </div>

                      <div className="border-l-4 border-red-400 pl-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            Cancelado
                          </span>
                          <span className="text-lg font-bold text-red-600">
                            {
                              orders.filter(
                                (order) => order.status === "cancelled",
                              ).length
                            }
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Pedido cancelado
                        </p>
                      </div>

                      {/* Resumo do pipeline */}
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm font-medium text-gray-700">
                            Total em Andamento
                          </span>
                          <span className="text-lg font-bold text-purple-600">
                            {
                              orders
                                .filter((order) => !order.hidden)
                                .filter((order) =>
                                  ["pending", "preparing", "ready"].includes(
                                    order.status,
                                  ),
                                ).length
                            }
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          Pedidos ativos no sistema
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Itens Mais Vendidos (Hoje)
                    </h3>
                    <div className="space-y-3">
                      {(() => {
                        const today = new Date().toDateString();
                        const todayOrders = orders.filter(
                          (order) =>
                            new Date(order.created_at).toDateString() ===
                              today && order.status !== "cancelled",
                        );

                        const itemCounts: {
                          [key: string]: { name: string; count: number };
                        } = {};

                        todayOrders.forEach((order) => {
                          order.order_items?.forEach((item) => {
                            if (item.menu_items) {
                              const itemName = item.menu_items.name;
                              if (itemCounts[itemName]) {
                                itemCounts[itemName].count += item.quantity;
                              } else {
                                itemCounts[itemName] = {
                                  name: itemName,
                                  count: item.quantity,
                                };
                              }
                            }
                          });
                        });

                        const sortedItems = Object.values(itemCounts)
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 5);

                        return sortedItems.length > 0 ? (
                          sortedItems.map((item) => (
                            <div
                              key={item.name}
                              className="flex justify-between items-center"
                            >
                              <span className="text-sm text-gray-600">
                                {item.name}
                              </span>
                              <span className="font-semibold text-gray-900">
                                {item.count}x
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">
                            Nenhum pedido hoje
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Pedidos recentes */}
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Pedidos Recentes
                  </h3>
                  <div className="space-y-3">
                    {(showAllRecentOrders ? orders : orders.slice(0, 3)).map(
                      (order) => (
                        <div
                          key={order.id}
                          className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              Pedido da Mesa{" "}
                              {order.users?.username || "Cliente"} •{" "}
                              {new Date(order.created_at).toLocaleString(
                                "pt-BR",
                              )}
                            </p>
                            <p className="text-sm text-gray-600">
                              Pedido #{formatOrderNumericId(order.id)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              R$ {order.total.toFixed(2)}
                            </p>
                            <p
                              className={`text-xs px-2 py-1 rounded-full ${
                                order.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : order.status === "preparing"
                                    ? "bg-blue-100 text-blue-800"
                                    : order.status === "ready"
                                      ? "bg-green-100 text-green-800"
                                      : order.status === "cancelled"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {order.status === "pending"
                                ? "Aguardando"
                                : order.status === "preparing"
                                  ? "Preparando"
                                  : order.status === "ready"
                                    ? "Pronto"
                                    : order.status === "cancelled"
                                      ? "Cancelado"
                                      : "Finalizado"}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                    {orders.length === 0 && (
                      <p className="text-sm text-gray-500">
                        Nenhum pedido recente.
                      </p>
                    )}
                  </div>
                  {orders.length > 3 && (
                    <div className="mt-4 pt-4 border-t">
                      <button
                        onClick={() =>
                          setShowAllRecentOrders(!showAllRecentOrders)
                        }
                        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition font-medium"
                      >
                        {showAllRecentOrders ? "Ver menos" : "Ver todos"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Botão de gerar relatório */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mt-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        📊 Gerar Relatório Diário
                      </h3>
                      <p className="text-sm text-blue-700">
                        Gera um relatório em PDF com todas as informações
                        diárias, incluindo pedidos, faturamento, formas de
                        pagamento e performance.
                      </p>
                    </div>
                    <button
                      onClick={generateDailyReport}
                      disabled={generatingReport}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition font-semibold"
                    >
                      {generatingReport ? "Gerando..." : "Gerar PDF"}
                    </button>
                  </div>
                </div>

                {/* Botão de limpar dados */}
                <div className="bg-red-50 p-6 rounded-lg border border-red-200 mt-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-red-900 mb-2">
                        ⚠️ Limpar Dados
                      </h3>
                      <p className="text-sm text-red-700">
                        Apaga permanentemente todos os pedidos do banco de
                        dados. Esta ação não pode ser desfeita.
                      </p>
                    </div>
                    <button
                      onClick={handleClearData}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                    >
                      Limpar Todos os Dados
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "menu" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-black">
                    Gerenciar Cardápio
                  </h2>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({
                        name: "",
                        description: "",
                        price: "",
                        image_url: "",
                        category: "",
                        newCategory: "",
                      });
                      setShowMenuModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                </div>

                {/* Menu Items */}
                {(() => {
                  const activeItems = menuItems.filter((item) => item.active);

                  // Group items by category
                  const groupedItems = activeItems.reduce(
                    (acc, item) => {
                      if (!acc[item.category]) {
                        acc[item.category] = [];
                      }
                      acc[item.category].push(item);
                      return acc;
                    },
                    {} as Record<string, MenuItem[]>,
                  );

                  return Object.entries(groupedItems).map(
                    ([category, items]) => (
                      <div key={category} className="mb-8">
                        <h3 className="text-xl font-bold text-black mb-4 border-b pb-2">
                          {category.replace(/\b\w/g, (l) => l.toUpperCase())}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="border rounded-lg overflow-hidden"
                            >
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full aspect-square object-cover"
                              />
                              <div className="p-3">
                                <h3 className="font-bold text-base mb-1 text-black">
                                  {item.name}
                                </h3>
                                <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">
                                  {item.category}
                                </p>
                                <p className="text-gray-600 text-sm mb-2">
                                  {item.description}
                                </p>
                                <p className="text-lg font-bold text-black mb-3">
                                  R$ {item.price.toFixed(2)}
                                </p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditItem(item)}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-gray-100 text-black rounded hover:bg-gray-200 transition text-sm"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleToggleActive(item.id, item.active)
                                    }
                                    className="flex-1 px-2 py-1 bg-gray-100 text-black rounded hover:bg-gray-200 transition text-xs"
                                  >
                                    Desativar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  );
                })()}
              </div>
            )}

            {activeTab === "orders" && (
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
                      Object.entries(ordersByUser).map(
                        ([username, userOrders]) => (
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
                                {userOrders.some(
                                  (o) => o.status === "pending",
                                ) && (
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
                                          {order.assigned_employee && (
                                            <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
                                              Atendido por:{" "}
                                              {order.assigned_employee.username}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-gray-600">
                                          Pedido #
                                          {formatOrderNumericId(order.id)}
                                        </p>
                                        <p className="text-gray-600">
                                          {new Date(
                                            order.created_at,
                                          ).toLocaleString("pt-BR")}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-2xl font-bold text-black">
                                          R$ {order.total.toFixed(2)}
                                        </p>
                                        {order.status === "pending" && (
                                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                                            Aguardando
                                          </span>
                                        )}
                                        {order.status === "preparing" && (
                                          <span className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm">
                                            Preparando
                                          </span>
                                        )}
                                        {order.status === "ready" && (
                                          <span className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm">
                                            Pronto
                                          </span>
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
                                              {item.quantity}x{" "}
                                              {item.menu_items?.name}
                                            </span>
                                            <span>
                                              R${" "}
                                              {(
                                                item.price * item.quantity
                                              ).toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Informações adicionais do pedido */}
                                    {(order.payment_method ||
                                      order.observations) && (
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
                        ),
                      )
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-black">Usuários</h2>
                  <button
                    onClick={() => setShowUserModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Usuário
                  </button>
                </div>
                <div className="space-y-4">
                  {(() => {
                    const usersByType = users.reduce(
                      (acc, user) => {
                        let type = "Cliente";
                        if (user.is_admin) type = "Admin";
                        else if (user.is_employee) type = "Funcionário";

                        if (!acc[type]) acc[type] = [];
                        acc[type].push(user);
                        return acc;
                      },
                      {} as Record<string, typeof users>,
                    );

                    return Object.entries(usersByType)
                      .sort(([typeA], [typeB]) => {
                        const order = { Cliente: 0, Funcionário: 1, Admin: 2 };
                        return (
                          (order[typeA as keyof typeof order] || 3) -
                          (order[typeB as keyof typeof order] || 3)
                        );
                      })
                      .map(([type, typeUsers]) => (
                        <div
                          key={type}
                          className="border rounded-lg bg-gray-50"
                        >
                          <button
                            onClick={() => toggleUserAccordion(type)}
                            className="w-full text-left p-4 font-bold text-lg text-black hover:bg-gray-100 transition flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              {type}
                              <span className="bg-black text-white text-xs px-2 py-1 rounded-full">
                                {typeUsers.length}
                              </span>
                            </span>
                            <ChevronDown
                              className={`w-5 h-5 transition-transform ${expandedUsers.has(type) ? "rotate-180" : ""}`}
                            />
                          </button>
                          {expandedUsers.has(type) && (
                            <div className="p-4">
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-black">
                                        Usuário
                                      </th>
                                      <th className="px-4 py-3 text-left text-black">
                                        Telefone
                                      </th>
                                      {type !== "Cliente" && (
                                        <>
                                          <th className="px-4 py-3 text-left text-black">
                                            Admin
                                          </th>
                                          <th className="px-4 py-3 text-left text-black">
                                            Funcionário
                                          </th>
                                        </>
                                      )}
                                      <th className="px-4 py-3 text-center text-black">
                                        Ações
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {typeUsers.map((user) => (
                                      <tr key={user.id} className="border-b">
                                        <td className="px-4 py-3 text-black">
                                          {user.username}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                          {user.phone || "-"}
                                        </td>
                                        {type !== "Cliente" && (
                                          <>
                                            <td className="px-4 py-3">
                                              <span
                                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                                  user.is_admin
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-800"
                                                }`}
                                              >
                                                {user.is_admin ? "Sim" : "Não"}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3">
                                              <span
                                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                                  user.is_employee
                                                    ? "bg-blue-100 text-blue-800"
                                                    : "bg-gray-100 text-gray-800"
                                                }`}
                                              >
                                                {user.is_employee
                                                  ? "Sim"
                                                  : "Não"}
                                              </span>
                                            </td>
                                          </>
                                        )}
                                        <td className="px-4 py-3">
                                          <div className="flex gap-2 justify-center flex-wrap">
                                            {type === "Cliente" ? (
                                              <>
                                                <button
                                                  onClick={() =>
                                                    handleToggleEmployee(
                                                      user.id,
                                                      !!user.is_employee,
                                                    )
                                                  }
                                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                                                  title="Gerenciar permissão de funcionário"
                                                >
                                                  Tornar Func
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleToggleAdmin(
                                                      user.id,
                                                      user.is_admin,
                                                    )
                                                  }
                                                  className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition text-sm"
                                                  title="Gerenciar permissão de admin"
                                                >
                                                  Tornar Admin
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={() =>
                                                    handleToggleAdmin(
                                                      user.id,
                                                      user.is_admin,
                                                    )
                                                  }
                                                  className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition text-sm flex-1 min-w-24 justify-center"
                                                  title="Gerenciar permissão de admin"
                                                >
                                                  {user.is_admin
                                                    ? "Remover Admin"
                                                    : "Tornar Admin"}
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleToggleEmployee(
                                                      user.id,
                                                      !!user.is_employee,
                                                    )
                                                  }
                                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm flex-1 min-w-24 justify-center"
                                                  title="Gerenciar permissão de funcionário"
                                                >
                                                  {user.is_employee
                                                    ? "Remover Func"
                                                    : "Tornar Func"}
                                                </button>
                                              </>
                                            )}
                                            <button
                                              onClick={() =>
                                                handleDeleteUser(user.id)
                                              }
                                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm flex items-center gap-1"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              Remover
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ));
                  })()}
                </div>
              </div>
            )}

            {activeTab === "performance" && (
              <div>
                <h2 className="text-2xl font-bold text-black mb-6">
                  Performance dos Funcionários
                </h2>
                {employeePerformance.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum funcionário encontrado ou sem dados de performance
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-black">
                            Funcionário
                          </th>
                          <th className="px-4 py-3 text-center text-black">
                            Pedidos Finalizados
                          </th>
                          <th className="px-4 py-3 text-center text-black">
                            Pedidos Cancelados
                          </th>
                          <th className="px-4 py-3 text-center text-black">
                            Renda Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeePerformance.map((emp) => (
                          <tr
                            key={emp.userId}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-black font-semibold">
                              {emp.username}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                                {emp.completedOrders}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                onClick={() =>
                                  handleViewCancelledOrders(emp.userId)
                                }
                                className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold cursor-pointer hover:bg-red-200 transition"
                              >
                                {emp.cancelledOrders}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-black font-bold text-lg">
                              R$ {emp.totalRevenue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Resumo Geral */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600">
                          Pedidos Finalizados
                        </p>
                        <p className="text-3xl font-bold text-green-600">
                          {employeePerformance.reduce(
                            (sum, emp) => sum + emp.completedOrders,
                            0,
                          )}
                        </p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <p className="text-sm text-gray-600">
                          Pedidos Cancelados
                        </p>
                        <p className="text-3xl font-bold text-red-600">
                          {employeePerformance.reduce(
                            (sum, emp) => sum + emp.cancelledOrders,
                            0,
                          )}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <p className="text-sm text-gray-600">Renda Total</p>
                        <p className="text-3xl font-bold text-purple-600">
                          R${" "}
                          {employeePerformance
                            .reduce((sum, emp) => sum + emp.totalRevenue, 0)
                            .toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Exibir pedidos cancelados do funcionário selecionado */}
                    {selectedEmployeeForCancelled &&
                      selectedEmployeeCancelledOrders.length > 0 && (
                        <div className="mt-8 p-6 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-red-800">
                              Pedidos Cancelados -{" "}
                              {
                                employeePerformance.find(
                                  (emp) =>
                                    emp.userId === selectedEmployeeForCancelled,
                                )?.username
                              }
                            </h3>
                            <button
                              onClick={() =>
                                setSelectedEmployeeForCancelled(null)
                              }
                              className="text-red-600 hover:text-red-800 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="space-y-3">
                            {selectedEmployeeCancelledOrders.map((order) => (
                              <div
                                key={order.id}
                                className="bg-white p-3 rounded border border-red-200"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold">
                                    Pedido #{order.id.substring(0, 8)}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {new Date(order.created_at).toLocaleString(
                                      "pt-BR",
                                    )}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mt-1">
                                  <strong>Total:</strong> R${" "}
                                  {order.total.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMenuModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowMenuModal(false);
            setEditingItem(null);
            setFormData({
              name: "",
              description: "",
              price: "",
              image_url: "",
              category: "hamburguer",
              newCategory: "",
            });
          }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-2xl font-bold text-black">
                {editingItem ? "Editar Item" : "Adicionar Item"}
              </h2>
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  setEditingItem(null);
                  setFormData({
                    name: "",
                    description: "",
                    price: "",
                    image_url: "",
                    category: "hamburguer",
                    newCategory: "",
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    disabled={!!formData.newCategory}
                    required={!formData.newCategory}
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {capitalize(cat)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ou criar nova categoria (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.newCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, newCategory: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    placeholder="Digite o nome da nova categoria"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imagem do Item
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setImagePreview(event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Clique para selecionar uma imagem do seu dispositivo
                  </p>
                </div>

                {(imagePreview || formData.image_url) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preview
                    </label>
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={imagePreview || formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex-shrink-0">
              <button
                type="submit"
                onClick={handleSaveMenuItem}
                className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                {editingItem ? "Atualizar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-2xl font-bold text-black">
                Adicionar Usuário
              </h2>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setUserFormData({
                    username: "",
                    phone: "",
                    password: "",
                    is_admin: false,
                    is_employee: false,
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {/* Tipo de Usuário - PRIMEIRO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Usuário
                  </label>
                  <select
                    value={
                      userFormData.is_admin
                        ? "admin"
                        : userFormData.is_employee
                          ? "employee"
                          : "cliente"
                    }
                    onChange={(e) => {
                      if (e.target.value === "admin") {
                        setUserFormData({
                          ...userFormData,
                          is_admin: true,
                          is_employee: false,
                        });
                      } else if (e.target.value === "employee") {
                        setUserFormData({
                          ...userFormData,
                          is_admin: false,
                          is_employee: true,
                        });
                      } else {
                        setUserFormData({
                          ...userFormData,
                          is_admin: false,
                          is_employee: false,
                        });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    required
                  >
                    <option value="cliente">Cliente</option>
                    <option value="employee">Funcionário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Campos para CLIENTE */}
                {!userFormData.is_admin && !userFormData.is_employee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número da Mesa
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={userFormData.username}
                      onChange={(e) => {
                        const value = e.target.value;
                        const numValue = parseInt(value, 10);

                        if (
                          !isNaN(numValue) &&
                          numValue >= 1 &&
                          numValue <= 9
                        ) {
                          // Números 1-9 viram 01-09
                          setUserFormData({
                            ...userFormData,
                            username: `0${numValue}`,
                          });
                        } else if (
                          !isNaN(numValue) &&
                          numValue >= 10 &&
                          numValue <= 99
                        ) {
                          // Números 10-99 ficam como estão
                          setUserFormData({
                            ...userFormData,
                            username: numValue.toString(),
                          });
                        } else if (numValue > 99) {
                          // Limita ao máximo de 99
                          setUserFormData({
                            ...userFormData,
                            username: "99",
                          });
                        } else {
                          // Campo vazio ou inválido
                          setUserFormData({
                            ...userFormData,
                            username: value,
                          });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                      required
                    />
                  </div>
                )}

                {/* Campos para FUNCIONÁRIO E ADMIN */}
                {(userFormData.is_admin || userFormData.is_employee) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={userFormData.username}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            username: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={userFormData.phone}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            phone: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha
                      </label>
                      <input
                        type="password"
                        value={userFormData.password}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            password: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 border-t flex-shrink-0">
                <button
                  type="submit"
                  className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
                >
                  Adicionar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
