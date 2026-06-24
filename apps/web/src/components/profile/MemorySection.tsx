"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { X } from "lucide-react";

interface Memory {
  id: string;
  kind: string;
  content: string;
  source: string;
  pinned: boolean;
  createdAt: string;
}

const KINDS = ["fact", "preference", "goal", "event"] as const;
type Kind = (typeof KINDS)[number];

/**
 * "Memory" management — the user's window into what the AI astrologer
 * persistently remembers about them. Reads/writes /memory (JWT). Everything is
 * user-controlled: add a fact/preference/goal, or remove anything at any time.
 */
export default function MemorySection({ token }: { token: string }) {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<Kind>("fact");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindLabel: Record<Kind, string> = {
    fact: t.memory.kindFact,
    preference: t.memory.kindPreference,
    goal: t.memory.kindGoal,
    event: t.memory.kindEvent,
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get<Memory[]>("/memory", { token })
      .then((res) => {
        if (!cancelled) setMemories(res);
      })
      .catch(() => {
        if (!cancelled) {
          setMemories([]);
          setError(t.memory.loadFailed);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, t.memory.loadFailed]);

  const add = async () => {
    const trimmed = content.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError(null);
    try {
      const created = await api.post<Memory>("/memory", { content: trimmed, kind }, { token });
      setMemories((prev) => [created, ...(prev ?? [])]);
      setContent("");
    } catch (err: any) {
      setError(err?.message || t.memory.addFailed);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    const previous = memories;
    setMemories((prev) => (prev ?? []).filter((m) => m.id !== id)); // optimistic
    try {
      await api.delete(`/memory/${id}`, { token });
    } catch {
      setMemories(previous ?? null); // rollback
    }
  };

  return (
    <section className="mt-8 pt-8 border-t border-[rgba(12,8,5,0.10)]">
      <h3 className="font-display text-lg font-semibold text-surface-950 mb-2">{t.memory.title}</h3>
      <p className="text-sm text-secondary mb-4 max-w-xl leading-relaxed">{t.memory.subtitle}</p>

      {/* Existing memories */}
      {memories === null ? (
        <p className="text-sm text-secondary">…</p>
      ) : memories.length === 0 ? (
        <p className="text-sm text-[rgba(12,8,5,0.46)] mb-4">{t.memory.empty}</p>
      ) : (
        <ul className="space-y-2 mb-4 max-w-xl">
          {memories.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-xl bg-[rgba(255,252,245,0.78)] px-4 py-3 border border-[rgba(12,8,5,0.06)]"
            >
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary-500/12 text-primary-700 mt-0.5 shrink-0">
                {kindLabel[(KINDS as readonly string[]).includes(m.kind) ? (m.kind as Kind) : "fact"]}
              </span>
              <p className="text-sm text-surface-950 flex-1">{m.content}</p>
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label={t.memory.remove}
                className="text-[rgba(12,8,5,0.40)] hover:text-red-500 transition-colors focus-ring rounded shrink-0"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add a memory */}
      <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          aria-label={t.memory.kindLabel}
          className="rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-3 py-2.5 text-sm text-surface-950 focus-ring sm:w-36"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel[k]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={content}
          maxLength={500}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder={t.memory.placeholder}
          className="flex-1 rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-4 py-2.5 text-sm text-surface-950 focus-ring"
        />
        <button
          type="button"
          onClick={add}
          disabled={!content.trim() || adding}
          className="rounded-xl btn-primary px-5 py-2.5 text-sm font-semibold focus-ring disabled:opacity-50"
        >
          {adding ? t.memory.adding : t.memory.add}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
