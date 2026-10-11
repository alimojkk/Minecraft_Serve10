"use client";

/**
 * صفحهٔ مکالمهٔ صوتی — گوی نئونی، امواج صدا، تشخیص گفتار فارسی، Barge-in
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { PageTitle, Toggle } from "@/components/ui";
import {
  apiGet,
  apiSend,
  isSpeaking,
  listVoices,
  speak,
  stopSpeaking
} from "@/lib/client";
import type { MessageDTO, PublicSettings } from "@/lib/types";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export default function VoicePage() {
  const [state, setState] = useState<VoiceState>("idle");
  const [continuous, setContinuous] = useState(false);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const activeIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ---------------- تنظیمات ---------------- */

  useEffect(() => {
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => {
        setSettings(d.settings);
        if (d.settings.microphoneId) {
          // شناسهٔ میکروفون انتخاب‌شده برای مجوز
        }
      })
      .catch(() => undefined);
    void listVoices();
  }, []);

  /* ---------------- میکروفون و امواج ---------------- */

  const setupAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(avg / 128);

        // رسم امواج روی canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return;
        const { width, height } = canvas;
        ctx2d.clearRect(0, 0, width, height);
        const bars = 28;
        const gap = width / bars;
        for (let i = 0; i < bars; i++) {
          const v = data[Math.floor((i / bars) * data.length)] / 255;
          const h = Math.max(4, v * height * 0.85);
          const gradient = ctx2d.createLinearGradient(0, height, 0, height - h);
          gradient.addColorStop(0, "rgba(34, 211, 238, 0.85)");
          gradient.addColorStop(1, "rgba(167, 139, 250, 0.9)");
          ctx2d.fillStyle = gradient;
          ctx2d.beginPath();
          ctx2d.roundRect(i * gap + 2, height - h, gap - 5, h, 4);
          ctx2d.fill();
        }
      };
      draw();
    } catch {
      setError("دسترسی به میکروفون داده نشد. مجوز مرورگر رو چک کن.");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  /* ---------------- تشخیص گفتار + Barge-in ---------------- */

  const processTranscript = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      // Barge-in: اگر دستیار داره حرف می‌زنه، فوراً قطع کن
      if (isSpeaking()) {
        stopSpeaking();
      }

      setMessages((prev) => [...prev, { role: "user", text: clean }]);
      setInterim("");
      setState("thinking");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeIdRef.current,
            content: clean
          })
        });
        const convId = Number(res.headers.get("X-Conversation-Id"));
        if (convId) activeIdRef.current = convId;

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let full = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            full += decoder.decode(value, { stream: true });
          }
        }

        setMessages((prev) => [...prev, { role: "assistant", text: full }]);
        if (!muted) {
          setState("speaking");
          speak(full, settings);
          // پایان پخش → ادامهٔ شنیدن در حالت پیوسته
          const checkEnd = setInterval(() => {
            if (!isSpeaking()) {
              clearInterval(checkEnd);
              setState(shouldListenRef.current ? "listening" : "idle");
            }
          }, 300);
        } else {
          setState(shouldListenRef.current ? "listening" : "idle");
        }
      } catch {
        setError("ارتباط با دستیار برقرار نشد.");
        setState(shouldListenRef.current ? "listening" : "idle");
      }
    },
    [muted, settings]
  );

  const startListening = useCallback(() => {
    const Recog =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recog) {
      setError(
        "مرورگرت از تشخیص گفتار پشتیبانی نمی‌کنه. از Chrome استفاده کن."
      );
      return;
    }

    stopSpeaking();
    shouldListenRef.current = true;
    void setupAudio();

    const recog = new Recog();
    recog.lang = "fa-IR";
    recog.continuous = true;
    recog.interimResults = true;

    recog.onstart = () => setState("listening");

    recog.onresult = (event) => {
      // Barge-in: به محض حرف زدن کاربر، صدا قطع می‌شود
      if (isSpeaking()) {
        stopSpeaking();
        setState("listening");
      }

      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) void processTranscript(finalText);
    };

    recog.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("اجازهٔ میکروفون داده نشد.");
        shouldListenRef.current = false;
        setState("idle");
      }
    };

    recog.onend = () => {
      // در حالت پیوسته، دوباره شروع کن مگر اینکه کاربر متوقف کرده باشد
      if (shouldListenRef.current && continuous) {
        try {
          recog.start();
        } catch {
          /* قبلاً شروع شده */
        }
      } else if (!shouldListenRef.current) {
        setState("idle");
      }
    };

    recognitionRef.current = recog;
    try {
      recog.start();
    } catch {
      /* نادیده */
    }
  }, [continuous, processTranscript, setupAudio]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopSpeaking();
    setState("idle");
    setInterim("");
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // وقتی continuous تغییر کرد و در حال شنیدن هستیم، ری‌استارت
  useEffect(() => {
    if (state === "listening" && !continuous) {
      // شنیدن تک‌نوبتی بعد از هر پاسخ متوقف می‌شود
    }
  }, [continuous, state]);

  /* ---------------- رندر ---------------- */

  const orbScale = 1 + level * 0.35;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-8">
      <PageTitle
        title="مکالمهٔ صوتی"
        subtitle="حرف بزن؛ اگه وسط صحبت دستیار هم حرف بزنی، فوراً گوش می‌ده (Barge-in)."
      />

      {/* گوی نئونی */}
      <button
        onClick={() => (state === "idle" ? startListening() : stopListening())}
        className="relative my-8 flex h-52 w-52 items-center justify-center rounded-full transition-transform duration-100"
        style={{ transform: `scale(${orbScale})` }}
      >
        <div
          className={`voice-orb absolute inset-0 rounded-full transition-all duration-300 ${
            state === "listening"
              ? "animate-orb-pulse"
              : state === "speaking"
                ? "opacity-90"
                : "opacity-70"
          }`}
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
          {state === "thinking" ? (
            <Loader2 size={36} className="animate-spin text-white" />
          ) : state === "listening" ? (
            <Mic size={36} className="text-white drop-shadow" />
          ) : state === "speaking" ? (
            <Volume2 size={36} className="text-white drop-shadow" />
          ) : (
            <MicOff size={36} className="text-white/80" />
          )}
          <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-white">
            {state === "idle"
              ? "برای شروع لمس کن"
              : state === "listening"
                ? "دارم گوش می‌دم..."
                : state === "thinking"
                  ? "در حال فکر کردن..."
                  : "دارم حرف می‌زنم..."}
          </span>
        </div>
      </button>

      {/* امواج صدا */}
      <canvas
        ref={canvasRef}
        width={560}
        height={90}
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5"
      />

      {/* متن در حال تشخیص */}
      {interim ? (
        <p className="mt-4 w-full max-w-xl rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span className="text-xs text-slate-500">در حال شنیدن: </span>
          {interim}
          <span className="typing-caret" />
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 w-full max-w-xl rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {/* کنترل‌ها */}
      <div className="mt-6 grid w-full max-w-xl gap-3">
        <Toggle
          checked={continuous}
          onChange={setContinuous}
          label="مکالمهٔ پیوسته (بعد از هر پاسخ، دوباره گوش بده)"
        />
        <Toggle
          checked={muted}
          onChange={(v) => {
            setMuted(v);
            if (v) stopSpeaking();
          }}
          label="بی‌صدا (فقط متن، بدون پخش پاسخ)"
        />
      </div>

      {/* رونوشت گفتگو */}
      <div className="mt-8 w-full max-w-xl">
        <h2 className="mb-3 text-sm font-bold text-slate-300">رونوشت مکالمه</h2>
        <div className="glass max-h-96 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-slate-500">
              هنوز مکالمه‌ای شروع نشده.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-4 py-2.5 text-sm leading-6 ${
                  m.role === "user"
                    ? "bubble-user mr-auto max-w-[85%]"
                    : "bubble-assistant ml-auto max-w-[85%]"
                }`}
              >
                <p className="mb-1 text-[10px] opacity-70">
                  {m.role === "user" ? "تو" : "دستیار"}
                </p>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
