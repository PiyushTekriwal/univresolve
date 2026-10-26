import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Clock, Flame, ShieldAlert, ArrowUpRight } from "lucide-react";

const AdminDashboard = () => {

  const [issues, setIssues] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch all complaints (open ranked by anti-starvation score)
      const res = await fetch("/api/issues/admin");
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }

      // Fetch live analytics
      const analyticsRes = await fetch("/api/issues/analytics");
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (err) {
      console.error("ADMIN ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const resolveIssue = async (id) => {
    await fetch(`/api/issues/${id}`, { method: "DELETE" });
    loadData();
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
    return isNaN(d) ? date : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = issues.filter(i => {
    const s = (i.status || "").toLowerCase();
    return filter === "all" || s === filter;
  });

  const total = issues.length;
  const open = issues.filter(i => (i.status || "").toLowerCase() === "open").length;
  const resolved = issues.filter(i => (i.status || "").toLowerCase() === "resolved").length;

  return (
    <Layout>

      <div className="max-w-7xl mx-auto px-4 py-10">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dispatch & Scheduling Queue</h1>
            <p className="text-slate-500 text-sm">Anti-starvation queue prioritizing urgent complaints and escalating aging tickets</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>Refresh Queue</Button>
        </div>

        {/* 📊 SUMMARY METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-5 rounded-xl shadow-sm bg-white border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Filed</p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">{total}</h2>
            <div className="flex gap-2 text-xs text-slate-500 mt-2">
              <span className="text-amber-600 font-semibold">{open} Open</span>
              <span>•</span>
              <span className="text-green-600 font-semibold">{resolved} Resolved</span>
            </div>
          </div>

          <div className="p-5 rounded-xl shadow-sm bg-white border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Priority Distribution</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 font-bold">
                Crit: {analytics?.priorityDistribution?.CRITICAL || 0}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 font-semibold">
                High: {analytics?.priorityDistribution?.HIGH || 0}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700">
                Med: {analytics?.priorityDistribution?.MEDIUM || 0}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                Low: {analytics?.priorityDistribution?.LOW || 0}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl shadow-sm bg-white border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">SLA Compliance</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 font-semibold">
                On Track: {analytics?.slaStatusDistribution?.ON_TRACK || 0}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 font-semibold">
                At Risk: {analytics?.slaStatusDistribution?.AT_RISK || 0}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 font-bold">
                Overdue: {analytics?.slaStatusDistribution?.OVERDUE || 0}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl shadow-sm bg-white border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Historical Resolution Avg</p>
            {analytics?.basedOnRealHistoricalData ? (
              <div className="mt-1">
                <span className="text-2xl font-bold text-slate-900">{analytics.averageResolutionHours}h</span>
                <span className="text-xs text-slate-400 block mt-1">Median: {analytics.medianResolutionHours}h</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 italic">
                Awaiting completed resolution history (SLA baseline active)
              </div>
            )}
          </div>
        </div>

        {/* ⏳ AGING BACKLOG BREAKDOWN */}
        {analytics?.agingBacklog && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-2">
              Open Complaints Waiting Backlog (Anti-Starvation Aging Bands)
            </span>
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div className="bg-white p-2 rounded border">
                <span className="text-slate-500 block">&lt; 12 hours</span>
                <span className="text-base font-bold text-slate-800">{analytics.agingBacklog["< 12h"]}</span>
              </div>
              <div className="bg-white p-2 rounded border">
                <span className="text-slate-500 block">12 - 24 hours</span>
                <span className="text-base font-bold text-amber-700">{analytics.agingBacklog["12-24h"]}</span>
              </div>
              <div className="bg-white p-2 rounded border">
                <span className="text-slate-500 block">24 - 48 hours</span>
                <span className="text-base font-bold text-orange-700">{analytics.agingBacklog["24-48h"]}</span>
              </div>
              <div className="bg-white p-2 rounded border">
                <span className="text-slate-500 block">&gt; 48 hours (Boosted)</span>
                <span className="text-base font-bold text-red-700">{analytics.agingBacklog["> 48h"]}</span>
              </div>
            </div>
          </div>
        )}

        {/* 🎯 FILTER */}
        <div className="flex gap-2 mb-6">
          {["all", "open", "resolved"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* 📋 QUEUE LIST */}
        <div className="space-y-4">

          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading queue...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl border">No complaints found.</div>
          ) : (
            filtered.map((issue, index) => {
              const isOpen = (issue.status || "").toLowerCase() === "open";
              const isOverdue = issue.slaStatus === "OVERDUE";
              const isAtRisk = issue.slaStatus === "AT_RISK";
              const isCritical = (issue.priority || "").toUpperCase() === "CRITICAL";

              return (
                <div
                  key={issue.id}
                  className={`p-5 bg-white shadow-sm rounded-xl border transition-all ${
                    isCritical
                      ? "border-red-400 bg-red-50/20 ring-1 ring-red-400"
                      : isOverdue
                      ? "border-amber-400 bg-amber-50/20"
                      : "border-slate-200"
                  } flex flex-col md:flex-row justify-between gap-4`}
                >

                  <div className="space-y-2 flex-1">

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">#{issue.id}</span>
                      {isOpen && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 text-white">
                          Queue Rank #{index + 1}
                        </span>
                      )}
                      {getStatusBadge(issue.status)}
                      {getPriorityBadge(issue.priority)}
                      {isOpen && getSlaBadge(issue.slaStatus)}

                      {isOpen && issue.effectiveScore != null && (
                        <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-200">
                          Score: {issue.effectiveScore}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-slate-900">{issue.title}</h3>

                    <p className="text-sm text-slate-600 line-clamp-2">
                      {issue.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="capitalize font-medium">Category: {issue.category}</span>
                      <span>Submitted: {formatDate(issue.createdAt)}</span>

                      {isOpen && issue.waitingHours != null && (
                        <span className="text-indigo-600 font-medium">
                          Aging: {issue.waitingHours}h waiting (+{(issue.waitingHours * 1.5).toFixed(1)} pts boost)
                        </span>
                      )}

                      {isOpen && issue.slaDeadline && (
                        <span className={isOverdue ? "text-red-600 font-bold" : isAtRisk ? "text-amber-600 font-bold" : "text-slate-600"}>
                          SLA Target: {formatDate(issue.slaDeadline)}
                        </span>
                      )}

                      {isOpen && issue.estimatedResolutionTime && (
                        <span className={issue.isOverdue || issue.overdueHours > 0 ? "text-red-600 font-semibold" : "text-primary-700 font-medium"}>
                          Est. Resolution: {formatDate(issue.estimatedResolutionTime)} ({issue.remainingTimeFormatted || (issue.overdueHours > 0 ? `Overdue by ${issue.overdueHours}h` : `~${issue.remainingHours}h remaining`)})
                        </span>
                      )}
                    </div>

                    {isOpen && issue.estimateExplanation && (
                      <p className="text-xs text-slate-400 italic">
                        Schedule justification: {issue.estimateExplanation}
                      </p>
                    )}

                  </div>

                  <div className="flex md:flex-col justify-end items-end gap-2 shrink-0">
                    {isOpen && (
                      <Button
                        onClick={() => resolveIssue(issue.id)}
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5"
                      >
                        <CheckCircle size={16} />
                        Resolve
                      </Button>
                    )}
                  </div>

                </div>
              );
            })
          )}

        </div>

      </div>

    </Layout>
  );
};

export default AdminDashboard;