const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("epc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getBuildings(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
  );
  const res = await fetch(`${BASE_URL}/buildings?${params}`);
  return res.json();
}

export async function getBuilding(uprn: number) {
  const res = await fetch(`${BASE_URL}/buildings/${uprn}`);
  return res.json();
}

export async function askEpcBuddy(uprn: number, question: string) {
  const res = await fetch(`${BASE_URL}/buddy/${uprn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return res.json();
}

export async function submitReport(uprn: number | null, message: string, email?: string) {
  const res = await fetch(`${BASE_URL}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uprn, message, email }),
  });
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function getQueueCounts() {
  const res = await fetch(`${BASE_URL}/admin/queue-counts`, { headers: authHeaders() });
  return res.json();
}

export async function getAdminBuildings(status?: string) {
  const params = status ? `?status=${status}` : "";
  const res = await fetch(`${BASE_URL}/admin/buildings${params}`, { headers: authHeaders() });
  return res.json();
}

export async function verifyBuilding(uprn: number) {
  const res = await fetch(`${BASE_URL}/admin/buildings/${uprn}/verify`, {
    method: "POST",
    headers: authHeaders(),
  });
  return res.json();
}

export async function flagBuilding(uprn: number) {
  const res = await fetch(`${BASE_URL}/admin/buildings/${uprn}/flag`, {
    method: "POST",
    headers: authHeaders(),
  });
  return res.json();
}

export async function addReviewNote(uprn: number, note: string) {
  const res = await fetch(`${BASE_URL}/admin/buildings/${uprn}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ note }),
  });
  return res.json();
}

export async function updateRecommendation(
  id: number,
  payload: {
    measure: string;
    payback_category: string;
    estimated_cost: string | number;
    source: string;
  }
) {
  const res = await fetch(`${BASE_URL}/admin/recommendations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}
