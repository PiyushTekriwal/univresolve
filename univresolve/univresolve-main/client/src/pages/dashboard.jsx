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

  const getPriorityBadge = (priority) => {
    const p = (priority || "MEDIUM").toUpperCase();
    if (p === "CRITICAL") return <Badge variant="critical">CRITICAL</Badge>;
    if (p === "HIGH") return <Badge variant="danger">HIGH</Badge>;
    if (p === "MEDIUM") return <Badge variant="warning">MEDIUM</Badge>;
    return <Badge variant="default">LOW</Badge>;
  };

  const getSlaBadge = (slaStatus) => {
    const s = (slaStatus || "ON_TRACK").toUpperCase();
    if (s === "OVERDUE") return <Badge variant="danger">OVERDUE</Badge>;
    if (s === "AT_RISK") return <Badge variant="warning">AT RISK</Badge>;
    return <Badge variant="success">ON TRACK</Badge>;
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
              className={`p-6 rounded-xl shadow border-l-4 transition-all ${
                c.status === "resolved"
                  ? "border-green-500"
                  : c.slaStatus === "OVERDUE" || c.isOverdue
                  ? "border-red-500 bg-red-50/10"
                  : c.slaStatus === "AT_RISK"
                  ? "border-amber-500 bg-amber-50/10"
                  : "border-yellow-400"
              }`}
            >

              <div className="flex justify-between">

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-500">#{c.id}</span>
                    {getStatusBadge(c.status)}
                    {getPriorityBadge(c.priority)}
                    {c.status === "open" && getSlaBadge(c.slaStatus)}
                  </div>

                  <h3 className="font-bold text-lg text-slate-800">{c.title}</h3>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                    <div className="flex items-center gap-1">
                      <Tag size={14} />
                      <span className="capitalize">{c.category}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>Submitted: {formatDate(c.createdAt)}</span>
                    </div>

                    {c.status === "open" && c.estimatedResolutionTime && (
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${
                        c.isOverdue || c.overdueHours > 0 || c.slaStatus === 'OVERDUE'
                          ? "bg-red-50 text-red-700 border-red-200"
                          : c.slaStatus === 'AT_RISK'
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-primary-50 text-primary-700 border-primary-200"
                      }`}>
                        <span>Est. Resolution: {formatDate(c.estimatedResolutionTime)}</span>
                        {c.remainingTimeFormatted ? (
                          <span className="font-semibold">({c.remainingTimeFormatted})</span>
                        ) : c.overdueHours > 0 ? (
                          <span className="font-semibold text-red-700">(Overdue by {c.overdueHours}h)</span>
                        ) : c.remainingHours != null && c.remainingHours > 0 ? (
                          <span>(~{c.remainingHours}h remaining)</span>
                        ) : null}
                      </div>
                    )}
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">

          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl space-y-4">

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400 font-mono">#{selectedComplaint.id}</span>
                <div className="flex gap-2">
                  {getStatusBadge(selectedComplaint.status)}
                  {getPriorityBadge(selectedComplaint.priority)}
                  {selectedComplaint.status === "open" && getSlaBadge(selectedComplaint.slaStatus)}
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedComplaint.title}
              </h2>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
              {selectedComplaint.description}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border">
              <div>
                <span className="text-gray-500 block">Category:</span>
                <span className="font-semibold capitalize text-slate-800">{selectedComplaint.category}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Submitted At:</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedComplaint.createdAt)}</span>
              </div>
              {selectedComplaint.status === "open" && (
                <>
                  <div>
                    <span className="text-gray-500 block">SLA Target Deadline:</span>
                    <span className={`font-semibold ${selectedComplaint.slaStatus === 'OVERDUE' ? 'text-red-600' : 'text-slate-800'}`}>
                      {selectedComplaint.slaDeadline ? formatDate(selectedComplaint.slaDeadline) : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Estimated Resolution:</span>
                    <span className={`font-semibold ${selectedComplaint.isOverdue || selectedComplaint.overdueHours > 0 ? "text-red-600" : "text-primary-700"}`}>
                      {selectedComplaint.estimatedResolutionTime ? formatDate(selectedComplaint.estimatedResolutionTime) : "Calculating..."}
                      {selectedComplaint.remainingTimeFormatted ? ` (${selectedComplaint.remainingTimeFormatted})` : ""}
                    </span>
                  </div>
                </>
              )}
            </div>

            {selectedComplaint.estimateExplanation && (
              <p className="text-xs text-slate-500 italic">
                * Note: {selectedComplaint.estimateExplanation}. Resolution time is an automated estimate and not a contractually guaranteed deadline.
              </p>
            )}

            {/* 🔥 ADMIN ONLY */}
            {isAdmin && selectedComplaint.status === "open" && (
              <Button
                className="w-full mt-2"
                onClick={() => resolveIssue(selectedComplaint.id)}
              >
                Mark as Resolved
              </Button>
            )}

            <div className="mt-4 text-right">
              <Button variant="outline" onClick={() => setSelectedComplaint(null)}>
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