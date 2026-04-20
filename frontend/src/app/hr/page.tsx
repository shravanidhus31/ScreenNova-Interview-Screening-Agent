"use client";
import Layout from "@/components/Layout";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Briefcase, Users, BarChart3, Settings,
  Bell, Search, ChevronRight, TrendingUp, Clock, CheckCircle,
  XCircle, Eye, Plus, Zap, Filter,
  ArrowUpRight, MoreHorizontal, Loader2, Edit2, Trash2,
  FileQuestion, RefreshCw
} from "lucide-react";

import {
  getJobs, getJobCandidates, createJob,
  generateJobQuestions, approveJobQuestions, overrideEvaluation,
  getJobQuestions
} from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  title: string;
  dept: string;
  applicants: number;
  avgScore: number;
  shortlisted: number;
  daysLeft: number;
  status: "active" | "paused";
  trend: number;
  questions_approved?: boolean;
}

interface Candidate {
  id: string;          // session_id from backend
  name: string;
  email: string;
  initials: string;
  role: string;
  techScore: number;
  commScore: number;
  confScore: number;
  finalScore: number;
  status: "shortlisted" | "rejected" | "pending";
  appliedAt: string;
  color: string;
  explanation: string;
  sessionStatus: string;
  raw?: any;
}

interface Question {
  id?: string;
  text: string;
  type: "technical" | "behavioral" | "scenario" | "motivation" | string;
  difficulty: "easy" | "medium" | "hard" | string;
  order_num?: number;
}

// ─── Mock Data (Fallback) ─────────────────────────────────────────────────────
const MOCK_JOBS: Job[] = [
  { id: "j1", title: "Senior ML Engineer", dept: "AI Platform", applicants: 0, avgScore: 0, shortlisted: 0, daysLeft: 5, status: "active", trend: 0 },
  { id: "j2", title: "Frontend Developer", dept: "Product", applicants: 0, avgScore: 0, shortlisted: 0, daysLeft: 12, status: "active", trend: 0 },
];

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Briefcase, label: "Job Postings" },
  { icon: Users, label: "Candidates" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings" },
];

// ─── Type badge colours ───────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  technical:  { bg: "#EEF2FF", color: "#4F46E5" },
  behavioral: { bg: "#ECFDF5", color: "#059669" },
  scenario:   { bg: "#FFF7ED", color: "#D97706" },
  motivation: { bg: "#FFF1F2", color: "#E11D48" },
};

const DIFF_COLORS: Record<string, string> = {
  easy:   "#34D399",
  medium: "#FCD34D",
  hard:   "#FB7185",
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function GlassCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: "rgba(255,255,255,0.60)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderColor: "rgba(226,232,240,0.80)",
        boxShadow: "0 2px 24px 0 rgba(100,116,139,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: Candidate["status"] }) {
  const map = {
    shortlisted: { label: "Shortlisted", bg: "#ECFDF5", color: "#059669", dot: "#34D399" },
    rejected:    { label: "Rejected",    bg: "#FFF1F2", color: "#E11D48", dot: "#FB7185" },
    pending:     { label: "Pending",     bg: "#FFF7ED", color: "#D97706", dot: "#FCD34D" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function ScoreRing({ value, color }: { value: number; color: string }) {
  const r = 16, c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="absolute rotate-[-90deg]">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#E2E8F0" strokeWidth="3"/>
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"/>
      </svg>
      <span className="text-[10px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#E2E8F0" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-500 w-7 text-right">{value > 0 ? value : "—"}</span>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [filter, setFilter] = useState<"all" | "shortlisted" | "rejected" | "pending">("all");

  // ─── API data states ───
  const [realJobs, setRealJobs]           = useState<any[]>([]);
  const [realCandidates, setRealCandidates] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // ─── Create Job modal ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", description: "", required_skills: "", criteria: "", threshold: 60 });
  const [isCreating, setIsCreating] = useState(false);

  // ─── Questions Review modal ───
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [questionsJob, setQuestionsJob]   = useState<any>(null);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [isApproving, setIsApproving]     = useState(false);
  const [editingIdx, setEditingIdx]       = useState<number | null>(null);
  const [editText, setEditText]           = useState("");

  // ─── Candidate Review modal ───
  const [showReviewModal, setShowReviewModal]   = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isOverriding, setIsOverriding]         = useState(false);

  // ─── Load on mount ───
  useEffect(() => { loadDashboardData(); }, []);

  // ─── Data Fetching ────────────────────────────────────────────────────────────
  const loadDashboardData = async () => {
    setIsLoadingData(true);
    try {
      const res: any = await getJobs();
      const jobsList = res.jobs || [];
      setRealJobs(jobsList);

      let allCands: any[] = [];
      for (const j of jobsList) {
        try {
          const cRes: any = await getJobCandidates(j.id);
          if (cRes.candidates) {
            const stamped = cRes.candidates.map((c: any) => ({ ...c, _job_id: j.id, _job_title: j.title }));
            allCands = [...allCands, ...stamped];
          }
        } catch {
          // job may have no candidates yet — that's fine
        }
      }
      setRealCandidates(allCands);
    } catch {
      console.error("Failed to load dashboard data");
    } finally {
      setIsLoadingData(false);
    }
  };

  // ─── Create Job ───────────────────────────────────────────────────────────────
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createJob({
        ...newJob,
        criteria: newJob.criteria || newJob.description,
        w1: 0.5, w2: 0.3, w3: 0.2,
      });
      setShowCreateModal(false);
      setNewJob({ title: "", description: "", required_skills: "", criteria: "", threshold: 60 });
      await loadDashboardData();
    } catch {
      alert("Failed to create job. Make sure you are logged in as HR.");
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Open Questions Review (generate first, then show) ───────────────────────
  const handleOpenQuestionsModal = async (job: any) => {
    setQuestionsJob(job);
    setQuestionsList([]);
    setShowQuestionsModal(true);
    setIsGenerating(true);
    try {
      // Always (re-)generate so HR sees fresh questions
      const genRes: any = await generateJobQuestions(job.id);
      if (genRes.questions && genRes.questions.length > 0) {
        setQuestionsList(genRes.questions);
      } else {
        // Fallback: fetch existing questions if generation returned empty
        const qRes: any = await getJobQuestions(job.id);
        setQuestionsList(qRes.questions || []);
      }
    } catch (err: any) {
      // If generation failed, try to fetch what's already stored
      try {
        const qRes: any = await getJobQuestions(job.id);
        setQuestionsList(qRes.questions || []);
      } catch {
        alert("Could not load questions. Check your Groq API key.");
        setShowQuestionsModal(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Re-generate questions inside the modal ────────────────────────────────
  const handleRegenerateQuestions = async () => {
    if (!questionsJob) return;
    setIsGenerating(true);
    try {
      const genRes: any = await generateJobQuestions(questionsJob.id);
      setQuestionsList(genRes.questions || []);
    } catch {
      alert("Failed to regenerate questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Approve questions after review ──────────────────────────────────────────
  const handleApproveQuestions = async () => {
    if (!questionsJob) return;
    setIsApproving(true);
    try {
      await approveJobQuestions(questionsJob.id);
      setShowQuestionsModal(false);
      await loadDashboardData();
    } catch {
      alert("Failed to approve questions.");
    } finally {
      setIsApproving(false);
    }
  };

  // ─── Override AI decision ─────────────────────────────────────────────────────
  const handleOverride = async (sessionId: string, decision: "shortlisted" | "rejected") => {
    setIsOverriding(true);
    try {
      await overrideEvaluation(sessionId, decision, "Manual HR override");
      setShowReviewModal(false);
      await loadDashboardData();
    } catch (err: any) {
      alert(`Failed to override: ${err.message}`);
    } finally {
      setIsOverriding(false);
    }
  };

  // ─── Data Mapping ─────────────────────────────────────────────────────────────
  // Backend shape: { session_id, user: { id, email, skill_profile }, status, result: { final_score, decision, explanation, ... } }
  const mappedCandidates: Candidate[] = realCandidates.map((c: any) => {
    const user   = c.user   || {};
    const result = c.result || {};

    // Extract scores — results table stores final_score + decision + explanation
    // Per-question scores live in evaluations table (not returned here), so show 0 unless available
    const finalScore = Number(result.final_score ?? 0);
    const techScore  = Number(result.tech_score  ?? result.scores?.technical  ?? 0);
    const commScore  = Number(result.comm_score  ?? result.scores?.communication ?? 0);
    const confScore  = Number(result.conf_score  ?? result.scores?.confidence  ?? 0);

    const rawDecision = (result.decision ?? c.status ?? "pending").toLowerCase();
    const status: Candidate["status"] =
      rawDecision === "shortlisted" ? "shortlisted" :
      rawDecision === "rejected"    ? "rejected"    : "pending";

    const email = user.email ?? "unknown@example.com";
    // Build a display name: take part before @ and title-case it
    const namePart = email.split("@")[0].replace(/[._-]/g, " ");
    const name = namePart.replace(/\b\w/g, (l: string) => l.toUpperCase());
    const initials = namePart.slice(0, 2).toUpperCase();

    return {
      id:            c.session_id,
      name,
      email,
      initials,
      role:          c._job_title ?? "Applicant",
      techScore:     Math.round(techScore),
      commScore:     Math.round(commScore),
      confScore:     Math.round(confScore),
      finalScore:    Math.round(finalScore),
      status,
      appliedAt:     c.created_at ? new Date(c.created_at).toLocaleDateString() : "—",
      color:         status === "shortlisted" ? "#34D399" : status === "rejected" ? "#FB7185" : "#818CF8",
      explanation:   result.explanation ?? "",
      sessionStatus: c.status ?? "unknown",
      raw:           c,
    };
  });

  const displayJobs: Job[] = realJobs.length > 0
    ? realJobs.map(job => {
        const jobCands  = mappedCandidates.filter(c => c.role === job.title);
        const applicants  = jobCands.length;
        const shortlisted = jobCands.filter(c => c.status === "shortlisted").length;
        const avgScore    = applicants > 0
          ? Math.round(jobCands.reduce((s, c) => s + c.finalScore, 0) / applicants)
          : 0;
        return {
          id: job.id, title: job.title, dept: job.description || "Engineering",
          applicants, avgScore, shortlisted, daysLeft: 14,
          status: "active", trend: 0, questions_approved: job.questions_approved,
        };
      })
    : MOCK_JOBS;

  const filtered          = filter === "all" ? mappedCandidates : mappedCandidates.filter(c => c.status === filter);
  const totalApplicants   = mappedCandidates.length;
  const totalShortlisted  = mappedCandidates.filter(c => c.status === "shortlisted").length;
  const avgScore          = totalApplicants > 0
    ? Math.round(mappedCandidates.reduce((s, c) => s + c.finalScore, 0) / totalApplicants) : 0;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Layout>
    <div className="flex min-h-screen" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col py-6 px-3 border-r"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderColor: "rgba(226,232,240,0.70)",
        }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#818CF8,#6EE7B7)" }}>
            <Zap size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ color: "#1E293B" }}>ScreenNova</div>
            <div className="text-[10px]" style={{ color: "#94A3B8" }}>HR Command Center</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <button key={label}
              onClick={() => setActiveNav(label)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeNav === label ? "linear-gradient(90deg,#EEF2FF,#F0FDF4)" : "transparent",
                color: activeNav === label ? "#4F46E5" : "#64748B",
                boxShadow: activeNav === label ? "0 0 0 1px rgba(99,102,241,0.15)" : "none",
              }}>
              <Icon size={16} strokeWidth={activeNav === label ? 2.5 : 1.8} />
              {label}
              {activeNav === label && <ChevronRight size={12} className="ml-auto opacity-60" />}
            </button>
          ))}
        </nav>

        {/* HR Profile pill */}
        <div className="mt-4 mx-1 p-3 rounded-xl flex items-center gap-2.5"
          style={{ background: "rgba(241,245,249,0.80)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg,#818CF8,#6EE7B7)" }}>HR</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: "#1E293B" }}>HR Admin</div>
            <div className="text-[10px]" style={{ color: "#94A3B8" }}>Administrator</div>
          </div>
          <MoreHorizontal size={14} color="#94A3B8" />
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#0F172A" }}>Command Center</h1>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
              style={{ background: "rgba(255,255,255,0.7)", borderColor: "#E2E8F0", color: "#64748B" }}>
              <Search size={14} />
              <span>Search anything…</span>
            </div>
            <button className="relative p-2 rounded-xl border"
              style={{ background: "rgba(255,255,255,0.7)", borderColor: "#E2E8F0" }}>
              <Bell size={16} color="#64748B" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: "#EF4444" }} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)" }}>
              <Plus size={14} />
              New Job
            </button>
          </div>
        </div>

        {/* ─ KPI Row ─ */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Candidates", value: isLoadingData ? "…" : totalApplicants, sub: "who gave interviews", color: "#818CF8", icon: Users },
            { label: "Shortlisted",      value: isLoadingData ? "…" : totalShortlisted, sub: `${totalApplicants > 0 ? Math.round(totalShortlisted/totalApplicants*100) : 0}% pass rate`, color: "#34D399", icon: CheckCircle },
            { label: "Avg. Score",        value: isLoadingData ? "…" : `${avgScore}%`, sub: "across all sessions", color: "#FCD34D", icon: TrendingUp },
            { label: "Active Jobs",       value: isLoadingData ? "…" : displayJobs.filter(j=>j.status==="active").length, sub: `${displayJobs.length} total postings`, color: "#F9A8D4", icon: Briefcase },
          ].map(({ label, value, sub, color, icon: Icon }) => (
            <GlassCard key={label} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}22` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <ArrowUpRight size={14} color="#CBD5E1" />
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: "#0F172A" }}>{value}</div>
              <div className="text-xs font-medium mb-0.5" style={{ color: "#64748B" }}>{label}</div>
              <div className="text-[11px]" style={{ color: "#94A3B8" }}>{sub}</div>
            </GlassCard>
          ))}
        </div>

        {/* ─ Jobs + Funnel ─ */}
        <div className="grid grid-cols-3 gap-4">

          {/* Active Job Postings */}
          <GlassCard className="col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm" style={{ color: "#0F172A" }}>Active Job Postings</h2>
              <button onClick={loadDashboardData} className="text-xs font-medium flex items-center gap-1" style={{ color: "#6366F1" }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            {isLoadingData ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
            ) : displayJobs.length === 0 ? (
              <p className="text-sm text-center text-slate-400 py-6">No active jobs. Create one above!</p>
            ) : (
              <div className="space-y-3">
                {displayJobs.map(job => (
                  <div key={job.id} className="flex items-center gap-4 p-3 rounded-xl transition-all hover:scale-[1.01]"
                    style={{ background: "rgba(241,245,249,0.60)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#EEF2FF,#ECFDF5)" }}>
                      <Briefcase size={15} color="#6366F1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{job.title}</div>
                      <div className="text-xs" style={{ color: "#94A3B8" }}>{job.dept}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold" style={{ color: job.avgScore >= 70 ? "#059669" : "#D97706" }}>
                        {job.avgScore > 0 ? `${job.avgScore}%` : "—"}
                      </div>
                      <div className="text-[10px]" style={{ color: "#94A3B8" }}>avg score</div>
                    </div>
                    <div className="text-center w-16">
                      <div className="text-xs font-bold" style={{ color: "#0F172A" }}>{job.applicants}</div>
                      <div className="text-[10px]" style={{ color: "#94A3B8" }}>candidates</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 w-32">
                      {/* Questions status pill */}
                      {job.questions_approved ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: "#ECFDF5", color: "#059669" }}>
                          ✓ Qs Approved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: "#FFF7ED", color: "#D97706" }}>
                          Qs Pending
                        </span>
                      )}
                      {/* Review / Re-review Questions button */}
                      <button
                        onClick={() => {
                          const rawJob = realJobs.find(j => j.id === job.id);
                          handleOpenQuestionsModal(rawJob || job);
                        }}
                        className="text-[10px] font-bold flex items-center gap-1 transition-all hover:opacity-80"
                        style={{ color: job.questions_approved ? "#6366F1" : "#D97706" }}
                      >
                        <FileQuestion size={10} />
                        {job.questions_approved ? "Review Qs" : "Generate & Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Funnel Summary */}
          <GlassCard className="p-5 flex flex-col">
            <h2 className="font-semibold text-sm mb-4" style={{ color: "#0F172A" }}>Screening Funnel</h2>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {[
                { label: "Applied",     count: totalApplicants,  pct: 100, color: "#C7D2FE" },
                { label: "Evaluated",   count: mappedCandidates.filter(c => c.sessionStatus === "completed").length, pct: totalApplicants > 0 ? Math.round(mappedCandidates.filter(c=>c.sessionStatus==="completed").length/totalApplicants*100) : 0, color: "#818CF8" },
                { label: "Shortlisted", count: totalShortlisted, pct: totalApplicants > 0 ? Math.round(totalShortlisted/totalApplicants*100) : 0, color: "#34D399" },
              ].map(({ label, count, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: "#64748B" }}>{label}</span>
                    <span className="text-xs font-bold" style={{ color: "#0F172A" }}>{count}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "#E2E8F0" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl text-center"
              style={{ background: "linear-gradient(135deg,#EEF2FF,#ECFDF5)" }}>
              <div className="text-lg font-bold" style={{ color: "#4F46E5" }}>
                {totalApplicants > 0 ? Math.round(totalShortlisted/totalApplicants*100) : 0}%
              </div>
              <div className="text-xs" style={{ color: "#64748B" }}>Selection Rate</div>
            </div>
          </GlassCard>
        </div>

        {/* ─ Candidate Table ─ */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm" style={{ color: "#0F172A" }}>Candidate Insights</h2>
              {isLoadingData && <span className="text-xs text-slate-400">Loading…</span>}
            </div>
            <div className="flex items-center gap-2">
              <Filter size={13} color="#94A3B8" />
              {(["all","shortlisted","rejected","pending"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: filter === f ? "linear-gradient(135deg,#6366F1,#818CF8)" : "rgba(241,245,249,0.8)",
                    color: filter === f ? "white" : "#64748B",
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {["Candidate","Role","Tech","Comm","Conf","Final Score","Status","Session","Action"].map(h => (
                    <th key={h} className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "#94A3B8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="group transition-all hover:bg-slate-50/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg,${c.color}99,${c.color})` }}>
                          {c.initials}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: "#0F172A" }}>{c.name}</div>
                          <div className="text-[10px]" style={{ color: "#94A3B8" }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs max-w-[120px]" style={{ color: "#64748B" }}>
                      <span className="truncate block">{c.role}</span>
                    </td>
                    <td className="py-3 pr-3 w-24"><MiniBar value={c.techScore} color="#818CF8" /></td>
                    <td className="py-3 pr-3 w-24"><MiniBar value={c.commScore} color="#34D399" /></td>
                    <td className="py-3 pr-3 w-24"><MiniBar value={c.confScore} color="#FCD34D" /></td>
                    <td className="py-3 pr-4">
                      <ScoreRing value={c.finalScore} color={c.finalScore >= 70 ? "#34D399" : c.finalScore >= 55 ? "#FCD34D" : "#FB7185"} />
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                    <td className="py-3 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                        style={{
                          background: c.sessionStatus === "completed" ? "#ECFDF5" : "#F1F5F9",
                          color: c.sessionStatus === "completed" ? "#059669" : "#64748B",
                        }}>
                        {c.sessionStatus}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setSelectedCandidate(c); setShowReviewModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 transition-colors" title="View AI Evaluation">
                          <Eye size={13} color="#6366F1" />
                        </button>
                        <button
                          onClick={() => handleOverride(c.id, "shortlisted")}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors" title="Force Shortlist">
                          <CheckCircle size={13} color="#10B981" />
                        </button>
                        <button
                          onClick={() => handleOverride(c.id, "rejected")}
                          className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Force Reject">
                          <XCircle size={13} color="#F43F5E" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !isLoadingData && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm" style={{ color: "#94A3B8" }}>
                      {realCandidates.length === 0
                        ? "No candidates have given interviews yet."
                        : `No ${filter} candidates found.`}
                    </td>
                  </tr>
                )}
                {isLoadingData && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center">
                      <Loader2 size={20} className="animate-spin inline text-indigo-400" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          ── CREATE JOB MODAL ──
         ══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)" }}>
          <GlassCard className="w-full max-w-md p-6" style={{ background: "rgba(255,255,255,0.97)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "#0F172A" }}>Create New Job Posting</h2>
              <button onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400"><XCircle size={20}/></button>
            </div>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#64748B" }}>Job Title</label>
                <input required type="text" placeholder="e.g. Frontend Developer"
                  className="w-full p-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:border-indigo-400"
                  value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})}
                  style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#64748B" }}>Department / Description</label>
                <input required type="text" placeholder="e.g. Engineering Team — building scalable APIs"
                  className="w-full p-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:border-indigo-400"
                  value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})}
                  style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#64748B" }}>Required Skills (comma-separated)</label>
                <input required type="text" placeholder="React, Node.js, Python, SQL"
                  className="w-full p-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:border-indigo-400"
                  value={newJob.required_skills} onChange={e => setNewJob({...newJob, required_skills: e.target.value})}
                  style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#64748B" }}>Hiring Criteria</label>
                <textarea rows={2} placeholder="e.g. 2+ years experience, strong problem-solving skills"
                  className="w-full p-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:border-indigo-400 resize-none"
                  value={newJob.criteria} onChange={e => setNewJob({...newJob, criteria: e.target.value})}
                  style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#64748B" }}>
                  Passing Score Threshold (0–100)
                </label>
                <input required type="number" min={0} max={100}
                  className="w-full p-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:border-indigo-400"
                  value={newJob.threshold} onChange={e => setNewJob({...newJob, threshold: Number(e.target.value)})}
                  style={{ borderColor: "#E2E8F0" }} />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border text-slate-600 hover:bg-slate-50 transition-all"
                  style={{ borderColor: "#E2E8F0" }}>Cancel</button>
                <button type="submit" disabled={isCreating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)" }}>
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : "Publish Job"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ── QUESTION REVIEW MODAL ──
         ══════════════════════════════════════════════════════════════════════ */}
      {showQuestionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.50)", backdropFilter: "blur(6px)" }}>
          <GlassCard className="w-full max-w-2xl flex flex-col" style={{ background: "rgba(255,255,255,0.97)", maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: "#F1F5F9" }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#EEF2FF,#ECFDF5)" }}>
                    <FileQuestion size={14} color="#4F46E5" />
                  </div>
                  <h2 className="text-lg font-bold" style={{ color: "#0F172A" }}>AI-Generated Questions</h2>
                </div>
                <p className="text-xs" style={{ color: "#64748B" }}>
                  Job: <span className="font-semibold text-slate-700">{questionsJob?.title}</span>
                  {" · "}{questionsList.length} questions ready for review
                </p>
              </div>
              <button onClick={() => setShowQuestionsModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <XCircle size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={32} className="animate-spin text-indigo-400" />
                  <p className="text-sm" style={{ color: "#64748B" }}>
                    Generating questions with AI…
                  </p>
                </div>
              ) : questionsList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No questions generated yet.
                </div>
              ) : (
                questionsList.map((q, idx) => {
                  const typeStyle = TYPE_COLORS[q.type] ?? { bg: "#F1F5F9", color: "#64748B" };
                  return (
                    <div key={idx}
                      className="group p-4 rounded-xl border transition-all hover:shadow-sm"
                      style={{ borderColor: "#E2E8F0", background: "rgba(248,250,252,0.8)" }}>
                      <div className="flex items-start gap-3">
                        {/* Order number */}
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
                          style={{ background: "#EEF2FF", color: "#4F46E5" }}>{idx + 1}</span>

                        {/* Question text — editable */}
                        <div className="flex-1">
                          {editingIdx === idx ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                autoFocus
                                rows={3}
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                className="w-full p-2 text-sm rounded-lg border focus:outline-none focus:border-indigo-400 resize-none"
                                style={{ borderColor: "#818CF8" }}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const updated = [...questionsList];
                                    updated[idx] = { ...updated[idx], text: editText };
                                    setQuestionsList(updated);
                                    setEditingIdx(null);
                                  }}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                                  style={{ background: "#4F46E5" }}>
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingIdx(null)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 border"
                                  style={{ borderColor: "#E2E8F0" }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed" style={{ color: "#1E293B" }}>{q.text}</p>
                          )}
                          {/* Tags */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                              style={{ background: typeStyle.bg, color: typeStyle.color }}>{q.type}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                              style={{ background: `${DIFF_COLORS[q.difficulty] ?? "#94A3B8"}22`, color: DIFF_COLORS[q.difficulty] ?? "#94A3B8" }}>
                              {q.difficulty}
                            </span>
                          </div>
                        </div>

                        {/* Edit / Delete buttons */}
                        {editingIdx !== idx && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => { setEditingIdx(idx); setEditText(q.text); }}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 transition-colors" title="Edit">
                              <Edit2 size={13} color="#6366F1" />
                            </button>
                            <button
                              onClick={() => setQuestionsList(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Delete">
                              <Trash2 size={13} color="#F43F5E" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer actions */}
            <div className="p-6 border-t flex gap-3 items-center" style={{ borderColor: "#F1F5F9" }}>
              <button
                onClick={handleRegenerateQuestions}
                disabled={isGenerating || isApproving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-slate-50 disabled:opacity-50"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
                <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
                Regenerate
              </button>
              <div className="flex-1 text-xs text-slate-400 text-center">
                {questionsList.length > 0 && !isGenerating && `${questionsList.length} questions • Edit or delete before approving`}
              </div>
              <button
                onClick={handleApproveQuestions}
                disabled={isGenerating || isApproving || questionsList.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#059669,#34D399)" }}>
                {isApproving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {isApproving ? "Approving…" : "Approve All & Publish"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ── CANDIDATE REVIEW MODAL ──
         ══════════════════════════════════════════════════════════════════════ */}
      {showReviewModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)" }}>
          <GlassCard className="w-full max-w-lg p-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.97)" }}>

            {/* Coloured header strip */}
            <div className="p-6 pb-4" style={{ background: "linear-gradient(135deg,#EEF2FF,#ECFDF5)" }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg,${selectedCandidate.color}99,${selectedCandidate.color})` }}>
                    {selectedCandidate.initials}
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>{selectedCandidate.name}</h2>
                    <p className="text-xs" style={{ color: "#64748B" }}>{selectedCandidate.email}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>Applied for: <span className="font-semibold">{selectedCandidate.role}</span></p>
                  </div>
                </div>
                <button onClick={() => setShowReviewModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400">
                  <XCircle size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Score breakdown */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#94A3B8" }}>Score Breakdown</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Final",  value: selectedCandidate.finalScore, color: selectedCandidate.finalScore >= 70 ? "#34D399" : selectedCandidate.finalScore >= 55 ? "#FCD34D" : "#FB7185" },
                    { label: "Tech",   value: selectedCandidate.techScore,  color: "#818CF8" },
                    { label: "Comm",   value: selectedCandidate.commScore,  color: "#34D399" },
                    { label: "Conf",   value: selectedCandidate.confScore,  color: "#FCD34D" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <ScoreRing value={value} color={color} />
                      <span className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI decision */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "#64748B" }}>AI Decision</span>
                <StatusBadge status={selectedCandidate.status} />
              </div>

              {/* AI Reasoning */}
              <div className="p-4 rounded-xl" style={{ background: "rgba(238,242,255,0.6)", border: "1px solid rgba(199,210,254,0.5)" }}>
                <h3 className="font-semibold text-xs mb-2 flex items-center gap-1.5" style={{ color: "#4F46E5" }}>
                  <Zap size={12} /> AI Reasoning
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
                  {selectedCandidate.explanation
                    ? selectedCandidate.explanation
                    : selectedCandidate.sessionStatus === "completed"
                      ? "Evaluation complete but no explanation was stored."
                      : "This candidate has not completed their interview yet. No AI evaluation available."}
                </p>
              </div>

              {/* Override buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => handleOverride(selectedCandidate.id, "shortlisted")}
                  disabled={isOverriding || selectedCandidate.status === "shortlisted"}
                  className="flex-1 py-3 rounded-xl text-sm font-bold border transition-all hover:bg-emerald-50 disabled:opacity-40"
                  style={{ borderColor: "#34D399", color: "#059669" }}>
                  {isOverriding ? <Loader2 size={14} className="animate-spin inline" /> : "✓ Force Shortlist"}
                </button>
                <button
                  onClick={() => handleOverride(selectedCandidate.id, "rejected")}
                  disabled={isOverriding || selectedCandidate.status === "rejected"}
                  className="flex-1 py-3 rounded-xl text-sm font-bold border transition-all hover:bg-rose-50 disabled:opacity-40"
                  style={{ borderColor: "#FB7185", color: "#E11D48" }}>
                  {isOverriding ? <Loader2 size={14} className="animate-spin inline" /> : "✗ Force Reject"}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

    </div>
    </Layout>
  );
}