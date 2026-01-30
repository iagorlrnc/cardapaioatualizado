import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import EmployeeLogin from "./pages/EmployeeLogin";
import CustomerOrder from "./pages/CustomerOrder";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const { user, loading } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showEmployeeLogin, setShowEmployeeLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    if (showEmployeeLogin) {
      return (
        <EmployeeLogin onSwitchToLogin={() => setShowEmployeeLogin(false)} />
      );
    }

    if (showAdminLogin) {
      return <AdminLogin onSwitchToLogin={() => setShowAdminLogin(false)} />;
    }

    return (
      <Login
        onSwitchToRegister={() => setShowAdminLogin(true)}
        onSwitchToEmployee={() => setShowEmployeeLogin(true)}
      />
    );
  }

  if (user.is_admin) {
    return <AdminDashboard />;
  }

  if (user.is_employee) {
    return <EmployeeDashboard />;
  }

  return <CustomerOrder />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </AuthProvider>
  );
}

export default App;
