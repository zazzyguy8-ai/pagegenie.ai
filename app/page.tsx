"use client";

import { useState, useEffect, useRef } from "react";

const FREE_KEY = "pagegenie_free_used";

const C = {
  bg:     "#FAFAF8",
  white:  "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
  text:   "#111111",
  muted:  "#888888",
  accent: "#FF3D00",
};

export default function Home() {
  const [businessName, setBusinessName] = useState("");
  const [description,  setDescription]  = useState("");
  const [isLoading,    setIsLoading]    = useState(false);
  const [isStreaming,  setIsStreaming]   = useState(false);
  const [html,         setHtml]         = useState("");
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [freeUsed,     setFreeUsed]     = useState(false);
  const [error,        setError]        = useState("");
  const htmlRef    = useRef("");
  const prevUrlRef = useRef<string | null>(null);
  const [displayedCode, setDisplayedCode] = useState("");

  useEffect(() => {
    setFreeUsed(localStorage.getItem(FREE_KEY) === "true");
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      const saved = sessionStorage.getItem("pagegenie_pending");
      if (saved) {
        const d = JSON.parse(saved) as { businessName: string; description: string };
        setBusinessName(d.businessName);
        setDescription(d.description);
        sessionStorage.removeItem("pagegenie_pending");
        generateSite(d.businessName, d.description, sessionId);
      }
      window.history.replaceState({}, "", "/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isStreaming) return;
    const iv = setInterval(() => {
      const lines = htmlRef.current.split("\n");
      setDisplayedCode(lines.slice(Math.max(0, lines.length - 18)).join("\n"));
    }, 150);
    return () => clearInterval(iv);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming && html) {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      const blob = new Blob([html], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      prevUrlRef.current = url;
      setPreviewUrl(url);
    }
  }, [isStreaming, html]);

  useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

  async function generateSite(name: string, desc: string, sessionId?: string) {
    setIsLoading(true); setIsStreaming(false);
    setError(""); setHtml(""); setPreviewUrl(null); setDisplayedCode("");
    htmlRef.current = "";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name, description: desc, sessionId }),
      });

      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Generation failed.");
        return;
      }
      if (!res.body) { setError("No response."); return; }

      setIsStreaming(true);
      setIsLoading(false);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        htmlRef.current += decoder.decode(value, { stream: true });
      }

      setHtml(htmlRef.current);
      if (!sessionId) { localStorage.setItem(FREE_KEY, "true"); setFreeUsed(true); }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }

  async function handleGenerate() {
    if (!businessName.trim() || !description.trim()) {
      setError("Fill in both fields.");
      return;
    }
    if (freeUsed) {
      setIsLoading(true);
      sessionStorage.setItem("pagegenie_pending", JSON.stringify({ businessName, description }));
      const res  = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, description }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else { setError("Payment failed."); setIsLoading(false); }
      return;
    }
    await generateSite(businessName, description);
  }

  function downloadHtml() {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-website.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setHtml(""); setPreviewUrl(null); setError("");
    setIsStreaming(false); setDisplayedCode(""); htmlRef.current = "";
  }

  const isDone      = !isStreaming && !!html;
  const showPreview = isStreaming || !!html;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* HEADER */}
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.white, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={resetAll} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>G</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: "-0.02em" }}>PageGenie</span>
          </button>
          <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>AI Website Builder</span>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 80px" }}>
        {!showPreview ? (

          /* ── FORM ── */
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ paddingTop: 72, paddingBottom: 44, textAlign: "center" as const }}>
              <h1 style={{ fontSize: "clamp(38px,7vw,62px)", fontWeight: 900, lineHeight: 1.03, letterSpacing: "-0.04em", margin: 0 }}>
                Describe it.<br />
                <span style={{ color: C.accent }}>Get a website.</span>
              </h1>
              <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.65, color: C.muted, maxWidth: 360, margin: "16px auto 0" }}>
                Tell us about your business. We build the rest.
              </p>
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05),0 8px 28px rgba(0,0,0,0.04)" }}>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted, marginBottom: 7 }}>
                  Business Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leo's Barber Shop"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                  style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 15, color: C.text, outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e => e.target.style.borderColor = "rgba(0,0,0,0.2)"}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.muted, marginBottom: 7 }}>
                  What do you do?
                </label>
                <textarea
                  placeholder="We offer premium haircuts and beard grooming for men in Bratislava. Walk-ins welcome, online booking available."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 15, color: C.text, outline: "none", resize: "none" as const, boxSizing: "border-box" as const, fontFamily: "inherit", lineHeight: 1.6 }}
                  onFocus={e => e.target.style.borderColor = "rgba(0,0,0,0.2)"}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              {error && (
                <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#dc2626" }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isLoading || !businessName.trim() || !description.trim()}
                style={{ width: "100%", height: 52, borderRadius: 12, border: "none", background: (isLoading || !businessName.trim() || !description.trim()) ? "rgba(255,61,0,0.3)" : C.accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: (isLoading || !businessName.trim() || !description.trim()) ? "not-allowed" : "pointer", letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {isLoading ? (
                  <><svg style={{ animation: "spin 0.8s linear infinite", width: 16, height: 16 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>Connecting...</>
                ) : freeUsed ? "Build website — $2 →" : "Build my website — Free →"}
              </button>

              {!freeUsed && (
                <p style={{ textAlign: "center" as const, marginTop: 12, fontSize: 12, color: C.muted }}>
                  First website free · No credit card
                </p>
              )}
            </div>
          </div>

        ) : (

          /* ── PREVIEW ── */
          <div style={{ paddingTop: 36 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap" as const, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isStreaming ? (
                  <><span style={{ position: "relative", display: "flex", width: 10, height: 10, flexShrink: 0 }}>
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.accent, opacity: 0.5, animation: "ping 1.2s ease-out infinite" }}/>
                    <span style={{ position: "relative", width: 10, height: 10, borderRadius: "50%", background: C.accent, display: "block" }}/>
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.03em" }}>Building your website...</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>AI is writing your code live</div>
                  </div></>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em" }}>Your website is ready <span style={{ color: C.accent }}>✓</span></div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{Math.round(html.length / 1000)}KB · Download and host anywhere</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={resetAll} style={{ padding: "9px 14px", borderRadius: 9, background: C.white, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  ← New site
                </button>
                {isDone && <>
                  <button onClick={() => window.open(previewUrl!, "_blank")} style={{ padding: "9px 16px", borderRadius: 9, background: C.white, border: `1px solid rgba(0,0,0,0.14)`, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ↗ Open preview
                  </button>
                  <button onClick={downloadHtml} style={{ padding: "9px 18px", borderRadius: 9, background: C.accent, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Download HTML
                  </button>
                </>}
              </div>
            </div>

            <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
              <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f56" }}/>
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd2e" }}/>
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#27c93f" }}/>
                </div>
                <div style={{ flex: 1, background: C.bg, borderRadius: 7, padding: "5px 12px", marginLeft: 6, fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  {isStreaming && <svg style={{ animation: "spin 0.8s linear infinite", width: 10, height: 10, flexShrink: 0 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>}
                  pagegenie.org/{businessName.toLowerCase().replace(/\s+/g, "-")}
                </div>
              </div>

              {isStreaming && (
                <div style={{ background: "#0F0F0F", height: 560, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom,#0F0F0F,transparent)", zIndex: 2, pointerEvents: "none" as const }}/>
                  <pre style={{ margin: 0, padding: "20px 24px", fontFamily: "ui-monospace,'SF Mono',Consolas,monospace", fontSize: 12, lineHeight: 1.7, color: "#E8E8E8", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, height: "100%", boxSizing: "border-box" as const, overflow: "hidden" }}>
                    {displayedCode}<span style={{ display: "inline-block", width: 2, height: "1em", background: C.accent, verticalAlign: "middle", animation: "blink 1s step-end infinite", marginLeft: 2 }}/>
                  </pre>
                </div>
              )}

              {isDone && previewUrl && (
                <iframe key={previewUrl} src={previewUrl} style={{ width: "100%", height: 600, display: "block", border: "none", background: "#fff" }} sandbox="allow-scripts allow-same-origin allow-forms" title="Website preview"/>
              )}
            </div>

            {isDone && <p style={{ textAlign: "center" as const, marginTop: 16, fontSize: 12, color: C.muted }}>Not happy? ← Start a new generation above.</p>}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin  { to { transform:rotate(360deg); } }
        @keyframes ping  { 75%,100% { transform:scale(2.2); opacity:0; } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        * { box-sizing:border-box; }
        body { margin:0; }
        input::placeholder, textarea::placeholder { color:rgba(0,0,0,0.28); }
      `}</style>
    </div>
  );
}
