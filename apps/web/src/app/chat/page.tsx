"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import { ASTROLOGERS, getAstrologer } from "@/lib/astrologers";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { user, accessToken, isAuthenticated } = useAuthStore();

  const categories = [
    { id: "career", label: t.chat.career },
    { id: "relationship", label: t.chat.relationships },
    { id: "general", label: t.chat.general },
    { id: "kundli", label: t.chat.kundliTopic },
    { id: "remedy", label: t.chat.remediesTopic },
    { id: "wealth", label: t.chat.wealth },
    { id: "health", label: t.chat.health },
    { id: "numerology", label: t.chat.numerologyTopic },
  ];

  const suggestedQuestions = [t.chat.q1, t.chat.q2, t.chat.q3, t.chat.q4];
  const [selectedCategory, setSelectedCategory] = useState("career");
  // The chosen astrologer persona drives the consultation. Until one is
  // picked we show the roster; selecting one starts a fresh session.
  const [astrologerId, setAstrologerId] = useState<string | null>(null);
  const astrologer = getAstrologer(astrologerId);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t.chat.welcomeMsg },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Begin a consultation with the chosen astrologer: reset the thread and
  // seed a personalized greeting in their voice.
  const startConsultation = (id: string) => {
    const a = getAstrologer(id);
    if (!a) return;
    setAstrologerId(id);
    setSelectedCategory(a.category);
    setSessionId(null);
    setError("");
    setMessages([
      {
        role: "assistant",
        content: `Namaste 🙏 I'm ${a.name}. I've spent ${a.experienceYears} years guiding people on ${a.specialty.toLowerCase()}. Share what's on your mind, and I'll look into it for you.`,
      },
    ]);
  };

  const leaveConsultation = () => {
    setAstrologerId(null);
    setSessionId(null);
    setMessages([{ role: "assistant", content: t.chat.welcomeMsg }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!isAuthenticated) { router.push("/auth"); return; }

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setError("");

    try {
      const res = await api.post<any>("/chat/message", {
        sessionId, message: input, category: selectedCategory, locale,
        ...(astrologerId ? { astrologerId } : {}),
      }, { token: accessToken! });
      setSessionId(res.session.id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply.content }]);
    } catch (err: any) {
      // Differentiate so users know whether to retry (network) or act
      // (auth/rate-limit). The generic "Send failed" was unhelpful.
      let msg = err?.message || t.chat.sendFailed;
      if (err?.isTimeout || err?.isNetwork) {
        msg = "Can't reach the server. Check your connection and try again.";
      } else if (err?.status === 401) {
        msg = "Your session expired. Please log in again.";
      } else if (err?.status === 429) {
        msg = "You're sending messages too quickly. Pause for a moment, then retry.";
      } else if ((err?.status ?? 0) >= 500) {
        msg = "Our astrologer is resting. Please try again in a few seconds.";
      }
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: t.chat.errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Astrologer picker ──────────────────────────────────────────────
  // Shown until the user selects who they want to consult. This is the
  // "Chat with Astrologer" entry point.
  if (!astrologer) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14 fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-950 tracking-tight mb-2">
            Talk to an Astrologer
          </h1>
          <p className="text-sm text-[rgba(12,8,5,0.72)] max-w-md mx-auto">
            Choose an astrologer to start a private consultation. Each specialises in a
            different area of your life.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {ASTROLOGERS.map((a) => (
            <button
              key={a.id}
              onClick={() => startConsultation(a.id)}
              className="surface-card group flex items-start gap-4 p-5 text-left transition-all hover:shadow-md"
            >
              <span className="relative shrink-0">
                <Image
                  src={a.photo}
                  alt={a.name}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-full object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${a.online ? "bg-emerald-500" : "bg-gray-400"}`}
                  aria-label={a.online ? "Online" : "Offline"}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold text-surface-950 truncate">{a.name}</span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                    ★ {a.rating}
                  </span>
                </span>
                <span className="block text-xs font-medium text-primary-700 mb-1">{a.specialty}</span>
                <span className="block text-xs text-[rgba(12,8,5,0.72)] leading-snug mb-2">{a.tagline}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[rgba(12,8,5,0.66)]">
                  <span>{a.experienceYears}+ yrs</span>
                  <span>{a.reviews.toLocaleString("en-IN")} reviews</span>
                  <span>{a.languages.join(", ")}</span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {!isAuthenticated && (
          <p className="text-center text-xs text-[rgba(12,8,5,0.66)] mt-6">
            You&apos;ll be asked to sign in when you send your first message.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] fade-in">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? t.common.close : t.chat.selectTopic}
        aria-expanded={sidebarOpen}
        aria-controls="chat-topic-sidebar"
        className="focus-ring lg:hidden fixed top-[4.5rem] left-3 z-30 p-2 rounded-lg bg-[rgba(255,252,245,0.92)] border divider shadow-sm"
      >
        <svg className="w-4 h-4 text-emphasis" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Tap-to-dismiss overlay when the sidebar is open on mobile */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t.common.close}
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-10 bg-black/50"
        />
      )}

      {/* Sidebar */}
      <aside id="chat-topic-sidebar" className={`fixed lg:relative z-20 w-56 h-full bg-[rgba(255,252,245,0.92)] border-r divider p-3 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="mb-4 px-1">
          <h2 className="text-sm font-semibold text-surface-950 mb-0.5">{t.chat.vedicAstrologer}</h2>
          <p className="text-[11px] text-[rgba(12,8,5,0.66)]">{t.chat.selectTopic}</p>
        </div>

        <div role="tablist" aria-label={t.chat.selectTopic} className="space-y-0.5 flex-1">
          {categories.map((cat) => (
            <button key={cat.id} role="tab" aria-selected={selectedCategory === cat.id} onClick={() => { setSelectedCategory(cat.id); setSidebarOpen(false); }}
              className={`focus-ring w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors duration-150 ${selectedCategory === cat.id ? "bg-[rgba(12,8,5,0.05)] text-surface-950 font-medium" : "text-emphasis hover:text-surface-950 hover:bg-[rgba(255,252,245,0.78)]"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        {!isAuthenticated && (
          <div className="surface-card p-3 mt-3">
            <button onClick={() => router.push("/auth")} className="focus-ring w-full py-1.5 text-[11px] font-medium rounded-md bg-[rgba(255,252,245,0.86)] text-primary-300 hover:bg-[rgba(12,8,5,0.05)] transition-colors">
              {t.chat.signIn}
            </button>
          </div>
        )}
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — the astrologer the user is consulting */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b divider">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={leaveConsultation}
              aria-label="Back to astrologers"
              className="focus-ring -ml-1 rounded-lg p-1 text-[rgba(12,8,5,0.72)] hover:bg-[rgba(12,8,5,0.05)] hover:text-surface-950"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <Image src={astrologer.photo} alt={astrologer.name} width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
            <div className="min-w-0">
              <h3 className="font-medium text-surface-950 text-sm truncate">{astrologer.name}</h3>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-500">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {astrologer.online ? t.chat.online : t.chat.online}
              </span>
            </div>
          </div>
          <span className="hidden sm:inline text-[11px] text-[rgba(12,8,5,0.66)] border divider px-2 py-0.5 rounded-md">{astrologer.specialty}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {messages.length === 1 && (
            <div className="mb-4">
              <p className="text-xs text-secondary mb-2">{t.chat.tryAsking}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="focus-ring px-3 py-1.5 rounded-lg border divider bg-[rgba(255,252,245,0.70)] text-[11px] text-emphasis hover:text-surface-950 hover:bg-[rgba(255,252,245,0.86)] transition-colors">{q}</button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" aria-live="assertive" className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label={t.common.close}
                className="focus-ring rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-primary-600 text-white rounded-br-md" : "bg-[rgba(255,252,245,0.86)] border divider text-emphasis rounded-bl-md"}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-[rgba(255,252,245,0.86)] border divider px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 sm:px-6 pb-4 pt-2">
          <div className="flex gap-2">
            <label htmlFor="chat-input" className="sr-only">{t.chat.askAnything}</label>
            <input id="chat-input" type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder={t.chat.askPlaceholder}
              className="flex-1 px-3.5 py-2.5 rounded-xl surface-input text-sm" />
            <button
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              aria-label={t.chat.askAnything}
              className="focus-ring touch-target px-4 py-2.5 rounded-xl btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-[rgba(12,8,5,0.66)] text-center mt-2">{t.chat.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
