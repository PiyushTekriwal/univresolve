import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { Clock, Tag, User, Wrench, HelpCircle, AlertTriangle, CheckCircle2, ShieldAlert, Hourglass } from 'lucide-react';
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

/* ── Duration formatters ────────────────────────────────────────────────── */
// For unresolved complaints:
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

// For resolved complaints:
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

/* ── Date-time formatter (DD-MM-YYYY, hh:mm A) ──────────────────────────── */
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

  /* ── Priority badge ───────────────────────────────────────────────────── */
  const getPriorityBadge = (prio, originalPrio) => {
    const p = (prio || "LOW").toUpperCase();
    const isEscalated = originalPrio && originalPrio.toUpperCase() !== p;

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

  /* ── SLA badge (Always RESOLVED if complaint is resolved) ─────────────── */
  const getSlaBadge = (slaStatus, complaintStatus) => {
    const isResolved = (complaintStatus || "").toLowerCase() === "resolved";
    const s = (slaStatus || "").toUpperCase();

    if (isResolved || s === "RESOLVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={12} /> RESOLVED
        </span>
      );
    }
    if (s === "BREACHED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300">
          <ShieldAlert size={12} /> BREACHED
        </span>
      );
    }
    if (s === "WARNING") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle size={12} /> WARNING (75%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Clock size={12} /> ON_TRACK
      </span>
    );
  };

  const filteredComplaints = complaints.filter(c => {
    const status = (c.status || "").toLowerCase();
    const matchesFilter = filter === "all" || status === filter;
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  /* ── Border colour by status and priority ─────────────────────────────── */
  const borderColour = (c) => {
    const s = (c.status || "").toLowerCase();
    if (s === "resolved") return "border-green-500";
    if (c.slaStatus === "BREACHED") return "border-red-600";
    const p = (c.effectivePriority || "").toUpperCase();
    if (p === "CRITICAL") return "border-red-500";
    if (p === "HIGH")     return "border-orange-500";
    if (s === "in_progress" || s === "in-progress") return "border-blue-400";
    if (s === "open")        return "border-yellow-400";
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
            <p className="text-slate-500">Track complaint status, priority, and estimated resolution time</p>
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
              className={`p-6 rounded-xl shadow border-l-4 bg-white ${borderColour(c)}`}
            >
              <div className="flex justify-between items-start">

                <div className="flex-1">
                  {/* Badges row: ID, Status, Priority, SLA Status */}
                  <div className="flex flex-wrap gap-2 mb-2 items-center">
                    <span className="text-sm text-gray-500 font-mono font-semibold">#{c.id}</span>
                    {getStatusBadge(c.status)}
                    {getPriorityBadge(c.effectivePriority || c.originalPriority, c.originalPriority)}
                    {getSlaBadge(c.slaStatus, c.status)}
                    {(c.status || "").toLowerCase() !== "resolved" && getAssignmentBadge(c.assignmentStatus)}
                  </div>

                  <h3 className="font-bold text-lg mb-1">{c.title}</h3>

                  {/* Category + date */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Tag size={14} />
                      {c.category}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      Filed: {formatDateTime(c.createdAt)}
                    </div>
                  </div>

                  {/* ── SLA & Resolution Highlights Box ─────────── */}
                  {c.status === "resolved" ? (
                    /* Resolved complaint display:
                       PRIORITY: LOW | RESOLUTION: Resolved | RESOLVED ON: 02-11-2026, 04:35 PM | ACTUAL RESOLUTION TIME: 3 hours | SLA STATUS: RESOLVED */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 my-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 text-xs">
                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">Priority</p>
                        <p className="font-bold text-slate-800 text-sm">
                          {c.effectivePriority || c.originalPriority || "LOW"}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">Resolution</p>
                        <p className="font-bold text-emerald-700 text-sm flex items-center gap-1">
                          <CheckCircle2 size={14} />
                          Resolved
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">Resolved On</p>
                        <p className="font-bold text-slate-800 text-sm">
                          {formatDateTime(c.resolvedAt || c.createdAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">Actual Resolution Time</p>
                        <p className="font-bold text-blue-700 text-sm flex items-center gap-1">
                          <Hourglass size={14} />
                          {formatActualDuration(c.actualResolutionMinutes)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">SLA Status</p>
                        <div className="mt-1">
                          {getSlaBadge("RESOLVED", "resolved")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Unresolved complaint display:
                       PRIORITY: HIGH | ESTIMATED RESOLUTION: 6 hours remaining | SLA TARGET: 8 hours | SLA STATUS: ON_TRACK */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 my-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">Priority</p>
                        <p className="font-bold text-slate-800 text-sm">
                          {c.effectivePriority || c.originalPriority || "LOW"}
                          {c.agingScore > 0 && <span className="ml-1 text-slate-400 text-xs">(Aging: +{c.agingScore} pts)</span>}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">Estimated Resolution</p>
                        <p className="font-bold text-blue-700 text-sm flex items-center gap-1">
                          <Hourglass size={14} />
                          {formatRemainingDuration(c.estimatedRemainingMinutes)}
                        </p>
                        {c.estimatedResolutionAt && (
                          <p className="text-[11px] text-slate-500 mt-0.5">Expected: {formatDateTime(c.estimatedResolutionAt)}</p>
                        )}
                        {c.predictionMethod && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{c.predictionMethod}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">SLA Target</p>
                        <p className="font-bold text-slate-800 text-sm">
                          {c.slaTargetHours || 48} hours
                        </p>
                        {c.slaDueAt && (
                          <p className={`text-[11px] font-medium mt-0.5 ${c.slaStatus === 'BREACHED' ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                            Due: {formatDateTime(c.slaDueAt)}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-slate-400 font-medium uppercase tracking-wider">SLA Status</p>
                        <div className="mt-1">
                          {getSlaBadge(c.slaStatus, c.status)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Escalation notice if starvation prevention kicked in */}
                  {c.escalationReason && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700 mb-2 w-fit">
                      <AlertTriangle size={13} className="text-purple-600" />
                      <span>{c.escalationReason}</span>
                    </div>
                  )}

                  {/* ── Assigned worker card (Hidden on resolved complaints if unassigned) ─────────────── */}
                  {c.assignedWorkerId ? (
                    <div className="flex items-center gap-3 mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg w-fit">
                      <div className="bg-blue-100 p-1.5 rounded-full">
                        <User size={14} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">
                          {c.status === "resolved" ? "Handled by Worker" : "Assigned Worker"}
                        </p>
                        <p className="text-sm font-semibold text-blue-800">{c.workerName}</p>
                        <p className="text-xs text-blue-600">{workerLabel(c.workerType)}</p>
                      </div>
                    </div>
                  ) : c.status !== "resolved" ? (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg w-fit">
                      <HelpCircle size={14} className="text-yellow-500" />
                      <p className="text-xs text-yellow-700">
                        Awaiting worker assignment — you'll be assigned as soon as a {c.workerType ? workerLabel(c.workerType) : "worker"} is available.
                      </p>
                    </div>
                  ) : null}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-4 self-start"
                  onClick={() => setSelectedComplaint(c)}
                >
                  View Details
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

            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-gray-400 text-xs font-mono">Complaint ID: #{selectedComplaint.id}</span>
                <h2 className="text-xl font-bold">{selectedComplaint.title}</h2>
              </div>
              {getStatusBadge(selectedComplaint.status)}
            </div>

            <p className="text-gray-400 text-xs mb-3">Submitted on {formatDateTime(selectedComplaint.createdAt)}</p>

            <p className="text-gray-600 mb-4 bg-slate-50 p-3 rounded-lg border text-sm">{selectedComplaint.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {getPriorityBadge(selectedComplaint.effectivePriority || selectedComplaint.originalPriority, selectedComplaint.originalPriority)}
              {getSlaBadge(selectedComplaint.slaStatus, selectedComplaint.status)}
              {selectedComplaint.status !== "resolved" && getAssignmentBadge(selectedComplaint.assignmentStatus)}
              <Badge variant="secondary">{selectedComplaint.category}</Badge>
            </div>

            {/* Comprehensive SLA & Priority Details */}
            {selectedComplaint.status === "resolved" ? (
              <div className="mb-4 p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2 text-sm">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Resolution & SLA Details</h4>
                <div className="flex justify-between py-1 border-b border-emerald-100 text-xs">
                  <span className="text-slate-500">Priority:</span>
                  <span className="font-bold">{selectedComplaint.effectivePriority || selectedComplaint.originalPriority || "LOW"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100 text-xs">
                  <span className="text-slate-500">Resolution:</span>
                  <span className="font-bold text-emerald-700">Resolved</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100 text-xs">
                  <span className="text-slate-500">Resolved On:</span>
                  <span className="font-semibold text-slate-800">{formatDateTime(selectedComplaint.resolvedAt || selectedComplaint.createdAt)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100 text-xs">
                  <span className="text-slate-500">Actual Resolution Time:</span>
                  <span className="font-bold text-blue-700">{formatActualDuration(selectedComplaint.actualResolutionMinutes)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100 text-xs">
                  <span className="text-slate-500">SLA Target Duration:</span>
                  <span>{selectedComplaint.slaTargetHours || 48} Hours</span>
                </div>
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-slate-500">SLA Status:</span>
                  <span className="font-bold text-emerald-700">RESOLVED</span>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">SLA & Priority Details</h4>
                <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span className="text-slate-500">Effective Priority:</span>
                  <span className="font-bold">{selectedComplaint.effectivePriority || selectedComplaint.originalPriority || "LOW"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span className="text-slate-500">Original Priority:</span>
                  <span>{selectedComplaint.originalPriority || "LOW"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span className="text-slate-500">Priority Score / Aging Score:</span>
                  <span>{selectedComplaint.priorityScore || 0} pts + {selectedComplaint.agingScore || 0} aging</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span className="text-slate-500">SLA Target Duration:</span>
                  <span className="font-semibold">{selectedComplaint.slaTargetHours || 48} Hours</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span className="text-slate-500">SLA Deadline:</span>
                  <span className="font-semibold">{selectedComplaint.slaDueAt ? formatDateTime(selectedComplaint.slaDueAt) : "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                  <span className="text-slate-500">Estimated Resolution Time:</span>
                  <span className="font-bold text-blue-700">
                    {formatRemainingDuration(selectedComplaint.estimatedRemainingMinutes)}
                  </span>
                </div>
                {selectedComplaint.estimatedResolutionAt && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-xs">
                    <span className="text-slate-500">Expected Resolution:</span>
                    <span className="font-medium text-slate-700">{formatDateTime(selectedComplaint.estimatedResolutionAt)}</span>
                  </div>
                )}
                {selectedComplaint.predictionMethod && (
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-slate-500">Prediction Method:</span>
                    <span className="font-mono text-slate-600">{selectedComplaint.predictionMethod}</span>
                  </div>
                )}
              </div>
            )}

            {/* Worker details in modal */}
            {selectedComplaint.assignedWorkerId ? (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench size={16} className="text-blue-600" />
                  <p className="font-semibold text-blue-800 text-sm">
                    {selectedComplaint.status === "resolved" ? "Handled by Worker" : "Assigned Worker"}
                  </p>
                </div>
                <p className="text-base font-bold text-blue-900">{selectedComplaint.workerName}</p>
                <p className="text-sm text-blue-700">{workerLabel(selectedComplaint.workerType)}</p>
              </div>
            ) : selectedComplaint.status !== "resolved" ? (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800">
                  🕐 <strong>Pending Assignment</strong> — All workers of this type are currently busy. You will be automatically assigned a worker as soon as one becomes available.
                </p>
              </div>
            ) : null}

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
