"use client";

import React, { useState } from "react";
import type { UserDetail } from "./types";

export function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: UserDetail;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    credits: user.credits,
    gender: user.gender || "",
    preferredLanguage: user.preferredLanguage,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      role: form.role,
      credits: Number(form.credits),
      gender: form.gender || null,
      preferredLanguage: form.preferredLanguage,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="surface-card w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-ink-900">Edit User</h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-ink-500 mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30" />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ink-500 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30" />
            </div>
            <div>
              <label className="block text-xs text-ink-500 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-700 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30">
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ink-500 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-700 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30">
                <option value="USER">User</option>
                <option value="PREMIUM">Premium</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-500 mb-1">Credits</label>
              <input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Language</label>
            <select value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-700 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="bn">Bengali</option>
              <option value="mr">Marathi</option>
              <option value="gu">Gujarati</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl btn-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl surface-card text-sm text-ink-700 hover:bg-black/10">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
