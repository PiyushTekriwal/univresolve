import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useEffect, useState } from 'react';
import { User, CheckCircle2, Clock, Hourglass } from 'lucide-react';

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

const formatActualDuration = (minutes) => {
  if (minutes == null || isNaN(minutes)) return "Duration unavailable";
  if (minutes <= 0) return "< 1 hour";
  if (minutes < 60) return `${minutes} minutes`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hrs < 24) return rem === 0 ? `${hrs} hours` : `${hrs}h ${rem}m`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs === 0
    ? `${days} ${days === 1 ? "day" : "days"}`
    : `${days} ${days === 1 ? "day" : "days"} ${remHrs} hours`;
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

const getPriorityBadge = (prio) => {
  const p = (prio || "LOW").toUpperCase();
  if (p === "CRITICAL") return <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">🚨 CRITICAL</span>;
  if (p === "HIGH") return <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">🔥 HIGH</span>;
  if (p === "MEDIUM") return <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">⚡ MEDIUM</span>;
  return <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">🟢 LOW</span>;
};

const History = () => {

  const [issues, setIssues]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState("");

  useEffect(() => { loadResolved(); }, []);

  const loadResolved = async () => {
    try {
      const res  = await fetch("/api/issues/history");
      const data = await res.json();
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setIssues(data);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const filtered = issues.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-10">

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Complaint History</h1>
          <p className="text-slate-500">All resolved complaints with historical resolution duration</p>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search resolved complaints..."
          className="border p-2 rounded w-full mb-6"
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>No resolved complaints yet.</p>
            </div>
          )}

          {filtered.map(issue => (
            <div
              key={issue.id}
              className="p-5 bg-white shadow rounded-xl border-l-4 border-emerald-500 flex justify-between items-start"
            >
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-2 items-center">
                  <span className="text-gray-400 text-xs font-mono font-semibold">#{issue.id}</span>
                  <Badge variant="success">Resolved</Badge>
                  {getPriorityBadge(issue.effectivePriority || issue.originalPriority)}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 size={12} /> RESOLVED
                  </span>
                  {issue.category && <Badge variant="secondary">{issue.category}</Badge>}
                  {issue.actualResolutionMinutes != null && (
                    <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-semibold">
                      <Hourglass size={11} />
                      Resolved in {formatActualDuration(issue.actualResolutionMinutes)}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-lg mb-1">{issue.title}</h3>

                <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-2">
                  <span>Filed: {formatDateTime(issue.createdAt)}</span>
                  <span>Resolved On: {formatDateTime(issue.resolvedAt || issue.createdAt)}</span>
                </div>

                {/* Worker who handled it */}
                {issue.workerName && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg w-fit">
                    <User size={13} className="text-emerald-600" />
                    <p className="text-xs text-emerald-800">
                      Handled by <strong>{issue.workerName}</strong> — {workerLabel(issue.workerType)}
                    </p>
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" className="ml-4 self-start" onClick={() => setSelected(issue)}>
                View
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            <h2 className="text-xl font-bold mb-1">{selected.title}</h2>
            <p className="text-gray-400 text-xs mb-3">#{selected.id} · Filed: {formatDateTime(selected.createdAt)}</p>

            <p className="text-gray-600 mb-4 bg-slate-50 p-3 rounded-lg border text-sm">{selected.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="success">Resolved</Badge>
              {getPriorityBadge(selected.effectivePriority || selected.originalPriority)}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 size={12} /> RESOLVED
              </span>
              {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
            </div>

            <div className="mb-4 p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-slate-500">Priority:</span>
                <span className="font-bold">{selected.effectivePriority || selected.originalPriority || "LOW"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-slate-500">Resolution:</span>
                <span className="font-bold text-emerald-700">Resolved</span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-slate-500">Resolved On:</span>
                <span className="font-semibold text-slate-800">{formatDateTime(selected.resolvedAt || selected.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-slate-500">Actual Resolution Time:</span>
                <span className="font-bold text-blue-700">{formatActualDuration(selected.actualResolutionMinutes)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-slate-500">SLA Target:</span>
                <span>{selected.slaTargetHours || 48} Hours</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">SLA Status:</span>
                <span className="font-bold text-emerald-700">RESOLVED</span>
              </div>
            </div>

            {selected.workerName && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs text-emerald-600 font-medium mb-1 uppercase tracking-wide">Handled by</p>
                <p className="font-bold text-emerald-900">{selected.workerName}</p>
                <p className="text-sm text-emerald-700">{workerLabel(selected.workerType)}</p>
              </div>
            )}

            <div className="mt-4 text-right">
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
};

export default History;
