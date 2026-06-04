import { apiFetch } from "../lib/api";

// src/api/auth.js
// src/api/apiFetch.ts (or similar)
export const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Helper to get Authorization headers
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// ✅ LOGIN: uses username & password
export async function loginUser({ username, password }) {
  const response = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Login failed:", errText);
    throw new Error("Login failed");
  }

  return response.json(); // { access_token, token_type }
}

// ✅ REGISTER: creates new user
export async function registerUser(userData) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Registration failed:", errText);
    throw new Error("Registration failed");
  }

  return response.json();
}

// ✅ GET CURRENT USER
export async function getCurrentUser() {
  const response = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    console.warn("Token expired or invalid");
    localStorage.removeItem("token");
    throw new Error("Not authorized");
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("Failed to fetch current user:", errText);
    throw new Error("Failed to fetch user");
  }

  return response.json();
}

// ✅ LOGOUT helper
export function clearAuth() {
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
  localStorage.removeItem("twofa_token");
  sessionStorage.removeItem("twofa_token");

  // common alternate keys, if any old code used them
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("user");

  window.dispatchEvent(new Event("auth:changed"));
}

export async function logoutUser() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch (err) {
    console.error("Logout request failed", err);
  } finally {
    clearAuth();
    window.location.href = "/"; // Redirect to  home after logout
  }
}

export async function handleLogout() {
  await logoutUser();
}

