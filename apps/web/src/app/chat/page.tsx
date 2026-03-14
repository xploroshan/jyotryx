"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";

const categories = [
  { id: "career", label: "Career", icon: "\uD83D\uDCBC", color: "from-blue-500 to-cyan-500" },
  { id: "relationship", label: "Relationships", icon: "\uD83D\uDC9E", color: "from-pink-500 to-rose-500" },
  { id: "general", label: "General", icon: "\u2B50", color: "from-emerald-500 to-green-500" },
  { id: "kundli", label: "Kundli", icon: "\uD83E\uDE90", color: "from-violet-500 to-purple-500" },
  { id: "remedy", label: "Remedies", icon: "\uD83D\uDD2E", color: "from-amber-500 to-yellow-500" },
];

const suggestedQuestions = [
  "What does my career look like in 2026?",
  "Is this a good time for investment?",
  "When will I find my life partner?",
  "What remedies can improve my health?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState("career");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Namaste! I am your AI Astrologer. I can help you with career guidance, relationship compatibility, financial predictions, and more based on Vedic astrology principles. Select a category and ask your question." },
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

    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setError("");

    try {
      const res = await api.post<any>("/chat/message", {
        sessionId,
        message: input,
        category: selectedCategory,
      }, { token: accessToken! });

      setSessionId(res.session.id);
      const reply: Message = { role: "assistant", content: res.reply.content };
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      const errorMsg: Message = { role: "assistant", content: "I apologize, there was an error processing your request. Please try again." };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Mobile sidebar toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-20 left-4 z-30 p-2 rounded-xl glass">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Category Sidebar */}
      <aside className={`fixed lg:relative z-20 w-64 h-full bg-gray-950/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-r border-white/10 p-4 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="mb-6">
          <h2 className="text-lg font-display font-bold text-gradient mb-1">AI Astrologer</h2>
          <p className="text-xs text-gray-500">Select a topic to begin</p>
        </div>

        <div className="space-y-2 flex-1">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat.id ? "glass bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${cat.color} text-base`}>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Credit Balance */}
        <div className="glass-card p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Credits Balance</span>
            <span className="text-sm font-bold text-gradient">{user?.credits ?? 0}</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full" style={{ width: `${Math.min(100, ((user?.credits ?? 0) / 100) * 100)}%` }} />
          </div>
          {!isAuthenticated && (
            <button onClick={() => router.push("/auth")} className="w-full mt-3 py-2 text-xs font-medium rounded-lg bg-white/5 text-primary-400 hover:bg-white/10 transition-all">
              Sign In to Chat
            </button>
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-lg">{categories.find((c) => c.id === selectedCategory)?.icon}</span>
            <div>
              <h3 className="font-semibold text-white text-sm">{categories.find((c) => c.id === selectedCategory)?.label} Astrologer</h3>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Online
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-500 glass px-3 py-1 rounded-full">1 credit per question</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
          {messages.length === 1 && (
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="px-3 py-2 rounded-xl glass text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-all">{q}</button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white rounded-br-sm" : "glass text-gray-200 rounded-bl-sm"}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="glass px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 sm:px-6 pb-4">
          <div className="flex gap-2 items-end">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder="Ask your question..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors" />
            <button onClick={handleSend} disabled={isTyping} className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-medium hover:from-primary-500 hover:to-mystic-500 transition-all disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">AI predictions are for entertainment and guidance purposes only.</p>
        </div>
      </div>
    </div>
  );
}
