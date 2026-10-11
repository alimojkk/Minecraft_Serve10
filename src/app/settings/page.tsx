"use client";

/**
 * صفحهٔ تنظیمات — ارائه‌دهنده، کلید API، شخصیت، صدا، میکروفون و چک‌لیست
 */
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  Volume2,
  XCircle
} from "lucide-react";
import { Btn, Card, Field, Label, PageTitle, Toggle } from "@/components/ui";
import { apiGet, apiSend, listVoices, speak } from "@/lib/client";
import type {
  ConnectionTestResult,
  ProviderId,
  PublicSettings,
  Tone,
  Verbosity
} from "@/lib/types";

const PROVIDERS: Array<{ id: ProviderId; label: string; needsKey: boolean }> = [
  { id: "builtin", label: "🆓 هوش مصنوعی داخلی (رایگان — بدون کلید)", needsKey: false },
  { id: "openai", label: "OpenAI", needsKey: true },
  { id: "openrouter", label: "OpenRouter", needsKey: true },
  { id: "groq", label: "Groq", needsKey: true },
  { id: "xai", label: "xAI (Grok)", needsKey: true },
  { id: "ollama", label: "Ollama (محلی)", needsKey: false },
  { id: "lmstudio", label: "LM Studio (محلی)", needsKey: false },
  { id: "custom", label: "سفارشی (OpenAI-Compatible)", needsKey: true }
];

/** لیست مدل‌های داخلی رایگان (از API بارگذاری می‌شود) */
interface ModelOption {
  id: string;
  label: string;
  description: string;
  builtin: boolean;
}

const TONES: Array<{ id: Tone; label: string }> = [
  { id: "friendly", label: "دوستانه و صمیمی" },
  { id: "formal", label: "رسمی و اداری" },
  { id: "playful", label: "شوخ‌طبع و سرزنده" }
];

const VERBOSITIES: Array<{ id: Verbosity; label: string }> = [
  { id: "concise", label: "کوتاه و مستقیم" },
  { id: "balanced", label: "متعادل" },
  { id: "detailed", label: "کامل و مفصل" }
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);

  /** بارگذاری لیست مدل‌های ارائه‌دهندهٔ انتخاب‌شده */
  const loadModels = useCallback(async (provider: ProviderId) => {
    try {
      const data = await apiGet<{ models: ModelOption[] }>(
        `/api/settings/models?provider=${provider}`
      );
      setModelOptions(data.models);
    } catch {
      setModelOptions([]);
    }
  }, []);

  useEffect(() => {
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => {
        setSettings(d.settings);
        setApiKey(d.settings.apiKeyMasked);
        void loadModels(d.settings.provider);
      })
      .catch(() => undefined);

    // صداها و میکروفون‌ها
    const loadDevices = async () => {
      setVoices(listVoices());
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () =>
          setVoices(listVoices());
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMics(devices.filter((d) => d.kind === "audioinput"));
      } catch {
        /* بدون مجوز هم ادامه بده */
      }
    };
    void loadDevices();
  }, []);

  const update = useCallback((patch: Partial<PublicSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const changeProvider = (id: ProviderId) => {
    const baseUrls: Record<string, string> = {
      builtin: "https://text.pollinations.ai/",
      openai: "https://api.openai.com/v1",
      openrouter: "https://openrouter.ai/api/v1",
      groq: "https://api.groq.com/openai/v1",
      xai: "https://api.x.ai/v1",
      ollama: "http://localhost:11434/v1",
      lmstudio: "http://localhost:1234/v1",
      custom: ""
    };
    update({ provider: id, baseUrl: baseUrls[id] ?? "" });
    void loadModels(id);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        assistantName: settings.assistantName,
        tone: settings.tone,
        verbosity: settings.verbosity,
        autoMemory: settings.autoMemory,
        autoSpeak: settings.autoSpeak,
        ttsRate: settings.ttsRate,
        ttsVolume: settings.ttsVolume,
        ttsVoiceURI: settings.ttsVoiceURI,
        microphoneId: settings.microphoneId,
        mcProtectTarget: settings.mcProtectTarget,
        mcGuardRadius: settings.mcGuardRadius,
        apiKey
      };
      const data = await apiSend<{ settings: PublicSettings }>(
        "/api/settings",
        "PUT",
        body
      );
      setSettings(data.settings);
      setApiKey(data.settings.apiKeyMasked);
      setMessage("تنظیمات ذخیره شد. ✅");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiSend<ConnectionTestResult>(
        "/api/settings/test",
        "POST",
        {
          provider: settings?.provider,
          baseUrl: settings?.baseUrl,
          model: settings?.model,
          apiKey
        }
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "تست ناموفق بود."
      });
    } finally {
      setTesting(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        در حال بارگذاری تنظیمات...
      </div>
    );
  }

  const providerNeedsKey =
    PROVIDERS.find((p) => p.id === settings.provider)?.needsKey ?? true;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageTitle
        title="تنظیمات"
        subtitle="همه‌چیز قابل تنظیمه — از ارائه‌دهندهٔ هوش مصنوعی تا لحن صحبت کردن."
      />

      {/* ارائه‌دهنده */}
      <Card className="mb-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <KeyRound size={18} className="text-neon-cyan" /> ارائه‌دهندهٔ هوش مصنوعی
        </h2>
        <div className="grid gap-3">
          <div>
            <Label>ارائه‌دهنده</Label>
            <select
              value={settings.provider}
              onChange={(e) => changeProvider(e.target.value as ProviderId)}
              className="field"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Base URL</Label>
            <Field
              dir="ltr"
              value={settings.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div>
            <Label>مدل هوش مصنوعی</Label>
            {settings.provider === "builtin" ? (
              // مدل‌های داخلی رایگان — انتخاب با کارت
              <div className="grid gap-2">
                {modelOptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => update({ model: m.id })}
                    className={`rounded-xl border px-4 py-3 text-right transition ${
                      settings.model === m.id
                        ? "border-neon-cyan/60 bg-neon-cyan/10 ring-1 ring-neon-cyan/40"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{m.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {m.description}
                    </p>
                  </button>
                ))}
                {modelOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    «دستیار فارسی» به‌صورت پیش‌فرض فعاله.
                  </p>
                ) : null}
              </div>
            ) : modelOptions.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                className="field"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <Field
                dir="ltr"
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            )}
            {settings.provider === "builtin" ? (
              <p className="mt-1.5 text-[11px] text-emerald-300/80">
                ✅ این مدل‌ها رایگان‌اند و بدون کلید API کار می‌کنن — همین
                الان هم فعالن!
              </p>
            ) : null}
          </div>
          <div>
            <Label>
              کلید API {providerNeedsKey ? "" : "(برای سرور محلی اختیاری)"}
            </Label>
            <div className="relative">
              <Field
                dir="ltr"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="!pl-11"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              کلید فقط روی کامپیوتر خودت ذخیره می‌شه و هرگز از برنامه خارج
              نمی‌شه.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Btn variant="ghost" onClick={() => void test()} disabled={testing}>
              {testing ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> در حال تست...
                </span>
              ) : (
                "تست اتصال"
              )}
            </Btn>
            {testResult ? (
              <span
                className={`flex items-center gap-1.5 text-xs ${
                  testResult.ok ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <XCircle size={15} />
                )}
                {testResult.message}
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      {/* شخصیت */}
      <Card className="mb-5">
        <h2 className="mb-4 font-bold text-white">شخصیت دستیار</h2>
        <div className="grid gap-3">
          <div>
            <Label>نام دستیار</Label>
            <Field
              value={settings.assistantName}
              onChange={(e) => update({ assistantName: e.target.value })}
              placeholder="دستیار"
            />
          </div>
          <div>
            <Label>لحن</Label>
            <select
              value={settings.tone}
              onChange={(e) => update({ tone: e.target.value as Tone })}
              className="field"
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>میزان اختصار پاسخ</Label>
            <select
              value={settings.verbosity}
              onChange={(e) =>
                update({ verbosity: e.target.value as Verbosity })
              }
              className="field"
            >
              {VERBOSITIES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* صدا */}
      <Card className="mb-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Volume2 size={18} className="text-neon-violet" /> صدا و میکروفون
        </h2>
        <div className="grid gap-3">
          <div>
            <Label>صدای TTS</Label>
            <select
              value={settings.ttsVoiceURI ?? ""}
              onChange={(e) => update({ ttsVoiceURI: e.target.value || null })}
              className="field"
            >
              <option value="">خودکار (صدای فارسی مرورگر)</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>سرعت گفتار: {settings.ttsRate.toFixed(2)}x</Label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={settings.ttsRate}
              onChange={(e) => update({ ttsRate: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <Label>بلندی صدا: {Math.round(settings.ttsVolume * 100)}%</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.ttsVolume}
              onChange={(e) => update({ ttsVolume: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <Label>میکروفون</Label>
            <select
              value={settings.microphoneId ?? ""}
              onChange={(e) => update({ microphoneId: e.target.value || null })}
              className="field"
            >
              <option value="">پیش‌فرض سیستم</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || "میکروفون"}
                </option>
              ))}
            </select>
          </div>
          <Btn
            variant="ghost"
            onClick={() =>
              speak("سلام! من دستیار توام؛ صدام چطوره؟", settings)
            }
            className="w-fit"
          >
            <span className="flex items-center gap-2">
              <Volume2 size={15} /> تست صدا
            </span>
          </Btn>
          <Toggle
            checked={settings.autoSpeak}
            onChange={(v) => update({ autoSpeak: v })}
            label="🗣️ پخش خودکار صدای پاسخ‌ها (دستیار بدون کلیک حرف بزنه)"
          />
        </div>
      </Card>

      {/* ماینکرفت */}
      <Card className="mb-5">
        <h2 className="mb-4 font-bold text-white">ماینکرفت</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>نام بازیکن برای محافظت</Label>
            <Field
              value={settings.mcProtectTarget ?? ""}
              onChange={(e) =>
                update({ mcProtectTarget: e.target.value || null })
              }
              placeholder="نام تو در بازی"
            />
          </div>
          <div>
            <Label>شعاع محافظت: {settings.mcGuardRadius} بلوک</Label>
            <input
              type="range"
              min={4}
              max={64}
              step={1}
              value={settings.mcGuardRadius}
              onChange={(e) =>
                update({ mcGuardRadius: Number(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </Card>

      {/* ذخیره */}
      <div className="sticky bottom-24 flex items-center gap-3 md:bottom-6">
        <Btn onClick={() => void save()} disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" /> در حال ذخیره...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save size={15} /> ذخیرهٔ تنظیمات
            </span>
          )}
        </Btn>
        {message ? (
          <span className="text-sm text-slate-300">{message}</span>
        ) : null}
      </div>

      {/* چک‌لیست وضعیت */}
      <Card className="mt-6">
        <h2 className="mb-4 font-bold text-white">چک‌لیست وضعیت</h2>
        <ul className="space-y-2.5 text-sm">
          <li className="flex items-center gap-2.5">
            <CheckCircle2 size={17} className="text-emerald-400" />
            <span className="text-slate-300">
              دیتابیس محلی SQLite — آماده (فایل data/app_db.sqlite)
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            {providerNeedsKey && !settings.apiKeyMasked ? (
              <XCircle size={17} className="text-red-400" />
            ) : (
              <CheckCircle2 size={17} className="text-emerald-400" />
            )}
            <span className="text-slate-300">
              {providerNeedsKey && !settings.apiKeyMasked
                ? "کلید API هنوز تنظیم نشده — دستیار در حالت آفلاین کار می‌کنه"
                : "ارائه‌دهنده آمادهٔ اتصاله"}
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <CheckCircle2 size={17} className="text-emerald-400" />
            <span className="text-slate-300">
              مرورگر: از Chrome/Edge برای بهترین پشتیبانی صوتی استفاده کن
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <CheckCircle2 size={17} className="text-emerald-400" />
            <span className="text-slate-300">
              ماینکرفت: پل Mineflayer روی سرور برنامه آماده‌ست
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
