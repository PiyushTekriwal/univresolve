import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, AlertCircle, Users, ClipboardList,
  UserPlus, CheckCircle, Wrench, User, Clock, Tag,
  RefreshCw, AlertTriangle, ShieldAlert, Hourglass, Flame, TrendingUp
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAllComplaints, deleteComplaint, getAllWorkers, createWorker, deleteWorker, recalculateSla } from '../services/api';

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

const formatRemainingDuration = (minutes) => {
  if (minutes == null || isNaN(minutes)) {
    return "Estimated resolution currently unavailable.";
  }
  if (minutes <= 0) return "0 hours remaining";
  if (minutes < 60) return `${minutes} minutes remaining`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hrs < 24) {
    return rem === 0 ? `${hrs} hours remaining` : `${hrs}h ${rem}m remaining`;
  }
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs === 0
    ? `${days} ${days === 1 ? "day" : "days"} remaining`
    : `${days} ${days === 1 ? "day" : "days"} ${remHrs} hours remaining`;
};

const formatActualDuration = (minutes) => {
  if (minutes == null || isNaN(minutes)) {
    return "Duration unavailable";
  }
  if (minutes <= 0) return "< 1 hour";
  if (minutes < 60) return `${minutes} minutes`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hrs < 24) {
    return rem === 0 ? `${hrs} hours` : `${hrs}h ${rem}m`;
  }
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs === 0
    ? `${days} ${days === 1 ? "day" : "days"}`
    : `${days} ${days === 1 ? "day" : "days"} ${remHrs} hours`;
};

const formatDuration = (minutes) => formatActualDuration(minutes);

/* ── Status helpers ──────────────────────────────────────────────────────── */
const getStatusBadge = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "open")        return <Badge variant="warning">Open</Badge>;
  if (s === "in_progress" || s === "in-progress")
                           return <Badge variant="primary">In Progress</Badge>;
  if (s === "resolved")    return <Badge variant="success">Resolved</Badge>;
  return <Badge>Unknown</Badge>;
};

const getPriorityBadge = (prio, origPrio) => {
  const p = (prio || "LOW").toUpperCase();
  const isEscalated = origPrio && origPrio.toUpperCase() !== p;

  if (p === "CRITICAL") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm">
        🚨 CRITICAL {isEscalated && <span className="bg-red-800 px-1 rounded text-[10px]">Escalated</span>}
      </span>
    );
  }
  if (p === "HIGH") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
        🔥 HIGH {isEscalated && <span className="bg-orange-200 px-1 rounded text-[10px]">Escalated</span>}
      </span>
    );
  }
  if (p === "MEDIUM") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
        ⚡ MEDIUM {isEscalated && <span className="bg-yellow-200 px-1 rounded text-[10px]">Escalated</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      🟢 LOW
    </span>
  );
};

const getSlaBadge = (slaStatus, complaintStatus) => {
  const isResolved = (complaintStatus || "").toLowerCase() === "resolved";
  const s = (slaStatus || "").toUpperCase();

  if (isResolved || s === "RESOLVED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle size={12} /> RESOLVED
      </span>
    );
  }
  if (s === "BREACHED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300">
        <ShieldAlert size={12} /> BREACHED
      </span>
    );
  }
  if (s === "WARNING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
        <AlertTriangle size={12} /> WARNING (75%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Clock size={12} /> ON TRACK
    </span>
  );
};

const getWorkerStatusBadge = (status) => {
  if (status === "IDLE")  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">● Idle</span>;
  if (status === "BUSY")  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">● Busy</span>;
  return null;
};

const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, "0");
  return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`;
};

const formatDate = (date) => formatDateTime(date);

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
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState(false);

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
      setComplaints(complaints.map(c => c.id === id ? { ...c, status: "resolved", slaStatus: "RESOLVED" } : c));
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  const handleRecalculateSla = async () => {
    setIsRecalculating(true);
    setRecalcSuccess(false);
    try {
      const res = await recalculateSla();
      if (res && res.fairQueue) {
        setComplaints(res.fairQueue);
      } else {
        await loadComplaints();
      }
      setRecalcSuccess(true);
      setTimeout(() => setRecalcSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Recalculation error: " + (err.message || "Failed to contact SLA engine"));
    } finally {
      setIsRecalculating(false);
    }
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
  const resolvedComplaints = complaints.filter(c => c.status === "resolved").length;

  // Active (unresolved)
  const activeComplaints = complaints.filter(c => c.status !== "resolved");

  // Priority counts (unresolved)
  const criticalCount = activeComplaints.filter(c => (c.effectivePriority || c.originalPriority) === "CRITICAL").length;
  const highCount     = activeComplaints.filter(c => (c.effectivePriority || c.originalPriority) === "HIGH").length;
  const mediumCount   = activeComplaints.filter(c => (c.effectivePriority || c.originalPriority) === "MEDIUM").length;
  const lowCount      = activeComplaints.filter(c => (c.effectivePriority || c.originalPriority) === "LOW").length;

  // SLA counts (unresolved)
  const onTrackCount  = activeComplaints.filter(c => c.slaStatus === "ON_TRACK").length;
  const warningCount  = activeComplaints.filter(c => c.slaStatus === "WARNING").length;
  const breachedCount = activeComplaints.filter(c => c.slaStatus === "BREACHED").length;
  const escalatedCount = activeComplaints.filter(c => c.effectivePriority && c.originalPriority && c.effectivePriority !== c.originalPriority).length;

  // Oldest unresolved complaints
  const oldestUnresolved = [...activeComplaints]
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .slice(0, 3);

  const idleWorkers = workers.filter(w => w.status === "IDLE").length;
  const busyWorkers = workers.filter(w => w.status === "BUSY").length;

  const filteredComplaints = complaints.filter(c => {
    const s = (c.status || "").toLowerCase();
    const p = (c.effectivePriority || c.originalPriority || "").toUpperCase();
    const sla = (c.slaStatus || "").toUpperCase();

    if (compFilter === "all") return true;
    if (compFilter === "open") return s === "open";
    if (compFilter === "in_progress") return s === "in_progress" || s === "in-progress";
    if (compFilter === "resolved") return s === "resolved";
    if (compFilter === "critical_high") return s !== "resolved" && (p === "CRITICAL" || p === "HIGH");
    if (compFilter === "breached") return s !== "resolved" && sla === "BREACHED";
    if (compFilter === "warning") return s !== "resolved" && sla === "WARNING";
    if (compFilter === "escalated") return s !== "resolved" && c.effectivePriority !== c.originalPriority;
    return true;
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

        {/* Welcome & Actions Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold">Admin Management Panel</h2>
            <p className="text-slate-500">Fair Priority Queue · SLA Monitoring · Starvation Prevention</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRecalculating}
              onClick={handleRecalculateSla}
              className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <RefreshCw size={14} className={isRecalculating ? "animate-spin" : ""} />
              {isRecalculating ? "Recalculating..." : "Recalculate SLA & Aging"}
            </Button>
          </div>
        </div>

        {/* Toast for recalculate */}
        <AnimatePresence>
          {recalcSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl text-sm"
            >
              <CheckCircle size={16} />
              SLA, aging points, starvation prevention and estimated resolution times updated successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Summary Stats: Lifecycle & Operational Row ─────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          <div className="bg-white p-3.5 rounded-xl shadow-sm border text-center">
            <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Total Complaints</p>
            <p className="text-2xl font-bold text-slate-900">{totalComplaints}</p>
          </div>
          <div className="bg-yellow-50 p-3.5 rounded-xl shadow-sm border border-yellow-200 text-center">
            <p className="text-yellow-700 text-[11px] uppercase tracking-wider font-semibold">Open</p>
            <p className="text-2xl font-bold text-yellow-700">{openComplaints}</p>
          </div>
          <div className="bg-blue-50 p-3.5 rounded-xl shadow-sm border border-blue-200 text-center">
            <p className="text-blue-700 text-[11px] uppercase tracking-wider font-semibold">In Progress</p>
            <p className="text-2xl font-bold text-blue-700">{inProgComplaints}</p>
          </div>
          <div className="bg-emerald-50 p-3.5 rounded-xl shadow-sm border border-emerald-200 text-center">
            <p className="text-emerald-700 text-[11px] uppercase tracking-wider font-semibold">Resolved</p>
            <p className="text-2xl font-bold text-emerald-700">{resolvedComplaints}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl shadow-sm border text-center">
            <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Idle Workers</p>
            <p className="text-2xl font-bold text-slate-700">{idleWorkers}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl shadow-sm border text-center">
            <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Busy Workers</p>
            <p className="text-2xl font-bold text-slate-700">{busyWorkers}</p>
          </div>
        </div>

        {/* ── Priority & SLA Monitoring Stats Row ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 mb-8">
          {/* Priority breakdown */}
          <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center">
            <p className="text-red-700 text-[10px] uppercase tracking-wider font-bold">Critical</p>
            <p className="text-xl font-extrabold text-red-700">{criticalCount}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 text-center">
            <p className="text-orange-700 text-[10px] uppercase tracking-wider font-bold">High</p>
            <p className="text-xl font-extrabold text-orange-700">{highCount}</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
            <p className="text-amber-700 text-[10px] uppercase tracking-wider font-bold">Medium</p>
            <p className="text-xl font-extrabold text-amber-700">{mediumCount}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-slate-600 text-[10px] uppercase tracking-wider font-bold">Low</p>
            <p className="text-xl font-extrabold text-slate-700">{lowCount}</p>
          </div>

          {/* SLA breakdown */}
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
            <p className="text-emerald-700 text-[10px] uppercase tracking-wider font-bold">SLA On Track</p>
            <p className="text-xl font-extrabold text-emerald-700">{onTrackCount}</p>
          </div>
          <div className="bg-amber-100 p-3 rounded-xl border border-amber-300 text-center">
            <p className="text-amber-800 text-[10px] uppercase tracking-wider font-bold">SLA Warning</p>
            <p className="text-xl font-extrabold text-amber-800">{warningCount}</p>
          </div>
          <div className="bg-red-100 p-3 rounded-xl border border-red-300 text-center">
            <p className="text-red-800 text-[10px] uppercase tracking-wider font-bold">SLA Breached</p>
            <p className="text-xl font-extrabold text-red-800">{breachedCount}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-center">
            <p className="text-purple-700 text-[10px] uppercase tracking-wider font-bold">Escalated</p>
            <p className="text-xl font-extrabold text-purple-700">{escalatedCount}</p>
          </div>
        </div>

        {/* ── Urgent Attention: Oldest Unresolved & Breached Alert ───────── */}
        {oldestUnresolved.length > 0 && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2 font-bold text-amber-900 text-sm">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>Priority Starvation Monitor — Oldest Unresolved Complaints</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {oldestUnresolved.map(o => (
                <div key={o.id} className="p-3 bg-white rounded-lg border border-amber-200 text-xs shadow-sm flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-mono font-bold text-slate-500">#{o.id}</span>
                      {getPriorityBadge(o.effectivePriority || o.originalPriority, o.originalPriority)}
                      {getSlaBadge(o.slaStatus)}
                    </div>
                    <p className="font-semibold text-slate-900 truncate max-w-[200px]">{o.title}</p>
                    <p className="text-slate-400 mt-1">Submitted: {formatDate(o.createdAt)}</p>
                    {o.agingScore > 0 && <p className="text-purple-600 font-medium">Aging Score: +{o.agingScore} pts</p>}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(o.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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
            Complaints Fair Queue
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
              {/* Comprehensive Filters */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { id: "all", label: "All Complaints" },
                  { id: "open", label: "Open" },
                  { id: "in_progress", label: "In Progress" },
                  { id: "critical_high", label: "🔥 Critical & High" },
                  { id: "breached", label: "💥 SLA Breached" },
                  { id: "warning", label: "⚠️ SLA Warning" },
                  { id: "escalated", label: "⚡ Aging Escalated" },
                  { id: "resolved", label: "✓ Resolved" }
                ].map(f => (
                  <Button
                    key={f.id}
                    variant={compFilter === f.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompFilter(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              {/* List */}
              <div className="space-y-4">
                {filteredComplaints.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No complaints matching this filter.</p>
                  </div>
                )}
                {filteredComplaints.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-white p-5 rounded-xl shadow-sm border hover:shadow-md transition-shadow border-l-4 ${
                      c.status === "resolved" ? "border-l-emerald-500" :
                      c.slaStatus === "BREACHED" ? "border-l-red-600" :
                      (c.effectivePriority === "CRITICAL") ? "border-l-red-500" :
                      (c.effectivePriority === "HIGH") ? "border-l-orange-500" :
                      "border-l-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        {/* Badges row */}
                        <div className="flex flex-wrap gap-2 mb-2 items-center">
                          <span className="text-xs text-gray-500 font-mono font-bold">#{c.id}</span>
                          {getStatusBadge(c.status)}
                          {getPriorityBadge(c.effectivePriority || c.originalPriority, c.originalPriority)}
                          {getSlaBadge(c.slaStatus, c.status)}
                          {c.category && <Badge variant="secondary">{c.category}</Badge>}
                          {c.agingScore > 0 && c.status !== "resolved" && (
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Aging: +{c.agingScore} pts
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-base mb-1 text-slate-900">{c.title}</h3>
                        <p className="text-sm text-slate-600 mb-3">{c.description}</p>

                        {/* SLA & Time Grid */}
                        {c.status === "resolved" ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 my-2 p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-200 text-xs">
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Priority</span>
                              <span className="font-bold text-slate-800">{c.effectivePriority || c.originalPriority || "LOW"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Resolved On</span>
                              <span className="font-semibold text-slate-800">{formatDateTime(c.resolvedAt || c.createdAt)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Actual Resolution Time</span>
                              <span className="font-bold text-blue-700 flex items-center gap-1">
                                <Hourglass size={12} />
                                {formatActualDuration(c.actualResolutionMinutes)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">SLA Status</span>
                              <span className="font-bold text-emerald-700">RESOLVED</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 my-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Estimated Resolution</span>
                              <span className="font-bold text-blue-700 flex items-center gap-1">
                                <Hourglass size={12} />
                                {formatRemainingDuration(c.estimatedRemainingMinutes)}
                              </span>
                              {c.estimatedResolutionAt && (
                                <span className="text-[10px] text-slate-500 block">By {formatDateTime(c.estimatedResolutionAt)}</span>
                              )}
                              {c.predictionMethod && (
                                <span className="text-[9px] text-slate-400 block font-mono">{c.predictionMethod}</span>
                              )}
                            </div>

                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">SLA Target</span>
                              <span className="font-semibold text-slate-800">{c.slaTargetHours || 48} Hours Target</span>
                            </div>

                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">SLA Due Date</span>
                              <span className={`font-semibold ${c.slaStatus === 'BREACHED' ? 'text-red-600' : 'text-slate-800'}`}>
                                {c.slaDueAt ? formatDateTime(c.slaDueAt) : "—"}
                              </span>
                            </div>

                            <div>
                              <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Submitted</span>
                              <span className="text-slate-700">{formatDateTime(c.createdAt)}</span>
                            </div>
                          </div>
                        )}

                        {/* Starvation / Escalation notice */}
                        {c.escalationReason && c.status !== "resolved" && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 rounded text-xs text-purple-800 mb-2 w-fit">
                            <TrendingUp size={13} className="text-purple-600" />
                            <span>{c.escalationReason}</span>
                          </div>
                        )}

                        {/* Worker assignment info */}
                        {c.assignedWorkerId ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg w-fit mt-1">
                            <User size={13} className="text-blue-600" />
                            <div>
                              <p className="text-xs text-blue-800 font-semibold">
                                {c.status === "resolved" ? "Handled by " : ""}{c.workerName}{" "}
                                <span className="font-normal text-blue-600">— {workerLabel(c.workerType)}</span>
                              </p>
                            </div>
                          </div>
                        ) : c.status !== "resolved" ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg w-fit mt-1">
                            <span className="text-xs text-amber-700">⏳ Pending worker assignment</span>
                          </div>
                        ) : null}
                      </div>

                      {(c.status || "").toLowerCase() !== "resolved" && (
                        <Button
                          onClick={() => handleResolve(c.id)}
                          disabled={deletingId === c.id}
                          className="ml-4 self-start flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
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
