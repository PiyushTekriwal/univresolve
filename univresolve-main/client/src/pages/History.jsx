import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useEffect, useState } from 'react';

const History = () => {

  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadResolved();
  }, []);

  const loadResolved = async () => {
    try {
      const res = await fetch("/api/issues/history");
      const data = await res.json();

      // latest first
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIssues(data);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const getStatusBadge = (status) => {
    if (status === "resolved") {
      return <Badge variant="success">Resolved</Badge>;
    }
    return <Badge>Unknown</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || "MEDIUM").toUpperCase();
    if (p === "CRITICAL") return <Badge variant="critical">CRITICAL</Badge>;
    if (p === "HIGH") return <Badge variant="danger">HIGH</Badge>;
    if (p === "MEDIUM") return <Badge variant="warning">MEDIUM</Badge>;
    return <Badge variant="default">LOW</Badge>;
  };

  // 🔥 SEARCH FILTER
  const filtered = issues.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>

      <div className="max-w-6xl mx-auto px-4 py-10">

        <h1 className="text-3xl font-bold mb-6">
          Complaint History
        </h1>

        {/* 🔍 SEARCH */}
        <input
          type="text"
          placeholder="Search resolved complaints..."
          className="border p-2 rounded w-full mb-6"
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-4">

          {filtered.length === 0 && (
            <p className="text-slate-500">No resolved complaints found.</p>
          )}

          {filtered.map(issue => (

            <div
              key={issue.id}
              className="p-5 bg-white shadow rounded-xl border-l-4 border-green-500 flex justify-between"
            >

              <div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400">#{issue.id}</span>
                  {getStatusBadge(issue.status)}
                  {getPriorityBadge(issue.priority)}
                </div>

                <h3 className="font-bold text-lg">
                  {issue.title}
                </h3>

                <p className="text-sm text-gray-600 mt-1 capitalize">
                  Category: {issue.category}
                </p>

              </div>

              <Button onClick={() => setSelected(issue)}>
                View
              </Button>

            </div>

          ))}

        </div>

      </div>

      {/* 🔥 MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">

          <div className="bg-white p-6 rounded-2xl w-[500px] shadow-2xl">

            <h2 className="text-xl font-bold mb-2">
              {selected.title}
            </h2>

            <p className="text-gray-600 mb-4">
              {selected.description}
            </p>

            <div className="mb-2">
              {getStatusBadge(selected.status)}
            </div>

            <p className="text-sm text-gray-500">
              Category: {selected.category}
            </p>

            <div className="mt-4 text-right">
              <Button onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

          </div>

        </div>
      )}

    </Layout>
  );
};

export default History;