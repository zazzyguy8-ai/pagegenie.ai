"use client";

import { useState, useEffect, useRef } from "react";

const STYLES = [
  {
    id: "minimal",
    name: "Minimal",
    desc: "Clean & modern",
    preview: "bg-white border-2",
    colors: "⬜ White",
  },
  {
    id: "bold",
    name: "Bold",
    desc: "Dark & striking",
    preview: "bg-zinc-900 border-2",
    colors: "⬛ Dark",
  },
  {
    id: "pro",
    name: "Pro",
    desc: "Corporate & trusted",
    preview: "bg-indigo-900 border-2",
    colors: "🟦 Navy",
  },
];

const FREE_KEY = "buildy_free_used";

export default function Home() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("minimal");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [freeUsed, setFreeUsed] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setFreeUsed(localStorage.getItem(FREE_KEY) === "true");

    // Handle Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      const saved = sessionStorage.getItem("buildy_pending");
      if (saved) {
        const data = JSON.parse(saved) as { businessName: string; description: string; style: string };
        setBusinessName(data.businessName);
        setDescription(data.description);
        setStyle(data.style);
        sessionStorage.removeItem("buildy_pending");
        generateSite(data.businessName, data.description, data.style, sessionId);
      }
      window.history.replaceState({}, "", "/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateSite(name: string, desc: string, sty: string, sessionId?: string) {
    setLoading(true);
    setError("");
    setHtml("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name, description: desc, style: sty, sessionId }),
      });

      const data = await res.json() as { html?: string; error?: string };

      if (!res.ok || !data.html) {
        setError(data.error ?? "Generation failed. Try again.");
        return;
      }

      setHtml(data.html);
      if (!sessionId) {
        localStorage.setItem(FREE_KEY, "true");
        setFreeUsed(true);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!businessName.trim() || !description.trim()) {
      setError("Fill in your business name and description.");
      return;
    }

    if (freeUsed) {
      // Redirect to Stripe
      setLoading(true);
      sessionStorage.setItem("buildy_pending", JSON.stringify({ businessName, description, style }));
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, description, style }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Payment failed to load. Try again.");
        setLoading(false);
      }
      return;
    }

    await generateSite(businessName, description, style);
  }

  function downloadHtml() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-website.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">B</div>
            <span className="font-bold text-lg">Buildy</span>
          </div>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            AI Website Builder
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {!html ? (
          <>
            {/* Hero */}
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold tracking-tight mb-4">
                Your website in{" "}
                <span className="text-indigo-400">15 seconds</span>
              </h1>
              <p className="text-lg" style={{ color: "var(--muted)" }}>
                Describe your business. Pick a style. Done.
              </p>
            </div>

            {/* Form */}
            <div
              className="max-w-xl mx-auto rounded-2xl p-8 space-y-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Business name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Business / Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leo's Barber Shop"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  What do you do? (2-3 sentences)
                </label>
                <textarea
                  placeholder="We offer premium haircuts and beard grooming for men in Bratislava. Walk-ins welcome, online booking available."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>

              {/* Style picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Style
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className="rounded-xl p-3 text-left transition-all"
                      style={{
                        background: style === s.id ? "rgba(99,102,241,0.15)" : "var(--background)",
                        border: style === s.id ? "2px solid #6366f1" : "2px solid var(--border)",
                      }}
                    >
                      <div className={`h-8 rounded-lg mb-2 ${s.preview} ${s.id === "minimal" ? "border-zinc-200" : s.id === "bold" ? "border-zinc-700" : "border-indigo-700"}`} />
                      <p className="text-xs font-semibold">{s.name}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
              )}

              {/* CTA */}
              <button
                onClick={handleGenerate}
                disabled={loading || !businessName.trim() || !description.trim()}
                className="w-full h-12 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
                style={{ background: loading || !businessName.trim() || !description.trim() ? "#4f46e5" : "var(--primary)" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Building your website...
                  </span>
                ) : freeUsed ? (
                  "Build website — $2"
                ) : (
                  "Build my website — Free ✨"
                )}
              </button>

              {!freeUsed && (
                <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
                  First website is free. No credit card needed.
                </p>
              )}
            </div>
          </>
        ) : (
          /* Result */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Your website is ready 🎉</h2>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Preview below — download HTML and host it anywhere
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setHtml(""); setError(""); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  ← New website
                </button>
                <button
                  onClick={downloadHtml}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition"
                  style={{ background: "var(--primary)" }}
                >
                  Download HTML
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                </div>
                <div
                  className="flex-1 rounded-md px-3 py-1 text-xs mx-4"
                  style={{ background: "var(--background)", color: "var(--muted)" }}
                >
                  {businessName.toLowerCase().replace(/\s+/g, "")}.com
                </div>
              </div>
              <iframe
                ref={iframeRef}
                srcDoc={html}
                className="w-full"
                style={{ height: "600px", background: "white" }}
                sandbox="allow-same-origin"
                title="Website preview"
              />
            </div>

            <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
              Want to make changes? Start a new generation below ↓
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
