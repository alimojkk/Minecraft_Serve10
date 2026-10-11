"use client";

/**
 * صفحهٔ مدیریت حافظه — آمار، فیلتر، افزودن، ویرایش درون‌خطی، حذف، خروجی JSON
 */
import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Download,
  Filter,
  Pencil,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-react";
import { Btn, Card, Field, Label, PageTitle, Toggle } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";
import type {
  MemoryCategory,
  MemoryDTO,
  PublicSettings
} from "@/lib/types";

const CATEGORY_LABELS: Record<MemoryCategory | "all", string> = {
  all: "همه",
  profile: "مشخصات",
  preference: "ترجیح‌ها",
  goal: "اهداف",
  minecraft: "ماینکرفت",
  note: "یادداشت‌ها",
  other: "سایر"
};

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  profile: "bg-blue-500/20 text-blue-200",
  preference: "bg-violet-500/20 text-violet-200",
  goal: "bg-emerald-500/20 text-emerald-200",
  minecraft: "bg-lime-500/20 text-lime-200",
  note: "bg-amber-500/20 text-amber-200",
  other: "bg-slate-500/20 text-slate-200"
};

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryDTO[]>([]);
  const [category, setCategory] = useState<MemoryCategory | "all">("all");
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // فرم افزودن
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("note");

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ memories: MemoryDTO[] }>(
        `/api/memories?category=${category}`
      );
      setMemories(data.memories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در بارگذاری");
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => setSettings(d.settings))
      .catch(() => undefined);
  }, []);

  const addMemory = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      await apiSend("/api/memories", "POST", {
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory
      });
      setNewTitle("");
      setNewContent("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "افزودن ناموفق بود.");
    }
  };

  const saveEdit = async (id: number) => {
    try {
      await apiSend(`/api/memories/${id}`, "PATCH", { content: editText });
      setEditingId(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره ناموفق بود.");
    }
  };

  const removeMemory = async (m: MemoryDTO) => {
    if (!window.confirm(`حافظهٔ «${m.title}» حذف بشه؟`)) return;
    try {
      await apiSend(`/api/memories/${m.id}`, "DELETE");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حذف ناموفق بود.");
    }
  };

  const toggleAutoMemory = async (v: boolean) => {
    if (!settings) return;
    const next = await apiSend<{ settings: PublicSettings }>(
      "/api/settings",
      "PUT",
      { autoMemory: v }
    );
    setSettings(next.settings);
  };

  // آمار
  const stats: Array<{ label: string; value: number; color: string }> = [
    { label: "کل حافظه‌ها", value: memories.length, color: "text-neon-cyan" },
    {
      label: "ثبت خودکار",
      value: memories.filter((m) => m.source === "auto").length,
      color: "text-neon-green"
    },
    {
      label: "دستور صریح",
      value: memories.filter((m) => m.source === "explicit").length,
      color: "text-neon-violet"
    },
    {
      label: "دستی",
      value: memories.filter((m) => m.source === "manual").length,
      color: "text-neon-amber"
    }
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageTitle
        title="حافظهٔ دائمی"
        subtitle="هر چی دستیار ازت یاد می‌گیره اینجاست — همه‌چیز روی کامپیوتر خودت ذخیره می‌شه."
      />

      {/* آمار */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="!p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-slate-400">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* سوییچ ذخیرهٔ خودکار */}
      {settings ? (
        <div className="mb-6">
          <Toggle
            checked={settings.autoMemory}
            onChange={(v) => void toggleAutoMemory(v)}
            label="استخراج خودکار اطلاعات از جملات (مثلاً «اسم من علیه»)"
          />
        </div>
      ) : null}

      {/* فرم افزودن دستی */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Plus size={18} className="text-neon-cyan" /> افزودن حافظهٔ دستی
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>عنوان</Label>
            <Field
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثلاً: غذای مورد علاقه"
              maxLength={120}
            />
          </div>
          <div>
            <Label>دسته‌بندی</Label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
              className="field"
            >
              {(
                ["profile", "preference", "goal", "minecraft", "note", "other"] as const
              ).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>متن (حداکثر ۵۰۰ کاراکتر)</Label>
            <Field
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="متن حافظه..."
              maxLength={500}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Btn onClick={() => void addMemory()} disabled={!newTitle.trim() || !newContent.trim()}>
            <span className="flex items-center gap-2">
              <Save size={16} /> ذخیره در حافظه
            </span>
          </Btn>
          <span className="text-xs text-slate-500">
            نکته: رمز، توکن و کلید API هرگز ذخیره نمی‌شن.
          </span>
        </div>
      </Card>

      {/* فیلتر و خروجی */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter size={16} className="text-slate-400" />
        {(["all", "profile", "preference", "goal", "minecraft", "note", "other"] as const).map(
          (c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-xs transition ${
                category === c
                  ? "bg-neon-cyan/20 text-neon-cyan ring-1 ring-neon-cyan/50"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          )
        )}
        <div className="flex-1" />
        <a
          href="/api/memories/export"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/10"
        >
          <Download size={15} /> خروجی JSON
        </a>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {/* کارت‌های حافظه */}
      {memories.length === 0 ? (
        <Card className="py-12 text-center">
          <Brain size={40} className="mx-auto text-slate-600" />
          <p className="mt-4 text-slate-400">
            هنوز حافظه‌ای ثبت نشده. می‌تونی دستی اضافه کنی یا توی چت بگی:
            «این رو یادت بمونه: ...»
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {memories.map((m) => (
            <Card key={m.id} className="!p-4">
              <div className="flex items-start gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] ${CATEGORY_COLORS[m.category]}`}
                >
                  {CATEGORY_LABELS[m.category]}
                </span>
                <h3 className="flex-1 text-sm font-bold text-white">{m.title}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(m.id);
                      setEditText(m.content);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    title="ویرایش"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void removeMemory(m)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                    title="حذف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {editingId === m.id ? (
                <div className="mt-3">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="field resize-none text-xs"
                  />
                  <div className="mt-2 flex gap-2">
                    <Btn
                      variant="success"
                      className="!py-1.5 !text-xs"
                      onClick={() => void saveEdit(m.id)}
                    >
                      ذخیره
                    </Btn>
                    <Btn
                      variant="ghost"
                      className="!py-1.5 !text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={13} />
                    </Btn>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">
                  {m.content}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
                <span>
                  {m.source === "auto"
                    ? "ثبت خودکار"
                    : m.source === "explicit"
                      ? "دستور صریح"
                      : "دستی"}
                </span>
                <span>•</span>
                <span dir="ltr">{new Date(m.updatedAt).toLocaleDateString("fa-IR")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
