"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase, UploadCloud, FileText, CheckCircle, Loader2,
  PlayCircle, Zap, ChevronRight, MoreHorizontal, Bell,
  Search, User, LayoutDashboard, Settings, ArrowUpRight,
  Sparkles, Clock, Shield, BookOpen, RefreshCw, X
} from "lucide-react";
import Layout from "../../components/Layout";
import { getJobs, uploadResume, startSession } from "../../lib/api";

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "My Dashboard" },
  { icon: Briefcase,       label: "Open Positions" },
  { icon: BookOpen,        label: "My Interviews" },
  { icon: Settings,        label: "Settings" },
];

// ─── Skill tag colours (cycles) ───────────────────────────────────────────────
const SKILL_COLORS = [
  { bg: "#EEF2FF", color: "#4F46E5" },
  { bg: "#ECFDF5", color: "#059669" },
  { bg: "#FFF7ED", color: "#D97706" },
  { bg: "#FFF1F2", color: "#E11D48" },
  { bg: "#F0F9FF", color: "#0284C7" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function GlassCard({
  children, className = "", style,
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: "rgba(255,255,255,0.60)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderColor: "rgba(226,232,240,0.80)",
        boxShadow:
          "0 2px 24px 0 rgba(100,116,139,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SkillTag({ label, idx }: { label: string; idx: number }) {
  const c = SKILL_COLORS[idx % SKILL_COLORS.length];
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CandidatePortal() {
  const router = useRouter();

  const [jobs, setJobs]               = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  const [file, setFile]               = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResumeReady, setIsResumeReady] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [startingJobId, setStartingJobId] = useState<string | null>(null);
  const [activeNav, setActiveNav]     = useState("Open Positions");

  // ─── Load Jobs ──────────────────────────────────────────────────────────────
  const loadJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res: any = await getJobs();
      setJobs(res.jobs || []);
    } catch {
      console.error("Failed to fetch jobs");
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);

  // ─── Resume Upload ───────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsUploading(true);
    setUploadError("");
    try {
      await uploadResume(selectedFile);
      setIsResumeReady(true);
    } catch {
      setUploadError("Failed to parse resume. Please try a different PDF.");
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Drag & Drop ────────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped || dropped.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    setFile(dropped);
    setIsUploading(true);
    setUploadError("");
    try {
      await uploadResume(dropped);
      setIsResumeReady(true);
    } catch {
      setUploadError("Failed to parse resume. Please try again.");
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Start Interview ─────────────────────────────────────────────────────────
  const handleStartInterview = async (jobId: string) => {
    setStartingJobId(jobId);
    try {
      const res: any = await startSession(jobId);
      localStorage.setItem("current_session_id", res.session_id);
      localStorage.setItem("current_questions", JSON.stringify(res.questions));
      router.push("/interview");
    } catch {
      alert("Could not start interview. Make sure HR has approved questions for this role.");
    } finally {
      setStartingJobId(null);
    }
  };

  // ─── Derived stats ───────────────────────────────────────────────────────────
  const approvedJobs = jobs.filter(j => j.questions_approved);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="flex min-h-screen" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Sidebar ── */}
        <aside
          className="w-60 flex-shrink-0 flex flex-col py-6 px-3 border-r"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(226,232,240,0.70)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-3 mb-8">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#818CF8,#6EE7B7)" }}
            >
              <Zap size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight" style={{ color: "#1E293B" }}>
                ScreenNova
              </div>
              <div className="text-[10px]" style={{ color: "#94A3B8" }}>Candidate Portal</div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5">
            {NAV_ITEMS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => setActiveNav(label)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background:
                    activeNav === label
                      ? "linear-gradient(90deg,#EEF2FF,#F0FDF4)"
                      : "transparent",
                  color: activeNav === label ? "#4F46E5" : "#64748B",
                  boxShadow:
                    activeNav === label
                      ? "0 0 0 1px rgba(99,102,241,0.15)"
                      : "none",
                }}
              >
                <Icon size={16} strokeWidth={activeNav === label ? 2.5 : 1.8} />
                {label}
                {activeNav === label && (
                  <ChevronRight size={12} className="ml-auto opacity-60" />
                )}
              </button>
            ))}
          </nav>

          {/* Resume Status pill */}
          <div
            className="mx-1 p-3 rounded-xl"
            style={{
              background: isResumeReady
                ? "rgba(236,253,245,0.90)"
                : "rgba(241,245,249,0.80)",
              border: isResumeReady
                ? "1px solid rgba(167,243,208,0.5)"
                : "1px solid transparent",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{
                  background: isResumeReady
                    ? "linear-gradient(135deg,#34D399,#059669)"
                    : "linear-gradient(135deg,#818CF8,#6EE7B7)",
                }}
              >
                {isResumeReady ? <CheckCircle size={14} /> : <User size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs font-semibold truncate"
                  style={{ color: isResumeReady ? "#065F46" : "#1E293B" }}
                >
                  {isResumeReady ? "Profile Ready" : "Candidate"}
                </div>
                <div className="text-[10px]" style={{ color: "#94A3B8" }}>
                  {isResumeReady ? "Resume parsed ✓" : "Upload resume to begin"}
                </div>
              </div>
              <MoreHorizontal size={14} color="#94A3B8" />
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "#0F172A" }}>
                My Dashboard
              </h1>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  borderColor: "#E2E8F0",
                  color: "#64748B",
                }}
              >
                <Search size={14} />
                <span>Search jobs…</span>
              </div>
              <button
                className="relative p-2 rounded-xl border"
                style={{ background: "rgba(255,255,255,0.7)", borderColor: "#E2E8F0" }}
              >
                <Bell size={16} color="#64748B" />
                <span
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: "#EF4444" }}
                />
              </button>
            </div>
          </div>

          {/* ─ KPI Row ─ */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Open Roles",
                value: isLoadingJobs ? "…" : jobs.length,
                sub: "available positions",
                color: "#818CF8",
                icon: Briefcase,
              },
              {
                label: "Ready to Interview",
                value: isLoadingJobs ? "…" : approvedJobs.length,
                sub: "questions approved by HR",
                color: "#34D399",
                icon: Shield,
              },
              {
                label: "Profile",
                value: isResumeReady ? "Active" : "Pending",
                sub: isResumeReady ? "Resume parsed & ready" : "Upload your resume",
                color: isResumeReady ? "#34D399" : "#FCD34D",
                icon: User,
              },
            ].map(({ label, value, sub, color, icon: Icon }) => (
              <GlassCard key={label} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}22` }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <ArrowUpRight size={14} color="#CBD5E1" />
                </div>
                <div className="text-2xl font-bold mb-0.5" style={{ color: "#0F172A" }}>
                  {value}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "#64748B" }}>
                  {label}
                </div>
                <div className="text-[11px]" style={{ color: "#94A3B8" }}>{sub}</div>
              </GlassCard>
            ))}
          </div>

          {/* ─ Bento: Upload + Jobs ─ */}
          <div className="grid grid-cols-3 gap-4">

            {/* Resume Upload Card */}
            <GlassCard className="p-5 flex flex-col">
              <h2 className="font-semibold text-sm mb-1" style={{ color: "#0F172A" }}>
                Your Profile
              </h2>
              <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>
                Upload your resume so the AI can tailor your interview questions.
              </p>

              {!isResumeReady ? (
                <>
                  <label
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className="flex-1 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
                    style={{
                      border: isDragging
                        ? "2px dashed #818CF8"
                        : "2px dashed #CBD5E1",
                      background: isDragging
                        ? "rgba(238,242,255,0.6)"
                        : "rgba(248,250,252,0.6)",
                      padding: "28px 16px",
                    }}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={28} className="animate-spin mb-3" style={{ color: "#818CF8" }} />
                        <span className="text-xs font-semibold" style={{ color: "#4F46E5" }}>
                          Parsing with AI…
                        </span>
                        <span className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
                          Extracting skills &amp; experience
                        </span>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                          style={{ background: "linear-gradient(135deg,#EEF2FF,#ECFDF5)" }}
                        >
                          <UploadCloud size={20} color="#6366F1" />
                        </div>
                        <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                          {isDragging ? "Drop to upload" : "Upload PDF Resume"}
                        </span>
                        <span className="text-[11px] mt-1.5" style={{ color: "#94A3B8" }}>
                          Drag & drop or click to browse
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={isUploading}
                    />
                  </label>

                  {uploadError && (
                    <div
                      className="mt-3 flex items-center gap-2 p-2.5 rounded-xl text-xs"
                      style={{ background: "#FFF1F2", color: "#E11D48" }}
                    >
                      <X size={12} />
                      {uploadError}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  {/* Success state */}
                  <div
                    className="p-4 rounded-xl flex items-center gap-3"
                    style={{ background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#34D399,#059669)" }}
                    >
                      <CheckCircle size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold" style={{ color: "#065F46" }}>
                        Profile Parsed!
                      </div>
                      <div
                        className="text-[11px] truncate"
                        style={{ color: "#059669" }}
                        title={file?.name}
                      >
                        {file?.name ?? "Resume uploaded"}
                      </div>
                    </div>
                  </div>

                  {/* What happens next */}
                  <div className="space-y-2 flex-1">
                    {[
                      { icon: Sparkles, text: "AI extracted your skills & projects" },
                      { icon: Shield,   text: "Questions tailored to your profile" },
                      { icon: Clock,    text: "Interviews are timed & evaluated live" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "#EEF2FF" }}
                        >
                          <Icon size={11} color="#6366F1" />
                        </div>
                        <span className="text-xs" style={{ color: "#64748B" }}>{text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Re-upload */}
                  <label
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-slate-100"
                    style={{ border: "1px dashed #CBD5E1", color: "#64748B" }}
                  >
                    <RefreshCw size={11} /> Re-upload Resume
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleUpload}
                    />
                  </label>
                </div>
              )}
            </GlassCard>

            {/* Open Positions — 2 cols */}
            <GlassCard className="col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
                    Open Positions
                  </h2>
                  {!isResumeReady && (
                    <p className="text-[11px] mt-0.5" style={{ color: "#F59E0B" }}>
                      ⚠ Upload your resume first to unlock interviews
                    </p>
                  )}
                </div>
                <button
                  onClick={loadJobs}
                  className="text-xs font-medium flex items-center gap-1 transition-all hover:opacity-70"
                  style={{ color: "#6366F1" }}
                >
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {isLoadingJobs ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-indigo-400" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "#F1F5F9" }}
                  >
                    <Briefcase size={18} color="#94A3B8" />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#64748B" }}>
                    No open positions right now
                  </p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>
                    Check back soon — new roles are added regularly
                  </p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "420px" }}>
                  {jobs.map(job => {
                    const skillsList: string[] = job.required_skills
                      ? job.required_skills
                          .split(",")
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                          .slice(0, 5)
                      : [];

                    const isApproved = job.questions_approved;
                    const isStarting = startingJobId === job.id;

                    return (
                      <div
                        key={job.id}
                        className="p-4 rounded-xl transition-all hover:scale-[1.005] hover:shadow-sm"
                        style={{
                          background: "rgba(248,250,252,0.80)",
                          border: "1px solid rgba(226,232,240,0.70)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: job info */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: "linear-gradient(135deg,#EEF2FF,#ECFDF5)" }}
                            >
                              <Briefcase size={16} color="#6366F1" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <h3
                                  className="text-sm font-bold"
                                  style={{ color: "#0F172A" }}
                                >
                                  {job.title}
                                </h3>
                                {/* Approved badge */}
                                {isApproved ? (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ background: "#ECFDF5", color: "#059669" }}
                                  >
                                    ✓ Ready
                                  </span>
                                ) : (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ background: "#FFF7ED", color: "#D97706" }}
                                  >
                                    Pending Approval
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-xs mb-2 line-clamp-1"
                                style={{ color: "#64748B" }}
                              >
                                {job.description || "Technical Role"}
                              </p>
                              {/* Skills */}
                              {skillsList.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {skillsList.map((skill, i) => (
                                    <SkillTag key={skill} label={skill} idx={i} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: CTA */}
                          <button
                            onClick={() => handleStartInterview(job.id)}
                            disabled={!isResumeReady || !isApproved || isStarting}
                            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            style={{
                              background:
                                isResumeReady && isApproved
                                  ? "linear-gradient(135deg,#6366F1,#818CF8)"
                                  : "#94A3B8",
                              boxShadow:
                                isResumeReady && isApproved
                                  ? "0 4px 14px rgba(99,102,241,0.3)"
                                  : "none",
                              minWidth: "140px",
                              justifyContent: "center",
                            }}
                            title={
                              !isResumeReady
                                ? "Upload your resume first"
                                : !isApproved
                                ? "HR hasn't approved questions yet"
                                : "Start Interview"
                            }
                          >
                            {isStarting ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Generating…
                              </>
                            ) : (
                              <>
                                <PlayCircle size={14} />
                                Start Interview
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>

          {/* ─ How It Works ─ */}
          <GlassCard className="p-5">
            <h2 className="font-semibold text-sm mb-4" style={{ color: "#0F172A" }}>
              How It Works
            </h2>
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  step: "01",
                  icon: FileText,
                  title: "Upload Resume",
                  desc: "Our AI extracts your skills, experience & projects to personalise your interview.",
                  color: "#818CF8",
                },
                {
                  step: "02",
                  icon: Briefcase,
                  title: "Pick a Role",
                  desc: "Browse open positions. Only roles with HR-approved questions are available.",
                  color: "#34D399",
                },
                {
                  step: "03",
                  icon: Zap,
                  title: "AI Interview",
                  desc: "Answer 10 adaptive questions in your own time. Voice input supported.",
                  color: "#FCD34D",
                },
                {
                  step: "04",
                  icon: CheckCircle,
                  title: "Instant Results",
                  desc: "Get a detailed scorecard with tech, communication & confidence scores.",
                  color: "#F9A8D4",
                },
              ].map(({ step, icon: Icon, title, desc, color }) => (
                <div key={step} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}22` }}
                    >
                      <Icon size={15} style={{ color }} />
                    </div>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: `${color}` }}
                    >
                      STEP {step}
                    </span>
                  </div>
                  <h3
                    className="text-sm font-semibold mb-1"
                    style={{ color: "#0F172A" }}
                  >
                    {title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>

        </main>
      </div>
    </Layout>
  );
}