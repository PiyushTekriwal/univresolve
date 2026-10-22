const BASE_URL = "/api";

/* -------------------- COMPLAINTS -------------------- */

export const getUserComplaints = async (userId) => {
  const res = await fetch(`${BASE_URL}/issues/user/${userId}`);

  if (!res.ok) {
    throw new Error("Failed to fetch user complaints");
  }

  return await res.json();
};

/* 🔥 FIXED ADMIN API */
export const getAllComplaints = async () => {
  const res = await fetch(`${BASE_URL}/issues/admin`);

  if (!res.ok) {
    throw new Error("Failed to fetch complaints");
  }

  return await res.json();
};

export const deleteComplaint = async (issueId) => {
  const res = await fetch(`${BASE_URL}/issues/${issueId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to resolve complaint");
  }

  return { success: true };
};

export const createComplaint = async (issue) => {
  const response = await fetch(`${BASE_URL}/issues`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issue),
  });

  if (!response.ok) {
    throw new Error("Failed to create complaint");
  }

  return await response.json();
};

/* -------------------- USERS -------------------- */

export const loginUser = async (user) => {
  const response = await fetch(`${BASE_URL}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    throw new Error("Invalid email or password");
  }

  return await response.json();
};

export const registerUser = async (user) => {
  const response = await fetch(`${BASE_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    throw new Error("Registration failed");
  }

  return await response.json();
};