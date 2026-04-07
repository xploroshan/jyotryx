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
  const { t } = useTranslation();
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
        sessionId, message: input, category: selectedCategory,
      }, { token: accessToken! });
      setSessionId(res.session.id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply.content }]);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      setMessages((prev) => [...prev, { role: "assistant", content: t.chat.errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Mobile sidebar toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-[4.5rem] left-3 z-30 p-2 rounded-lg bg-surface-950 border divider">
        <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-20 w-56 h-full bg-surface-950 border-r divider p-3 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="mb-4 px-1">
          <h2 className="text-sm font-semibold text-white mb-0.5">{t.chat.vedicAstrologer}</h2>
          <p className="text-[11px] text-white/30">{t.chat.selectTopic}</p>
        </div>

        <div className="space-y-0.5 flex-1">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors duration-150 ${selectedCategory === cat.id ? "bg-white/[0.08] text-white font-medium" : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        {!isAuthenticated && (
          <div className="surface-card p-3 mt-3">
            <button onClick={() => router.push("/auth")} className="w-full py-1.5 text-[11px] font-medium rounded-md bg-white/[0.04] text-primary-400 hover:bg-white/[0.08] transition-colors">
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
            <h3 className="font-medium text-white text-sm">{categories.find((c) => c.id === selectedCategory)?.label}</h3>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />{t.chat.online}
            </span>
          </div>
          <span className="text-[11px] text-white/20 border divider px-2 py-0.5 rounded-md">{t.chat.askAnything}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {messages.length === 1 && (
            <div className="mb-4">
              <p className="text-xs text-white/30 mb-2">{t.chat.tryAsking}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="px-3 py-1.5 rounded-lg border divider bg-white/[0.02] text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors">{q}</button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">{error}</div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-primary-600 text-white rounded-br-md" : "bg-white/[0.04] border divider text-white/70 rounded-bl-md"}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/[0.04] border divider px-4 py-3 rounded-2xl rounded-bl-md">
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
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder={t.chat.askPlaceholder}
              className="flex-1 px-3.5 py-2.5 rounded-xl surface-input text-sm" />
            <button onClick={handleSend} disabled={isTyping} className="px-4 py-2.5 rounded-xl btn-primary disabled:opacity-40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-white/15 text-center mt-2">{t.chat.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
