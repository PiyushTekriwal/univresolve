import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, AlertCircle, Users, ClipboardList,
  UserPlus, CheckCircle, Wrench, User, Clock, Tag
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAllComplaints, deleteComplaint, getAllWorkers, createWorker, deleteWorker } from '../services/api';

/* ── Worker type options ───────────────────────────────────────────────────── */
const WORKER_TYPES = [
  { value: "ELECTRICIAN",          label: "⚡ Electrician",           category: "electrical" },
  { value: "PLUMBER",              label: "🔧 Plumber",               category: "plumbing" },
  { value: "CARPENTER",            label: "🪚 Carpenter",             category: "hostel" },
  { value: "JANITOR",              label: "🧹 Janitor",               category: "sanitation" },
  { value: "MESS_WORKER",          label: "🍽️ Mess Worker",           category: "mess" },
  { value: "SECURITY_GUARD",       label: "🛡️ Security Guard",        category: "security" },
  { value: "IT_TECHNICIAN",        label: "💻 IT Technician",         category: "internet" },
  { value: "ACADEMIC_COORDINATOR", label: "📚 Academic Coordinator",  category: "academics" },
  { value: "GENERAL_WORKER",       label: "🔨 General Worker",        category: "other" },
];

const workerLabel = (type) =>
  WORKER_TYPES.find(w => w.value === type)?.label || type || "—";

/* ── Status helpers ──────────────────────────────────────────────────────── */
const getStatusBadge = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "open")        return <Badge variant="warning">Open</Badge>;
  if (s === "in_progress" || s === "in-progress")
                           return <Badge variant="primary">In Progress</Badge>;
  if (s === "resolved")    return <Badge variant="success">Resolved</Badge>;
  return <Badge>Unknown</Badge>;
};

const getWorkerStatusBadge = (status) => {
  if (status === "IDLE")  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">● Idle</span>;
  if (status === "BUSY")  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">● Busy</span>;
  return null;
};

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return isNaN(d) ? date : d.toLocaleString();
};

/* ═══════════════════════════════════════════════════════════════════════════ */

const Admin = () => {

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const [user, setUser]       = useState(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);

  /* ── Tab ─────────────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState("complaints"); // "complaints" | "workers"

  /* ── Complaints state ────────────────────────────────────────────────── */
  const [complaints, setComplaints] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [compFilter, setCompFilter] = useState("all");

  /* ── Workers state ───────────────────────────────────────────────────── */
  const [workers, setWorkers]           = useState([]);
  const [workerFilter, setWorkerFilter] = useState("ALL");
  const [deletingWorkerId, setDeletingWorkerId] = useState(null);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [addError, setAddError]         = useState("");
  const [addSuccess, setAddSuccess]     = useState(false);
  const [newWorker, setNewWorker]       = useState({
    name: "", email: "", phone: "", workerType: ""
  });

  /* ── Bootstrap ───────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw)              { setAuthError("Please login first"); setLoading(false); return; }
      const parsed = JSON.parse(raw);
      if (!parsed?.id)       { setAuthError("Invalid user data");  setLoading(false); return; }
      if (parsed.role !== "ADMIN") { setAuthError("Access denied: Admin access required"); setLoading(false); return; }
      setUser(parsed);
      setLoading(false);
    } catch {
      setAuthError("Login error");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadComplaints();
    loadWorkers();
  }, [user]);

  /* ── Data loaders ─────────────────────────────────────────────────────── */
  const loadComplaints = async () => {
    try {
      const data = await getAllComplaints();
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setComplaints(data);
    } catch (err) { console.error(err); }
  };

  const loadWorkers = async () => {
    try {
      const data = await getAllWorkers();
      setWorkers(data);
    } catch (err) { console.error(err); }
  };

  /* ── Complaint actions ────────────────────────────────────────────────── */
  const handleResolve = async (id) => {
    if (!window.confirm("Mark this complaint as resolved?")) return;
    setDeletingId(id);
    try {
      await deleteComplaint(id);
      setComplaints(complaints.map(c => c.id === id ? { ...c, status: "resolved" } : c));
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  /* ── Worker actions ───────────────────────────────────────────────────── */
  const handleDeleteWorker = async (id) => {
    if (!window.confirm("Remove this worker?")) return;
    setDeletingWorkerId(id);
    try {
      await deleteWorker(id);
      setWorkers(workers.filter(w => w.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeletingWorkerId(null); }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess(false);
    if (!newWorker.name || !newWorker.workerType) {
      setAddError("Name and worker type are required.");
      return;
    }
    try {
      const created = await createWorker(newWorker);
      setWorkers([...workers, created]);
      setNewWorker({ name: "", email: "", phone: "", workerType: "" });
      setShowAddForm(false);
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 3000);
    } catch (err) {
      setAddError(err.message || "Failed to add worker.");
    }
  };

  /* ── Derived stats ────────────────────────────────────────────────────── */
  const totalComplaints = complaints.length;
  const openComplaints  = complaints.filter(c => c.status === "open").length;
  const inProgComplaints = complaints.filter(c => c.status === "in_progress" || c.status === "in-progress").length;

  const idleWorkers = workers.filter(w => w.status === "IDLE").length;
  const busyWorkers = workers.filter(w => w.status === "BUSY").length;

  const filteredComplaints = complaints.filter(c => {
    const s = (c.status || "").toLowerCase();
    return compFilter === "all" || s === compFilter;
  });

  const filteredWorkers = workerFilter === "ALL"
    ? workers
    : workers.filter(w => w.workerType === workerFilter);

  /* ── Guards ───────────────────────────────────────────────────────────── */
  if (loading) return (
    <Layout><div className="p-10 text-center text-slate-500">Loading...</div></Layout>
  );

  if (authError) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 p-6 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-600">{authError}</p>
        </div>
      </div>
    </Layout>
  );

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Welcome */}
        {user && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Admin Panel</h2>
            <p className="text-slate-500">Welcome, {user.name || user.email}</p>
          </div>
        )}

        {/* ── Summary Stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow border text-center">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold">{totalComplaints}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl shadow border text-center">
            <p className="text-yellow-700 text-xs uppercase tracking-wide">Open</p>
            <p className="text-2xl font-bold text-yellow-600">{openComplaints}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl shadow border text-center">
            <p className="text-blue-700 text-xs uppercase tracking-wide">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{inProgComplaints}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl shadow border text-center">
            <p className="text-green-700 text-xs uppercase tracking-wide">Workers Idle</p>
            <p className="text-2xl font-bold text-green-600">{idleWorkers}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl shadow border text-center">
            <p className="text-red-700 text-xs uppercase tracking-wide">Workers Busy</p>
            <p className="text-2xl font-bold text-red-600">{busyWorkers}</p>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("complaints")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors
              ${activeTab === "complaints"
                ? "bg-white border border-b-white border-slate-200 text-blue-600 -mb-px"
                : "text-slate-500 hover:text-slate-700"}`}
          >
            <ClipboardList size={16} />
            Complaints
          </button>
          <button
            onClick={() => setActiveTab("workers")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors
              ${activeTab === "workers"
                ? "bg-white border border-b-white border-slate-200 text-blue-600 -mb-px"
                : "text-slate-500 hover:text-slate-700"}`}
          >
            <Users size={16} />
            Manage Workers
            <span className="ml-1 bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-xs">
              {workers.length}
            </span>
          </button>
        </div>

        <AnimatePresence mode="wait">

          {/* ════════════════ COMPLAINTS TAB ════════════════ */}
          {activeTab === "complaints" && (
            <motion.div
              key="complaints"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {/* Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                {["all", "open", "in_progress", "resolved"].map(f => (
                  <Button
                    key={f}
                    variant={compFilter === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompFilter(f)}
                  >
                    {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
              </div>

              {/* List */}
              <div className="space-y-4">
                {filteredComplaints.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No complaints in this category.</p>
                  </div>
                )}
                {filteredComplaints.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white p-5 rounded-xl shadow border hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {/* Badges row */}
                        <div className="flex flex-wrap gap-2 mb-2 items-center">
                          <span className="text-xs text-gray-400 font-mono">#{c.id}</span>
                          {getStatusBadge(c.status)}
                          {c.category && <Badge variant="secondary">{c.category}</Badge>}
                        </div>

                        <h3 className="font-bold text-base mb-1">{c.title}</h3>
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{c.description}</p>

                        <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-3">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(c.createdAt)}
                          </span>
                          {c.userId && <span>User ID: {c.userId}</span>}
                        </div>

                        {/* Worker assignment info */}
                        {c.assignedWorkerId ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg w-fit">
                            <User size={13} className="text-blue-600" />
                            <div>
                              <p className="text-xs text-blue-500 font-medium">Assigned to</p>
                              <p className="text-sm font-semibold text-blue-800">{c.workerName} <span className="font-normal text-blue-600">— {workerLabel(c.workerType)}</span></p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg w-fit">
                            <span className="text-xs text-amber-700">⏳ Pending worker assignment</span>
                          </div>
                        )}
                      </div>

                      {(c.status || "").toLowerCase() !== "resolved" && (
                        <Button
                          onClick={() => handleResolve(c.id)}
                          disabled={deletingId === c.id}
                          className="ml-4 self-start flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm"
                          size="sm"
                        >
                          <CheckCircle size={14} />
                          {deletingId === c.id ? "Resolving..." : "Resolve"}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ════════════════ WORKERS TAB ════════════════ */}
          {activeTab === "workers" && (
            <motion.div
              key="workers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {/* Header row */}
              <div className="flex justify-between items-center mb-5">
                <p className="text-slate-500 text-sm">
                  {workers.length} workers registered · {idleWorkers} idle · {busyWorkers} busy
                </p>
                <Button
                  onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
                  className="flex items-center gap-2"
                >
                  <UserPlus size={16} />
                  {showAddForm ? "Cancel" : "Add Worker"}
                </Button>
              </div>

              {/* Success toast */}
              <AnimatePresence>
                {addSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 flex items-center gap-2 bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg"
                  >
                    <CheckCircle size={16} />
                    Worker added successfully!
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Add Worker Form ──────────────────────────────────────── */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddWorker}
                    className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-6 overflow-hidden"
                  >
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Wrench size={18} />
                      Register New Worker
                    </h3>

                    {addError && (
                      <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                        <AlertCircle size={15} />
                        {addError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="w-name">Full Name *</Label>
                        <Input
                          id="w-name"
                          placeholder="e.g. Raju Kumar"
                          required
                          value={newWorker.name}
                          onChange={e => setNewWorker({ ...newWorker, name: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="w-type">Worker Type *</Label>
                        <Select
                          id="w-type"
                          required
                          value={newWorker.workerType}
                          onChange={e => setNewWorker({ ...newWorker, workerType: e.target.value })}
                        >
                          <option value="">Select worker type</option>
                          {WORKER_TYPES.map(wt => (
                            <option key={wt.value} value={wt.value}>
                              {wt.label} — handles &quot;{wt.category}&quot;
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="w-email">Email (optional)</Label>
                        <Input
                          id="w-email"
                          type="email"
                          placeholder="worker@example.com"
                          value={newWorker.email}
                          onChange={e => setNewWorker({ ...newWorker, email: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="w-phone">Phone (optional)</Label>
                        <Input
                          id="w-phone"
                          placeholder="9876543210"
                          value={newWorker.phone}
                          onChange={e => setNewWorker({ ...newWorker, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex gap-3">
                      <Button type="submit" className="flex items-center gap-2">
                        <UserPlus size={15} />
                        Add Worker
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* ── Worker type filter ───────────────────────────────────── */}
              <div className="flex flex-wrap gap-2 mb-5 overflow-x-auto pb-1">
                <Button
                  variant={workerFilter === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWorkerFilter("ALL")}
                >
                  All
                </Button>
                {WORKER_TYPES.map(wt => (
                  <Button
                    key={wt.value}
                    variant={workerFilter === wt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWorkerFilter(wt.value)}
                  >
                    {wt.label}
                  </Button>
                ))}
              </div>

              {/* ── Worker cards ─────────────────────────────────────────── */}
              {filteredWorkers.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No workers registered yet. Add one above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWorkers.map((w, i) => (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-blue-100 p-2 rounded-full">
                              <User size={16} className="text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{w.name}</p>
                              <p className="text-xs text-slate-400">ID #{w.id}</p>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 mb-1">
                            {workerLabel(w.workerType)}
                          </p>

                          {w.email && (
                            <p className="text-xs text-slate-400 truncate">{w.email}</p>
                          )}
                          {w.phone && (
                            <p className="text-xs text-slate-400">{w.phone}</p>
                          )}

                          <div className="flex items-center gap-3 mt-3">
                            {getWorkerStatusBadge(w.status)}
                            <span className="text-xs text-slate-500">
                              {w.tasksToday} / 5 tasks today
                            </span>
                          </div>

                          {/* Task progress bar */}
                          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                w.tasksToday >= 5 ? "bg-red-500" :
                                w.tasksToday >= 3 ? "bg-yellow-400" : "bg-green-500"
                              }`}
                              style={{ width: `${(w.tasksToday / 5) * 100}%` }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteWorker(w.id)}
                          disabled={deletingWorkerId === w.id}
                          className="ml-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove worker"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default Admin;
