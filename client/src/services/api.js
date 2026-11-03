const BASE_URL = "/api";

/* ─────────────────────────── COMPLAINTS ─────────────────────────────────── */

export const getUserComplaints = async (userId) => {
  const res = await fetch(`${BASE_URL}/issues/user/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch user complaints");
  return res.json();
};

export const getAllComplaints = async () => {
  const res = await fetch(`${BASE_URL}/issues/admin`);
  if (!res.ok) throw new Error("Failed to fetch complaints");
  return res.json();
};

export const deleteComplaint = async (issueId) => {
  const res = await fetch(`${BASE_URL}/issues/${issueId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to resolve complaint");
  return { success: true };
};

export const createComplaint = async (issue) => {
  const res = await fetch(`${BASE_URL}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(issue),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Failed to create complaint");
    throw new Error(errText || "Failed to create complaint");
  }
  return res.json();
};

export const recalculateSla = async () => {
  const res = await fetch(`${BASE_URL}/issues/recalculate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to recalculate SLA");
  return res.json();
};

export const getSlaAnalytics = async () => {
  const res = await fetch(`${BASE_URL}/issues/analytics`);
  if (!res.ok) throw new Error("Failed to fetch SLA analytics");
  return res.json();
};

/* ─────────────────────────── USERS ──────────────────────────────────────── */

export const loginUser = async (user) => {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error("Invalid email or password");
  return res.json();
};

export const registerUser = async (user) => {
  const res = await fetch(`${BASE_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Registration failed");
    throw new Error(errText || "Registration failed");
  }
  return res.json();
};

/* ─────────────────────────── WORKERS ────────────────────────────────────── */

export const getAllWorkers = async () => {
  const res = await fetch(`${BASE_URL}/workers`);
  if (!res.ok) throw new Error("Failed to fetch workers");
  return res.json();
};

export const createWorker = async (worker) => {
  const res = await fetch(`${BASE_URL}/workers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(worker),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Failed to add worker");
    throw new Error(errText || "Failed to add worker");
  }
  return res.json();
};

export const deleteWorker = async (workerId) => {
  const res = await fetch(`${BASE_URL}/workers/${workerId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete worker");
  return { success: true };
};

export const getPendingAssignments = async () => {
  const res = await fetch(`${BASE_URL}/workers/assignments/pending`);
  if (!res.ok) throw new Error("Failed to fetch pending assignments");
  return res.json();
};
