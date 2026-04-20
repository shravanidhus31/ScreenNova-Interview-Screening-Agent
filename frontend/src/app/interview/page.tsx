"use client";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, Send, ChevronRight, BookOpen,
  Volume2, Loader2, CheckCircle, Clock, Zap, AlertCircle
} from "lucide-react";

import { submitResponse, evaluateSession } from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  id: string | number;
  type: "technical" | "behavioral" | "scenario";
  text: string;
  hint?: string;
  timeLimit: number; // seconds
}

interface Evaluation {
  techScore: number;
  commScore: number;
  confScore: number;
  finalScore: number;
  verdict: "shortlisted" | "rejected";
  explanation: string;
  strengths: string[];
  improvements: string[];
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_QUESTIONS: Question[] = [
  {
    id: 1,
    type: "technical",
    text: "Can you explain how transformer-based models like BERT differ from traditional RNN architectures, and when you would choose one over the other?",
    hint: "Focus on attention mechanisms and parallelization.",
    timeLimit: 120,
  },
  {
    id: 2,
    type: "behavioral",
    text: "Describe a situation where you had to debug a production ML model that was underperforming. Walk me through your diagnostic process.",
    hint: "Use STAR method: Situation, Task, Action, Result.",
    timeLimit: 150,
  },
  {
    id: 3,
    type: "scenario",
    text: "You're given a dataset with 40% missing values. The client needs results in 48 hours. What's your strategy for handling the missing data and still delivering reliable insights?",
    hint: "Consider imputation, domain knowledge, and model robustness.",
    timeLimit: 120,
  },
];

const MOCK_EVALUATION: Evaluation = {
  techScore: 88,
  commScore: 79,
  confScore: 82,
  finalScore: 84,
  verdict: "shortlisted",
  explanation: "The candidate demonstrated strong conceptual understanding of transformer architectures and showed clear analytical thinking during the scenario-based question. Their communication was structured and showed the ability to break down complex ideas effectively.",
  strengths: ["Deep technical knowledge of ML architectures", "Clear and structured communication style", "Strong problem-solving approach under constraints"],
  improvements: ["Could elaborate more on real-world deployment challenges", "Consider mentioning monitoring and observability in production scenarios"],
};

const TYPE_COLORS = {
  technical: { bg: "#EEF2FF", color: "#4F46E5", label: "Technical" },
  behavioral: { bg: "#ECFDF5", color: "#059669", label: "Behavioral" },
  scenario: { bg: "#FFF7ED", color: "#D97706", label: "Scenario" },
};

// ─── Score Progress Bar ────────────────────────────────────────────────────────
function ScoreBar({ label, value, color, delay = 0 }: { label: string; value: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 100 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "#64748B" }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: "#0F172A" }}>{value}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Voice Indicator ───────────────────────────────────────────────────────────
function VoiceIndicator({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-10 h-10">
      {active && (
        <>
          <span className="absolute w-full h-full rounded-full animate-ping opacity-20"
            style={{ background: "#34D399" }} />
          <span className="absolute w-8 h-8 rounded-full animate-ping opacity-30"
            style={{ background: "#34D399", animationDelay: "0.3s" }} />
        </>
      )}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          background: active ? "linear-gradient(135deg,#34D399,#059669)" : "rgba(226,232,240,0.80)",
          boxShadow: active ? "0 0 16px rgba(52,211,153,0.4)" : "none",
        }}
      >
        {active ? <Mic size={14} className="text-white" /> : <MicOff size={14} color="#94A3B8" />}
      </div>
    </div>
  );
}

// ─── Countdown Timer ───────────────────────────────────────────────────────────
function CountdownTimer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const pct = remaining / totalSeconds;

  const color = pct > 0.5 ? "#34D399" : pct > 0.25 ? "#FCD34D" : "#F87171";
  const r = 22, circ = 2 * Math.PI * r;

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const t = setInterval(() => setRemaining(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, onExpire]);

  const m = Math.floor(remaining / 60).toString().padStart(2, "0");
  const s = (remaining % 60).toString().padStart(2, "0");
  const dash = pct * circ;

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="absolute rotate-[-90deg]">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#E2E8F0" strokeWidth="3" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }} />
      </svg>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{m}:{s}</span>
    </div>
  );
}

// ─── Glass Card ────────────────────────────────────────────────────────────────
function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{
        background: "rgba(255,255,255,0.65)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "rgba(226,232,240,0.80)",
        boxShadow: "0 2px 24px rgba(100,116,139,0.07), 0 0 0 1px rgba(255,255,255,0.55) inset",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ─── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ evaluation, onFinish }: { evaluation: Evaluation, onFinish: () => void }) {
  const isShortlisted = evaluation.verdict === "shortlisted";

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      {/* Verdict Hero */}
      <GlassCard className="p-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: isShortlisted ? "linear-gradient(135deg,#34D399,#059669)" : "linear-gradient(135deg,#FB7185,#E11D48)" }}>
          {isShortlisted
            ? <CheckCircle size={28} className="text-white" />
            : <AlertCircle size={28} className="text-white" />}
        </div>
        <h2 className="text-2xl font-bold mb-1" style={{ color: "#0F172A" }}>
          {isShortlisted ? "🎉 Congratulations!" : "Thank You for Applying"}
        </h2>
        <p className="text-sm" style={{ color: "#64748B" }}>
          {isShortlisted
            ? "You've been shortlisted. Our HR team will reach out within 48 hours."
            : "We appreciate your time. You'll receive detailed feedback via email."}
        </p>

        {/* Score Badge */}
        <div className="mt-6 inline-flex items-center gap-3 px-6 py-3 rounded-2xl"
          style={{ background: isShortlisted ? "#ECFDF5" : "#FFF1F2", border: `1px solid ${isShortlisted ? "#A7F3D0" : "#FECDD3"}` }}>
          <span className="text-3xl font-black" style={{ color: isShortlisted ? "#059669" : "#E11D48" }}>
            {evaluation.finalScore}
          </span>
          <div className="text-left">
            <div className="text-xs font-semibold" style={{ color: isShortlisted ? "#059669" : "#E11D48" }}>Final Score</div>
            <div className="text-[10px]" style={{ color: "#94A3B8" }}>out of 100</div>
          </div>
        </div>
      </GlassCard>

      {/* Score Breakdown */}
      <GlassCard className="p-6">
        <h3 className="font-semibold text-sm mb-5 flex items-center gap-2" style={{ color: "#0F172A" }}>
          <BarChart3Icon /> Score Breakdown
        </h3>
        <div className="space-y-4">
          <ScoreBar label="Technical Accuracy" value={evaluation.techScore} color="#818CF8" delay={0} />
          <ScoreBar label="Communication Clarity" value={evaluation.commScore} color="#34D399" delay={150} />
          <ScoreBar label="Confidence" value={evaluation.confScore} color="#FCD34D" delay={300} />
          <div className="pt-3 border-t" style={{ borderColor: "#F1F5F9" }}>
            <ScoreBar label="Overall Score" value={evaluation.finalScore} color={isShortlisted ? "#6366F1" : "#F87171"} delay={450} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-[10px]" style={{ color: "#94A3B8" }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" />Technical ×0.6</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Communication ×0.3</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-300" />Confidence ×0.1</span>
        </div>
      </GlassCard>

      {/* AI Explanation */}
      <GlassCard className="p-6"
        style={{ background: "linear-gradient(135deg,rgba(238,242,255,0.7),rgba(236,253,245,0.7))" }}>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: "#0F172A" }}>
          <Zap size={14} color="#6366F1" /> AI Assessment
        </h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#475569" }}>{evaluation.explanation}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl" style={{ background: "rgba(236,253,245,0.80)" }}>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#059669" }}>
              <CheckCircle size={11} /> Strengths
            </div>
            <ul className="space-y-1.5">
              {evaluation.strengths.map(s => (
                <li key={s} className="text-xs" style={{ color: "#047857" }}>· {s}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 rounded-xl" style={{ background: "rgba(255,247,237,0.80)" }}>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#D97706" }}>
              <AlertCircle size={11} /> Grow In
            </div>
            <ul className="space-y-1.5">
              {evaluation.improvements.map(i => (
                <li key={i} className="text-xs" style={{ color: "#92400E" }}>· {i}</li>
              ))}
            </ul>
          </div>
        </div>
      </GlassCard>

      {/* NEW RETURN BUTTON */}
      <button
        onClick={onFinish}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg,#0F172A,#334155)", boxShadow: "0 4px 16px rgba(15,23,42,0.25)" }}>
        Return to Dashboard <ChevronRight size={18} />
      </button>
    </div>
  );
}
function BarChart3Icon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

// ─── Main Interview Component ──────────────────────────────────────────────────
export default function Interview() {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "interview" | "loading" | "result">("intro");
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // REAL DATA STATES
  const [realQuestions, setRealQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [realEvaluation, setRealEvaluation] = useState<any>(null); // Stores the final AI scorecard

  // 1. LOAD THE REAL QUESTIONS FROM LOCAL STORAGE ON MOUNT
  useEffect(() => {
    const storedQs = localStorage.getItem("current_questions");
    const storedId = localStorage.getItem("current_session_id");
    if (storedQs && storedId) {
      setRealQuestions(JSON.parse(storedQs));
      setSessionId(storedId);
    } else {
      setRealQuestions(MOCK_QUESTIONS); // Fallback if tested manually
    }
  }, []);

  const currentQ = realQuestions[questionIdx];
  const progress = realQuestions.length > 0 ? ((questionIdx) / realQuestions.length) * 100 : 0;

  const handleTimeExpire = useCallback(() => {
    if (step === "interview") handleSubmitAnswer();
  }, [step, answer]);

  const handleSubmitAnswer = async () => {
    if (!answer.trim() && step === "interview") return;
    setIsSubmitting(true);
    
    try {
      // 2. SEND THE REAL ANSWER TO THE FASTAPI BACKEND
      if (sessionId && currentQ.id) {
        await submitResponse(sessionId, String(currentQ.id), answer, voiceActive);
      }
      
      setAnswer("");
      setIsSubmitting(false);

      if (questionIdx < realQuestions.length - 1) {
        setQuestionIdx(i => i + 1);
      } else {
        // 3. IF LAST QUESTION, TRIGGER EVALUATION!
        setStep("loading");
        
        // Call the AI Evaluator endpoint
        if (sessionId) {
          const evalResult: any = await evaluateSession(sessionId);
          
          // Map backend data to your frontend UI structure
          setRealEvaluation({
            techScore:   evalResult.scores?.technical   ?? 0,
            commScore:   evalResult.scores?.communication ?? 0,
            confScore:   evalResult.scores?.confidence  ?? 0,
            finalScore:  evalResult.scores?.final       ?? 0,
            verdict:     evalResult.decision ?? "pending",
            explanation: evalResult.explanation ?? "No explanation available.",
            strengths:    ["Strong keyword matching", "Clear AI-detected communication context"],
            improvements: ["Review the AI explanation above for specific details"],
          });
        } else {
           setRealEvaluation(MOCK_EVALUATION);
        }
        
        setStep("result");
      }
    } catch (err) {
      console.error("Failed to submit response", err);
      setIsSubmitting(false);
      alert("Failed to submit response. Please try again.");
    }
  };

  const toggleVoice = () => setVoiceActive(v => !v);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [answer]);

  // Prevent rendering if questions haven't loaded yet
  if (realQuestions.length === 0) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // ── Intro Screen ──────────────────────────────────────────────────────────────
  if (step === "intro") {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 py-12">
        <GlassCard className="max-w-md w-full p-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: "linear-gradient(135deg,#818CF8,#34D399)" }}>
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F172A" }}>ScreenNova Interview</h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "#64748B" }}>
            You'll be asked <strong>{realQuestions.length} adaptive questions</strong> tailored to your resume. 
            Each question has a time limit. You can respond via text or voice.
          </p>

          <div className="space-y-2.5 mb-7">
            {[
              { icon: Clock, text: `~${Math.round(realQuestions.reduce((s, q) => s + (q.timeLimit || 120), 0) / 60)} minutes total` },
              { icon: BookOpen, text: `${realQuestions.length} AI-tailored questions` },
              { icon: Mic, text: "Voice input supported via Web Speech API" },
              { icon: Volume2, text: "AI evaluation for each response — transparent scoring" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm" style={{ color: "#475569" }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#EEF2FF" }}>
                  <Icon size={12} color="#6366F1" />
                </div>
                {text}
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep("interview")}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
            Begin Interview <ChevronRight size={16} />
          </button>
        </GlassCard>
      </div>
    );
  }

  // ── Loading/Evaluating Screen ─────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#818CF8,#34D399)" }}>
          <Loader2 size={28} className="text-white animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-base mb-1" style={{ color: "#0F172A" }}>Evaluating your responses…</p>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "#94A3B8" }}>
            Our Agentic AI is cross-referencing your answers with the ideal solutions, measuring semantic similarity, and calculating your final scores.
          </p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0,1,2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: "#818CF8", animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

// ── Result Screen ─────────────────────────────────────────────────────────────
  if (step === "result" && realEvaluation) {
    return (
      <ResultScreen 
        evaluation={realEvaluation} 
        onFinish={() => router.push("/candidate")} 
      />
    );
  }

  // ── Interview Screen ──────────────────────────────────────────────────────────
  const tc = TYPE_COLORS[currentQ.type || "technical"] || TYPE_COLORS["technical"];

  return (
    <Layout>
    <div className="flex flex-col items-center min-h-screen px-4 py-8">

      {/* Progress header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#818CF8,#34D399)" }}>
              <Zap size={12} className="text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#64748B" }}>ScreenNova AI</span>
          </div>
          <span className="text-xs" style={{ color: "#94A3B8" }}>
            Question {questionIdx + 1} of {realQuestions.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg,#818CF8,#34D399)" }} />
        </div>
      </div>

      {/* Question Card */}
      <GlassCard className="w-full max-w-2xl p-7 mb-4">
        <div className="flex items-start justify-between mb-5">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide"
            style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
          <CountdownTimer totalSeconds={currentQ.timeLimit || 120} onExpire={handleTimeExpire} />
        </div>

        <p className="text-base font-medium leading-relaxed mb-4" style={{ color: "#0F172A" }}>
          {currentQ.text}
        </p>

        {currentQ.hint && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
            style={{ background: "rgba(238,242,255,0.60)", color: "#4F46E5" }}>
            <BookOpen size={12} className="mt-0.5 flex-shrink-0" />
            <span>{currentQ.hint}</span>
          </div>
        )}
      </GlassCard>

      {/* Answer Input */}
      <GlassCard className="w-full max-w-2xl p-4">
        <textarea
          ref={textareaRef}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your response here, or use the voice input button below…"
          className="w-full resize-none outline-none bg-transparent text-sm leading-relaxed placeholder-slate-300"
          style={{ color: "#0F172A", minHeight: "80px", maxHeight: "160px", fontFamily: "inherit" }}
          rows={3}
        />
        <div className="flex items-center justify-between pt-3 mt-2"
          style={{ borderTop: "1px solid rgba(226,232,240,0.70)" }}>

          {/* Voice toggle */}
          <div className="flex items-center gap-2.5">
            <button onClick={toggleVoice} className="transition-all hover:scale-105 active:scale-95">
              <VoiceIndicator active={voiceActive} />
            </button>
            <span className="text-xs" style={{ color: voiceActive ? "#059669" : "#94A3B8" }}>
              {voiceActive ? "Listening…" : "Click to use voice"}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmitAnswer}
            disabled={!answer.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)", boxShadow: answer.trim() ? "0 4px 14px rgba(99,102,241,0.3)" : "none" }}>
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {questionIdx === realQuestions.length - 1 ? "Finish & Evaluate" : "Next Question"}
          </button>
        </div>
      </GlassCard>

      <p className="mt-4 text-xs" style={{ color: "#CBD5E1" }}>
        Take your time — your answer is being recorded securely.
      </p>
    </div>
    </Layout>
  );
}