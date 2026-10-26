import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { Trash2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllComplaints, deleteComplaint } from '../services/api';

const Admin = () => {

  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  /* Load user and check admin status */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");

      if (!raw) {
        setError("Please login first");
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(raw);

      if (!parsed?.id) {
        setError("Invalid user data");
        setLoading(false);
        return;
      }

      // Check if user is admin
      if (parsed.role !== "ADMIN") {
        setError("Access denied: Admin access required");
        setLoading(false);
        return;
      }

      setUser(parsed);
      setLoading(false);

    } catch (err) {
      setError("Login error");
      setLoading(false);
    }
  }, []);

  /* Fetch all complaints */
  useEffect(() => {

    if (!user) return;

    loadComplaints();

  }, [user]);

  const loadComplaints = async () => {
    try {
      const data = await getAllComplaints();
      setComplaints(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load complaints");
    }
  };

  const handleResolve = async (id) => {
    if (!window.confirm("Are you sure you want to resolve (delete) this complaint?")) {
      return;
    }

    setDeletingId(id);

    try {
      await deleteComplaint(id);
      setComplaints(complaints.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      setError("Failed to resolve complaint");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();

    if (s === "open") return <Badge variant="warning">Open</Badge>;
    if (s === "in-progress" || s === "in_progress")
      return <Badge variant="primary">In Progress</Badge>;
    if (s === "resolved") return <Badge variant="success">Resolved</Badge>;

    return <Badge>Unknown</Badge>;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return isNaN(d) ? date : d.toLocaleString();
  };

  /* Loading state */
  if (loading) {
    return (
      <Layout>
        <div className="p-10 text-center">
          <p className="text-slate-500">Loading...</p>
        </div>
      </Layout>
    );
  }

  /* Error screen */
  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 p-6 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>

      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Welcome */}
        {user && (
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">
              Welcome Admin, {user.name || user.email}
            </h2>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">

          <div>
            <h1 className="text-3xl font-bold">All Complaints</h1>
            <p className="text-slate-500">
              Manage and resolve user complaints
            </p>
          </div>

        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-slate-500 text-sm">Total Complaints</p>
            <p className="text-2xl font-bold">{complaints.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-slate-500 text-sm">Open</p>
            <p className="text-2xl font-bold text-yellow-600">
              {complaints.filter(c => c.status === "open").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-slate-500 text-sm">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">
              {complaints.filter(c => c.status === "in_progress" || c.status === "in-progress").length}
            </p>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">

          {complaints.length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-500 text-lg">
                No complaints found.
              </p>
            </div>
          )}

          {complaints.map((c, index) => (

            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition-shadow"
            >

              <div className="flex justify-between items-start">

                <div className="flex-1">

                  <div className="flex gap-3 mb-2 items-center">
                    <span className="text-sm text-gray-400 font-mono">
                      #{c.id}
                    </span>
                    {getStatusBadge(c.status)}
                    {c.category && (
                      <Badge variant="secondary">{c.category}</Badge>
                    )}
                  </div>

                  <h3 className="font-bold text-lg mb-2">
                    {c.title}
                  </h3>

                  <p className="text-slate-600 mb-4 line-clamp-2">
                    {c.description}
                  </p>

                  <div className="flex gap-6 text-sm text-slate-500">
                    <span>
                      Filed by: <span className="font-medium">{c.user?.name || c.user?.email}</span>
                    </span>
                    <span>
                      Created: <span className="font-medium">{formatDate(c.createdAt)}</span>
                    </span>
                  </div>

                </div>

                <Button
                  onClick={() => handleResolve(c.id)}
                  disabled={deletingId === c.id}
                  className="ml-4 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingId === c.id ? "Resolving..." : "Resolve"}
                </Button>

              </div>

            </motion.div>

          ))}

        </div>

      </div>

    </Layout>
  );
};

export default Admin;
