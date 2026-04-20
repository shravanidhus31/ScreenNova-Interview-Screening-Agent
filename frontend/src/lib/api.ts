// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Helper to grab the token from wherever you store it
function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[ScreenNova API] ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Endpoints ─────────────────────────────────────────────────────────────────

// 1. AUTHENTICATION
export async function register(data: any) {
  return request("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export async function login(data: any) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(data) });
}

// 2. RESUME
export async function uploadResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/resume/upload`, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error("Resume upload failed");
  return res.json();
}

// 3. SESSIONS (The Interview)
export async function startSession(job_id: string) {
  return request("/sessions/start", { 
    method: "POST", 
    body: JSON.stringify({ job_id }) 
  });
}

export async function submitResponse(session_id: string, question_id: string, text: string, voice_flag: boolean = false) {
  return request("/responses/submit", {
    method: "POST",
    body: JSON.stringify({ session_id, question_id, text, voice_flag })
  });
}

export async function evaluateSession(session_id: string) {
  return request(`/sessions/${session_id}/evaluate`, { method: "POST" });
}

// 4. JOB POSTINGS
export async function getJobs() {
  return request("/jobs");
}

export async function createJob(jobData: any) {
  return request("/jobs", { 
    method: "POST", 
    body: JSON.stringify(jobData) 
  });
}

// 5. HR DASHBOARD
export async function getJobCandidates(job_id: string) {
  return request(`/hr/jobs/${job_id}/candidates`);
}

// Generates the 10 baseline questions for a job using Groq (LLM)
export async function generateJobQuestions(job_id: string) {
  return request(`/jobs/${job_id}/generate-questions`, { method: "POST" });
}

// Fetches the generated (or approved) questions for a job so HR can review them
export async function getJobQuestions(job_id: string) {
  return request(`/jobs/${job_id}/questions`);
}

// HR approves ALL questions so candidates can begin interviewing
export async function approveJobQuestions(job_id: string) {
  return request(`/jobs/${job_id}/approve-questions`, { method: "PUT" });
}

// ─── FIX: Correct endpoint is POST /hr/results/{session_id}/override ──────────
// Backend OverrideModel expects: { new_decision: string, reason: string }
export async function overrideEvaluation(
  session_id: string,
  new_decision: "shortlisted" | "rejected",
  reason: string = ""
) {
  return request(`/hr/results/${session_id}/override`, {
    method: "POST",
    body: JSON.stringify({ new_decision, reason }),
  });
}