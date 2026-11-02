import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useEffect, useState } from 'react';
import { User, CheckCircle2 } from 'lucide-react';

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

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return isNaN(d) ? date : d.toLocaleString();
  };

  const filtered = issues.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-10">

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Complaint History</h1>
          <p className="text-slate-500">All resolved complaints</p>
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
              className="p-5 bg-white shadow rounded-xl border-l-4 border-green-500 flex justify-between items-start"
            >
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-1 items-center">
                  <span className="text-gray-400 text-xs font-mono">#{issue.id}</span>
                  <Badge variant="success">Resolved</Badge>
                  {issue.category && <Badge variant="secondary">{issue.category}</Badge>}
                </div>

                <h3 className="font-bold text-lg mb-1">{issue.title}</h3>

                <p className="text-xs text-slate-400 mb-2">{formatDate(issue.createdAt)}</p>

                {/* Worker who handled it */}
                {issue.workerName && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg w-fit">
                    <User size={13} className="text-green-600" />
                    <p className="text-xs text-green-800">
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
            <p className="text-gray-400 text-xs mb-4">#{selected.id} · {formatDate(selected.createdAt)}</p>

            <p className="text-gray-600 mb-4">{selected.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="success">Resolved</Badge>
              {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
            </div>

            {selected.workerName && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs text-green-600 font-medium mb-1 uppercase tracking-wide">Handled by</p>
                <p className="font-bold text-green-900">{selected.workerName}</p>
                <p className="text-sm text-green-700">{workerLabel(selected.workerType)}</p>
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
