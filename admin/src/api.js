const TOKEN_KEY = "vsq-admin-token";

export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

async function request(method, path, body) {
  const token = getToken();
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && path !== "/login") {
    clearToken();
    window.location.hash = "#/login";
    throw new ApiError(401, "หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || `เกิดข้อผิดพลาด (${res.status})`, data.errors || []);
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  put: (path, body) => request("PUT", path, body),
  post: (path, body) => request("POST", path, body),
};
