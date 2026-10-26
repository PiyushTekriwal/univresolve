import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { Clock, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getUserComplaints } from '../services/api';

const Dashboard = () => {

  const [complaints, setComplaints] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // 🔥 ADMIN CHECK
  const isAdmin = user?.role?.toLowerCase() === "admin";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");

      if (!raw) {
        setError("Please login first");
        return;
      }

      const parsed = JSON.parse(raw);

      if (!parsed?.id) {
        setError("Invalid user data");
        return;
      }

      setUser(parsed);
    } catch {
      setError("User data error");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadComplaints();
  }, [user]);

  const loadComplaints = async () => {
    try {
      const data = await getUserComplaints(user.id);

      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setComplaints(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load complaints");
    }
  };

  const resolveIssue = async (id) => {
    await fetch(`/api/issues/${id}`, { method: "DELETE" });
    loadComplaints();
    setSelectedComplaint(null);
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();

    if (s === "open") return <Badge variant="warning">Open</Badge>;
    if (s === "resolved") return <Badge variant="success">Resolved</Badge>;

    return <Badge>Unknown</Badge>;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return isNaN(d) ? date : d.toLocaleString();
  };

  // 🔥 FIXED FILTER
  const filteredComplaints = complaints.filter(c => {
    const status = (c.status || "").toLowerCase();

    const matchesFilter =
      filter === "all" || status === filter;

    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  if (error) {
    return (
      <Layout>
        <div className="p-10 text-center text-red-500 text-xl">
          {error}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>

      <div className="max-w-7xl mx-auto px-4 py-10">

        {user && (
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">
              Hi, {user.name || user.email}
            </h2>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Complaints</h1>
            <p className="text-slate-500">Track your submitted complaints</p>
          </div>

          <Link to="/complaint">
            <Button>New Complaint</Button>
          </Link>
        </div>

        {/* 🔍 SEARCH */}
        <input
          type="text"
          placeholder="Search complaints..."
          className="border p-2 rounded w-full mb-4"
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* 🎯 FILTER */}
        <div className="flex gap-2 mb-6">
          {["all", "open", "resolved"].map((f) => (
            <Button key={f} variant="outline" onClick={() => setFilter(f)}>
              {f.toUpperCase()}
            </Button>
          ))}
        </div>

        <div className="space-y-4">

          {filteredComplaints.length === 0 && (
            <p className="text-slate-500">No complaints found.</p>
          )}

          {filteredComplaints.map((c, index) => (

            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-6 rounded-xl shadow border-l-4 ${
                c.status === "open"
                  ? "border-yellow-400"
                  : "border-green-500"
              }`}
            >

              <div className="flex justify-between">

                <div>
                  <div className="flex gap-3 mb-2">
                    <span className="text-sm text-gray-400">#{c.id}</span>
                    {getStatusBadge(c.status)}
                  </div>

                  <h3 className="font-bold text-lg">{c.title}</h3>

                  <div className="flex gap-4 text-sm text-gray-600 mt-2">
                    <div className="flex items-center gap-1">
                      <Tag size={14} />
                      {c.category}
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatDate(c.createdAt)}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedComplaint(c)}
                >
                  View
                </Button>

              </div>
            </motion.div>

          ))}
        </div>
      </div>

      {/* 🔥 MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">

          <div className="bg-white p-6 rounded-2xl w-[500px] shadow-2xl">

            <h2 className="text-xl font-bold mb-2">
              {selectedComplaint.title}
            </h2>

            <p className="text-gray-600 mb-4">
              {selectedComplaint.description}
            </p>

            <div className="mb-2">
              {getStatusBadge(selectedComplaint.status)}
            </div>

            <p className="text-sm text-gray-500">
              Category: {selectedComplaint.category}
            </p>

            {/* 🔥 ADMIN ONLY */}
            {isAdmin && selectedComplaint.status === "open" && (
              <Button
                className="mt-4"
                onClick={() => resolveIssue(selectedComplaint.id)}
              >
                Mark as Resolved
              </Button>
            )}

            <div className="mt-4 text-right">
              <Button onClick={() => setSelectedComplaint(null)}>
                Close
              </Button>
            </div>

          </div>

        </div>
      )}

    </Layout>
  );
};

export default Dashboard;