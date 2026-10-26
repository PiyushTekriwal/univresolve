import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ChatBot from "./components/ui/ChatBot";
import { useState, useEffect } from "react";

// Pages
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Complaint from "./pages/ComplaintForm";
import Login from "./pages/Login";
import Register from "./pages/Register";
import History from "./pages/History";
import AdminDashboard from "./pages/AdminDashboard";

function AppRoutes() {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
  }, [location.pathname]);

  const isAdmin = user?.role?.toLowerCase() === "admin";

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" />}
      />
      <Route
        path="/complaint"
        element={user ? <Complaint /> : <Navigate to="/login" />}
      />
      <Route
        path="/history"
        element={user ? <History /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin"
        element={
          isAdmin
            ? <AdminDashboard />
            : <Navigate to="/dashboard" />
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
      {/* RAG chatbot floating widget — global, renders on every page */}
      <ChatBot />
    </Router>
  );
}

export default App;
