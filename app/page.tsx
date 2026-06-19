"use client";

import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#080808",
  surface: "#111111",
  surfaceHover: "#161616",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.14)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.38)",
  muted2: "rgba(255,255,255,0.18)",
  accent: "#CAFF33",
  accentDark: "#080808",
};

const STYLES = [
  { id: "minimal", label: "Minimal", sub: "White & clean", dot: "#FFFFFF", dotBorder: "rgba(255,255,255,0.3)" },
  { id: "bold", label: "Bold", sub: "Dark & striking", dot: "#0d0d0d", dotBorder: "rgba(255,255,255,0.2)" },
  { id: "pro", label: "Pro", sub: "Navy corporate", dot: "#1e3a5f", dotBorder: "rgba(255,255,255,0.2)" },
];

const FREE_KEY = "pagegenie_free_used";

export default function Home() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("minimal");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [html, setHtml] = useState("");
  const [freeUsed, setFreeUsed] = useState(false);
  const [error, setError] = useState("");
  const htmlRef = useRef("");
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setFreeUsed(localStorage.getItem(FREE_KEY) === "true");
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      const saved = sessionStorage.getItem("pagegenie_pending");
      if (saved) {
        const data = JSON.parse(saved) as { businessName: string; description: string; style: string };
        setBusinessName(data.businessName);
        setDescription(data.description);
        setStyle(data.style);
        sessionStorage.removeItem("pagegenie_pending");
        generateSite(data.businessName, data.description, data.style, sessionId);
      }
      window.history.replaceState({}, "", "/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush accumulated HTML to state every 120ms during streaming
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      if (htmlRef.current) {
        setHtml(htmlRef.current);
        setCharCount(htmlRef.current.length);
      }
    }, 120);
    return () => clearInterval(interval);
  }, [isStreaming]);

  async function generateSite(name: string, desc: string, sty: string, sessionId?: string) {
    setIsLoading(true);
    setIsStreaming(false);
    setError("");
    setHtml("");
    setCharCount(0);
    htmlRef.current = "";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name, description: desc, style: sty, sessionId }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Generation failed. Try again.");
        return;
      }

      if (!res.body) {
        setError("No response from server.");
        return;
      }

      setIsStreaming(true);
      setIsLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        htmlRef.current += decoder.decode(value, { stream: true });
      }

      setHtml(htmlRef.current);
      setCharCount(htmlRef.current.length);

      if (!sessionId) {
        localStorage.setItem(FREE_KEY, "true");
        setFreeUsed(true);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }

  async function handleGenerate() {
    if (!businessName.trim() || !description.trim()) {
      setError("Fill in your business name and description.");
      return;
    }

    if (freeUsed) {
      setIsLoading(true);
      sessionStorage.setItem("pagegenie_pending", JSON.stringify({ businessName, description, style }));
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
        setIsLoading(false);
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

  function resetAll() {
    setHtml("");
    setError("");
    setIsStreaming(false);
    setCharCount(0);
    htmlRef.current = "";
  }

  const showPreview = isStreaming || !!html;
  const isDone = !isStreaming && !!html;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ─── HEADER ─── */}
      <header style={{ borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50, background: C.bg }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={resetAll} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.accentDark }}>G</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.text, letterSpacing: "-0.02em" }}>PageGenie</span>
          </button>
          <span style={{ fontSize: 12, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>AI Website Builder</span>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 80px" }}>

        {!showPreview ? (
          /* ─── FORM STATE ─── */
          <div style={{ maxWidth: 560, margin: "0 auto" }}>

            {/* Hero copy */}
            <div style={{ paddingTop: 80, paddingBottom: 48, textAlign: "center" }}>
              <h1 style={{
                fontSize: "clamp(44px, 8vw, 72px)",
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: "-0.04em",
                margin: 0,
                color: C.text,
              }}>
                Type your idea.{" "}
                <span style={{ color: C.accent }}>Get a website.</span>
              </h1>
              <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.6, color: C.muted, maxWidth: 400, margin: "20px auto 0" }}>
                Describe your business. AI builds a complete site. Download it.
              </p>
            </div>

            {/* Form card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>

              {/* Business name */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                  Business Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leo's Barber Shop"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  style={{
                    width: "100%",
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    fontSize: 15,
                    color: C.text,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 150ms",
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.borderHover}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                  What do you do?
                </label>
                <textarea
                  placeholder="We offer premium haircuts and beard grooming for men in Bratislava. Walk-ins welcome, online booking available."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    fontSize: 15,
                    color: C.text,
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    lineHeight: 1.6,
                    transition: "border-color 150ms",
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.borderHover}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
              </div>

              {/* Style picker */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                  Design Style
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      style={{
                        background: style === s.id ? "rgba(202,255,51,0.08)" : C.bg,
                        border: style === s.id ? `1.5px solid ${C.accent}` : `1.5px solid ${C.border}`,
                        borderRadius: 12,
                        padding: "14px 12px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 150ms",
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: s.dot, border: `1px solid ${s.dotBorder}`,
                        marginBottom: 10,
                      }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: style === s.id ? C.accent : C.text }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#ff6060" }}>
                  {error}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleGenerate}
                disabled={isLoading || !businessName.trim() || !description.trim()}
                style={{
                  width: "100%",
                  height: 56,
                  borderRadius: 14,
                  border: "none",
                  background: (isLoading || !businessName.trim() || !description.trim()) ? "rgba(202,255,51,0.25)" : C.accent,
                  color: C.accentDark,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: (isLoading || !businessName.trim() || !description.trim()) ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                  transition: "all 150ms",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {isLoading ? (
                  <>
                    <svg style={{ animation: "spin 1s linear infinite", width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Connecting...
                  </>
                ) : freeUsed ? (
                  "Build website — $2 →"
                ) : (
                  "Build my website — Free →"
                )}
              </button>

              {!freeUsed && (
                <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: C.muted }}>
                  First website free. No credit card.
                </p>
              )}
            </div>
          </div>

        ) : (
          /* ─── PREVIEW STATE ─── */
          <div style={{ paddingTop: 40 }}>

            {/* Status bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {isStreaming ? (
                  <>
                    {/* Pulsing dot */}
                    <span style={{ position: "relative", display: "flex", width: 10, height: 10 }}>
                      <span style={{
                        position: "absolute", display: "inline-flex", borderRadius: "50%",
                        width: "100%", height: "100%", background: C.accent, opacity: 0.7,
                        animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite"
                      }} />
                      <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", width: 10, height: 10, background: C.accent }} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em" }}>Building your website...</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {charCount > 0 ? `${(charCount / 1000).toFixed(1)}k characters written` : "AI is starting..."}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.03em" }}>
                      Your website is ready{" "}
                      <span style={{ color: C.accent }}>✓</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                      Download the HTML — host it anywhere
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={resetAll}
                  style={{ padding: "10px 16px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  ← New site
                </button>
                {isDone && (
                  <button
                    onClick={downloadHtml}
                    style={{ padding: "10px 20px", borderRadius: 10, background: C.accent, border: "none", color: C.accentDark, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
                  >
                    Download HTML
                  </button>
                )}
              </div>
            </div>

            {/* Browser chrome + iframe */}
            <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}` }}>
              {/* Chrome bar */}
              <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,100,100,0.5)" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,200,50,0.5)" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(80,200,80,0.5)" }} />
                </div>
                <div style={{
                  flex: 1, background: C.bg, borderRadius: 8,
                  padding: "6px 14px", marginLeft: 8,
                  fontSize: 12, color: C.muted,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {isStreaming && (
                    <svg style={{ animation: "spin 1s linear infinite", width: 11, height: 11, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {businessName.toLowerCase().replace(/\s+/g, "")}.com
                </div>
              </div>

              {/* Live iframe */}
              <iframe
                srcDoc={html || "<html><body style='background:#fff;margin:0'></body></html>"}
                style={{ width: "100%", height: 620, display: "block", background: "#fff", border: "none" }}
                sandbox="allow-same-origin allow-scripts"
                title="Website preview"
              />
            </div>

            {isDone && (
              <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.muted }}>
                Not happy? ← Start a new generation above.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
