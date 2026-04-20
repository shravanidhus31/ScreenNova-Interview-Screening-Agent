"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, User, Shield, ArrowRight, Loader2 } from "lucide-react";
import Layout from "../components/Layout";
import { login, register } from "../lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "hr">("candidate");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLogin) {
        // 1. CALL FASTAPI LOGIN
        const res: any= await login({ email, password });
        // 2. SAVE JWT TOKEN
        localStorage.setItem("access_token", res.access_token);
        localStorage.setItem("user_role", res.role);
        
        // 3. ROUTE BASED ON ROLE
        if (res.role === "hr") {
          router.push("/hr");
        } else {
          router.push("/candidate");
        }
      } else {
        // 1. CALL FASTAPI REGISTER
        await register({ email, password, role });
        // Auto-switch to login after successful registration
        setIsLogin(true);
        setError("Registration successful! Please log in."); // Using error state temporarily for success message
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-screen px-4">
        <div 
          className="w-full max-w-md p-8 rounded-3xl border relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: "rgba(226,232,240,0.80)",
            boxShadow: "0 8px 40px rgba(100,116,139,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg,#818CF8,#34D399)" }}>
              <Zap size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>
              Welcome to ScreenNova
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "#64748B" }}>
              {isLogin ? "Sign in to continue to your dashboard" : "Create your account to get started"}
            </p>
          </div>

          {/* Error / Success Message */}
          {error && (
            <div className={`p-3 mb-6 rounded-xl text-sm text-center ${error.includes("successful") ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Role Selector (Only for Registration) */}
            {!isLogin && (
              <div className="flex p-1 rounded-xl bg-slate-100/80 mb-4">
                <button
                  type="button"
                  onClick={() => setRole("candidate")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${role === "candidate" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <User size={16} /> Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setRole("hr")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${role === "hr" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <Shield size={16} /> HR Admin
                </button>
              </div>
            )}

            {/* Email Input */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                suppressHydrationWarning
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                suppressHydrationWarning
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
              style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)", boxShadow: "0 4px 16px rgba(99,102,241,0.25)" }}
              suppressHydrationWarning
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
              {!isLoading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="mt-6 text-center text-sm" style={{ color: "#64748B" }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              suppressHydrationWarning
            >
              {isLogin ? "Register here" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}