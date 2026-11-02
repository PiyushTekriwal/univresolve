import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { Clock, Tag, User, Wrench, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getUserComplaints } from '../services/api';

/* ── Pretty-print worker type enum → human label ────────────────────────── */
const WORKER_TYPE_LABELS = {
  ELECTRICIAN:          "⚡ Electrician",
  PLUMBER:              "🔧 Plumber",
  CARPENTER:            "🪚 Carpenter",
  JANITOR:              "🧹 Janitor",
  MESS_WORKER:          "🍽️ Mess Worker",
  SECURITY_GUARD:       "🛡️ Security Guard",
  IT_TECHNICIAN:        "💻 IT Technician",
  ACADEMIC_COORDINATOR: "📚 Academic Coordinator",
  GENERAL_WORKER:       "🔨 General Worker",
};

const workerLabel = (type) => WORKER_TYPE_LABELS[type] || type || "—";

const Dashboard = () => {

  const [complaints, setComplaints] = useState([]);
  const [user, setUser]             = useState(null);
  const [error, setError]           = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");

  const isAdmin = user?.role?.toLowerCase() === "admin";

  /* ── Load user from localStorage ──────────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) { setError("Please login first"); return; }
      const parsed = JSON.parse(raw);
      if (!parsed?.id) { setError("Invalid user data"); return; }
      setUser(parsed);
    } catch {
      setError("User data error");
    }
  }, []);

  useEffect(() => { if (user) loadComplaints(); }, [user]);

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

  /* ── Status badge ─────────────────────────────────────────────────────── */
  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "open")        return <Badge variant="warning">Open</Badge>;
    if (s === "in_progress" || s === "in-progress")
                             return <Badge variant="primary">In Progress</Badge>;
    if (s === "resolved")    return <Badge variant="success">Resolved</Badge>;
    return <Badge>Unknown</Badge>;
  };

  /* ── Assignment badge ─────────────────────────────────────────────────── */
  const getAssignmentBadge = (status) => {
    if (status === "assigned")            return <Badge variant="primary">Assigned</Badge>;
    if (status === "pending_assignment")  return <Badge variant="warning">Pending Assignment</Badge>;
    return null;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return isNaN(d) ? date : d.toLocaleString();
  };

  const filteredComplaints = complaints.filter(c => {
    const status = (c.status || "").toLowerCase();
    const matchesFilter = filter === "all" || status === filter;
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  /* ── Border colour by status ──────────────────────────────────────────── */
  const borderColour = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "open")        return "border-yellow-400";
    if (s === "in_progress" || s === "in-progress") return "border-blue-400";
    if (s === "resolved")    return "border-green-500";
    return "border-slate-300";
  };

  if (error) {
    return (
      <Layout>
        <div className="p-10 text-center text-red-500 text-xl">{error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Greeting */}
        {user && (
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">Hi, {user.name || user.email}</h2>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Complaints</h1>
            <p className="text-slate-500">Track your submitted complaints</p>
          </div>
          <Link to="/complaint">
            <Button>New Complaint</Button>
          </Link>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search complaints..."
          className="border p-2 rounded w-full mb-4"
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {["all", "open", "in_progress", "resolved"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "in_progress" ? "IN PROGRESS" : f.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-4">
          {filteredComplaints.length === 0 && (
            <p className="text-slate-500">No complaints found.</p>
          )}

          {filteredComplaints.map((c, index) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              className={`p-6 rounded-xl shadow border-l-4 bg-white ${borderColour(c.status)}`}
            >
              <div className="flex justify-between items-start">

                <div className="flex-1">
                  {/* ID + status badges */}
                  <div className="flex flex-wrap gap-2 mb-2 items-center">
                    <span className="text-sm text-gray-400 font-mono">#{c.id}</span>
                    {getStatusBadge(c.status)}
                    {getAssignmentBadge(c.assignmentStatus)}
                  </div>

                  <h3 className="font-bold text-lg mb-1">{c.title}</h3>

                  {/* Category + date */}
                  <div className="flex gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Tag size={14} />
                      {c.category}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatDate(c.createdAt)}
                    </div>
                  </div>

                  {/* ── Assigned worker card ─────────────────────────────── */}
                  {c.assignedWorkerId ? (
                    <div className="flex items-center gap-3 mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg w-fit">
                      <div className="bg-blue-100 p-1.5 rounded-full">
                        <User size={14} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Assigned Worker</p>
                        <p className="text-sm font-semibold text-blue-800">{c.workerName}</p>
                        <p className="text-xs text-blue-600">{workerLabel(c.workerType)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg w-fit">
                      <HelpCircle size={14} className="text-yellow-500" />
                      <p className="text-xs text-yellow-700">
                        Awaiting worker assignment — you'll be assigned as soon as a {c.workerType ? workerLabel(c.workerType) : "worker"} is available.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-4 self-start"
                  onClick={() => setSelectedComplaint(c)}
                >
                  View
                </Button>

              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            <h2 className="text-xl font-bold mb-1">{selectedComplaint.title}</h2>
            <p className="text-gray-400 text-xs mb-4">#{selectedComplaint.id} · {formatDate(selectedComplaint.createdAt)}</p>

            <p className="text-gray-600 mb-4">{selectedComplaint.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {getStatusBadge(selectedComplaint.status)}
              {getAssignmentBadge(selectedComplaint.assignmentStatus)}
              <Badge variant="secondary">{selectedComplaint.category}</Badge>
            </div>

            {/* Worker details in modal */}
            {selectedComplaint.assignedWorkerId ? (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench size={16} className="text-blue-600" />
                  <p className="font-semibold text-blue-800 text-sm">Assigned Worker</p>
                </div>
                <p className="text-base font-bold text-blue-900">{selectedComplaint.workerName}</p>
                <p className="text-sm text-blue-700">{workerLabel(selectedComplaint.workerType)}</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800">
                  🕐 <strong>Pending Assignment</strong> — All workers of this type are currently busy. You will be automatically assigned a worker as soon as one becomes available.
                </p>
              </div>
            )}

            {/* Admin resolve button */}
            {isAdmin && selectedComplaint.status !== "resolved" && (
              <Button
                className="mt-2 w-full"
                onClick={() => resolveIssue(selectedComplaint.id)}
              >
                Mark as Resolved
              </Button>
            )}

            <div className="mt-4 text-right">
              <Button variant="outline" onClick={() => setSelectedComplaint(null)}>Close</Button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
};

export default Dashboard;
