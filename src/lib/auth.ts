export function setAuthToken(token) {
  localStorage.setItem("token", token);
  window.dispatchEvent(new Event("auth:changed"));
}

export function clearAuthToken() {
  localStorage.removeItem("token");
  window.dispatchEvent(new Event("auth:changed"));
}