"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";

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
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t.chat.welcomeMsg },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] fade-in">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? t.common.close : t.chat.selectTopic}
        aria-expanded={sidebarOpen}
        aria-controls="chat-topic-sidebar"
        className="focus-ring lg:hidden fixed top-[4.5rem] left-3 z-30 p-2 rounded-lg bg-surface-50 border divider"
      >
        <svg className="w-4 h-4 text-surface-900/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
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
      <aside id="chat-topic-sidebar" className={`fixed lg:relative z-20 w-56 h-full bg-surface-50 border-r divider p-3 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="mb-4 px-1">
          <h2 className="text-sm font-semibold text-surface-900 mb-0.5">{t.chat.vedicAstrologer}</h2>
          <p className="text-[11px] text-surface-900/30">{t.chat.selectTopic}</p>
        </div>

        <div role="tablist" aria-label={t.chat.selectTopic} className="space-y-0.5 flex-1">
          {categories.map((cat) => (
            <button key={cat.id} role="tab" aria-selected={selectedCategory === cat.id} onClick={() => { setSelectedCategory(cat.id); setSidebarOpen(false); }}
              className={`focus-ring w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors duration-150 ${selectedCategory === cat.id ? "bg-surface-900/[0.08] text-surface-900 font-medium" : "text-surface-900/70 hover:text-surface-900 hover:bg-surface-900/[0.03]"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        {!isAuthenticated && (
          <div className="surface-card p-3 mt-3">
            <button onClick={() => router.push("/auth")} className="focus-ring w-full py-1.5 text-[11px] font-medium rounded-md bg-surface-900/[0.04] text-primary-700 hover:bg-surface-900/[0.08] transition-colors">
              {t.chat.signIn}
            </button>
          </div>
        )}
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b divider">
          <div>
            <h3 className="font-medium text-surface-900 text-sm">{categories.find((c) => c.id === selectedCategory)?.label}</h3>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />{t.chat.online}
            </span>
          </div>
          <span className="text-[11px] text-surface-900/20 border divider px-2 py-0.5 rounded-md">{t.chat.askAnything}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {messages.length === 1 && (
            <div className="mb-4">
              <p className="text-xs text-surface-900/60 mb-2">{t.chat.tryAsking}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="focus-ring px-3 py-1.5 rounded-lg border divider bg-surface-900/[0.02] text-[11px] text-surface-900/70 hover:text-surface-900 hover:bg-surface-900/[0.04] transition-colors">{q}</button>
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
              <div className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-primary-600 text-surface-50 rounded-br-md" : "bg-surface-900/[0.04] border divider text-surface-900/70 rounded-bl-md"}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-surface-900/[0.04] border divider px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-surface-900/30 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-surface-900/30 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1.5 h-1.5 bg-surface-900/30 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
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
          <p className="text-[10px] text-surface-900/40 text-center mt-2">{t.chat.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
