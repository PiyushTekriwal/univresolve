import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useEffect, useState } from 'react';
import { CheckCircle } from "lucide-react";

const AdminDashboard = () => {

  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    try {
      const res = await fetch("/api/issues/dashboard");

      if (!res.ok) throw new Error("API failed");

      const data = await res.json();
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIssues(data);

    } catch (err) {
      console.error("ADMIN ERROR:", err);
    }
  };

  const resolveIssue = async (id) => {
    await fetch(`/api/issues/${id}`, { method: "DELETE" });
    loadIssues();
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();

    if (s === "open") return <Badge variant="warning">Open</Badge>;
    if (s === "resolved") return <Badge variant="success">Resolved</Badge>;

    return <Badge>Unknown</Badge>;
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

        <h1 className="text-3xl font-bold mb-6">
          Admin Dashboard
        </h1>

        {/* 📊 MODERN STATS CARDS */}
        <div className="grid grid-cols-3 gap-6 mb-8">

          <div className="p-6 rounded-xl shadow bg-white text-center">
            <p className="text-gray-500">Total Issues</p>
            <h2 className="text-3xl font-bold">{total}</h2>
          </div>

          <div className="p-6 rounded-xl shadow bg-yellow-100 text-center">
            <p className="text-gray-700">Open</p>
            <h2 className="text-3xl font-bold text-yellow-700">{open}</h2>
          </div>

          <div className="p-6 rounded-xl shadow bg-green-100 text-center">
            <p className="text-gray-700">Resolved</p>
            <h2 className="text-3xl font-bold text-green-700">{resolved}</h2>
          </div>

        </div>

        {/* 🎯 FILTER */}
        <div className="flex gap-2 mb-6">
          {["all", "open", "resolved"].map((f) => (
            <Button key={f} onClick={() => setFilter(f)}>
              {f.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* 📋 LIST */}
        <div className="space-y-4">

          {filtered.map(issue => (

            <div
              key={issue.id}
              className="p-5 bg-white shadow rounded flex justify-between"
            >

              <div>

                <div className="flex gap-3 mb-1">
                  <span className="text-gray-400">#{issue.id}</span>
                  {getStatusBadge(issue.status)}
                </div>

                <h3 className="font-bold">{issue.title}</h3>

                <p className="text-sm text-gray-600">
                  {issue.description}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Category: {issue.category}
                </p>

              </div>

              {(issue.status || "").toLowerCase() === "open" && (
                <Button
                  onClick={() => resolveIssue(issue.id)}
                  className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
                >
                  <CheckCircle size={16} />
                  Resolve
                </Button>
              )}

            </div>

          ))}

        </div>

      </div>

    </Layout>
  );
};

export default AdminDashboard;