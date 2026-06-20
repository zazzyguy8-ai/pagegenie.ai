"use client";

import { useState, useEffect, useRef } from "react";

const LOADING_MSGS = [
  "Reading your business...",
  "Picking the perfect colors...",
  "Choosing fonts that fit...",
  "Writing your headline...",
  "Designing the layout...",
  "Sourcing images...",
  "Building your hero section...",
  "Writing your copy...",
  "Crafting your services...",
  "Adding finishing touches...",
];

type Step = "home" | "streaming" | "done";

export default function Home() {
  const [step, setStep]               = useState<Step>("home");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription]  = useState("");
  const [html, setHtml]               = useState("");
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [isPaying, setIsPaying]       = useState(false);
  const [error, setError]             = useState("");
  const [displayedCode, setDisplayedCode] = useState("");
  const [loadingMsg, setLoadingMsg]   = useState(LOADING_MSGS[0]);
  const [hasSub, setHasSub]           = useState(false);

  const htmlRef    = useRef("");
  const prevUrlRef = useRef<string | null>(null);

  // Check sub status + handle Stripe return
  useEffect(() => {
    const sub = localStorage.getItem("pagegenie_sub");
    if (sub) setHasSub(true);

    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      window.history.replaceState({}, "", "/");
      handlePostPayment(sessionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePostPayment(sessionId: string) {
    try {
      const res  = await fetch(`/api/verify?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json() as { paid?: boolean; type?: string; subscriptionId?: string };
      if (!data.paid) { setError("Payment not confirmed. Contact support."); return; }

      if (data.type === "subscription" && data.subscriptionId) {
        localStorage.setItem("pagegenie_sub", data.subscriptionId);
        setHasSub(true);
      }

      const savedHtml = sessionStorage.getItem("pagegenie_html");
      const savedName = sessionStorage.getItem("pagegenie_name") || "website";
      sessionStorage.removeItem("pagegenie_html");
      sessionStorage.removeItem("pagegenie_name");

      if (savedHtml) {
        htmlRef.current = savedHtml;
        setHtml(savedHtml);
        setBusinessName(savedName);
        buildPreviewUrl(savedHtml);
        setStep("done");
        triggerDownload(savedHtml, savedName);
      } else {
        setError("Preview expired — generate again for free.");
      }
    } catch {
      setError("Payment verification failed. Contact support.");
    }
  }

  function buildPreviewUrl(h: string) {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    const blob = new Blob([h], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    prevUrlRef.current = url;
    setPreviewUrl(url);
  }

  // Cycle loading messages during streaming
  useEffect(() => {
    if (step !== "streaming") return;
    let i = 0;
    const iv = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[i]);
    }, 1800);
    return () => clearInterval(iv);
  }, [step]);

  // Live code feed during streaming
  useEffect(() => {
    if (step !== "streaming") return;
    const iv = setInterval(() => {
      const lines = htmlRef.current.split("\n");
      setDisplayedCode(lines.slice(Math.max(0, lines.length - 22)).join("\n"));
    }, 120);
    return () => clearInterval(iv);
  }, [step]);

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

  async function generateSite() {
    if (!businessName.trim() || !description.trim()) { setError("Fill in both fields first."); return; }
    setError(""); setHtml(""); setPreviewUrl(null); setDisplayedCode("");
    htmlRef.current = "";
    setLoadingMsg(LOADING_MSGS[0]);
    setStep("streaming");

    try {
      const res = await fetch("/api/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ businessName, description }),
      });
      if (!res.ok)   { const d = await res.json() as { error?: string }; setError(d.error ?? "Generation failed."); setStep("home"); return; }
      if (!res.body) { setError("No response stream."); setStep("home"); return; }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        htmlRef.current += decoder.decode(value, { stream: true });
      }

      let final = htmlRef.current.trim();
      if (final.startsWith("```")) {
        final = final.replace(/^```[a-z]*\n?/, "").replace(/\n?```\s*$/, "").trim();
      }
      setHtml(final);
      buildPreviewUrl(final);
      setStep("done");
    } catch {
      setError("Something went wrong. Try again.");
      setStep("home");
    }
  }

  async function handleDownload(plan: "single" | "unlimited") {
    if (hasSub) { triggerDownload(html, businessName); return; }

    sessionStorage.setItem("pagegenie_html", html);
    sessionStorage.setItem("pagegenie_name", businessName);
    setIsPaying(true);

    try {
      const res  = await fetch("/api/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ businessName, description, plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Payment failed to start. Try again.");
        setIsPaying(false);
      }
    } catch {
      setError("Payment error. Try again.");
      setIsPaying(false);
    }
  }

  function triggerDownload(h: string, name: string) {
    const blob = new Blob([h], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, "-")}-website.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    setHtml(""); setPreviewUrl(null); setError("");
    setDisplayedCode(""); htmlRef.current = "";
    setStep("home");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#111111", color: "#fff", fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased" } as React.CSSProperties}>

      {/* ── HEADER ─────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(17,17,17,0.9)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 20px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "#FF3D00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10.5L6 1.5L10.5 10.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 7.5H9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: "-0.03em" }}>PageGenie</span>
          </button>
          {hasSub
            ? <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", background: "rgba(255,61,0,0.14)", color: "#FF7A5A", padding: "4px 11px", borderRadius: 20 }}>UNLIMITED</span>
            : <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Free preview · $9 to download</span>
          }
        </div>
      </header>

      {/* ── HOME ───────────────────────────────────── */}
      {step === "home" && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 120px" }}>

          <div style={{ paddingTop: "clamp(52px, 12vw, 96px)", paddingBottom: 44, textAlign: "center" }}>
            <h1 style={{ fontSize: "clamp(48px, 11vw, 78px)", fontWeight: 800, lineHeight: 0.96, letterSpacing: "-0.048em", margin: "0 0 20px", color: "#fff" }}>
              Your website.
              <br />
              <span style={{ color: "#FF3D00" }}>60 seconds.</span>
            </h1>
            <p style={{ fontSize: "clamp(15px, 3vw, 17px)", color: "rgba(255,255,255,0.42)", lineHeight: 1.65, maxWidth: 360, margin: "0 auto" }}>
              Describe your business. AI builds a complete, beautiful site — instantly.
            </p>
          </div>

          <div style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "clamp(20px,5vw,32px)" }}>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.33)", marginBottom: 8 }}>
                Business name
              </label>
              <input
                type="text"
                placeholder="e.g. Leo's Barbershop"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && generateSite()}
                className="pg-input"
                style={{ width: "100%", background: "#222", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "13px 16px", fontSize: 15, color: "#fff", outline: "none", boxSizing: "border-box" as const }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.33)", marginBottom: 8 }}>
                What do you do?
              </label>
              <textarea
                placeholder="We do premium haircuts and beard grooming for men in Bratislava. Walk-ins welcome, online booking available."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="pg-input"
                style={{ width: "100%", background: "#222", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "13px 16px", fontSize: 15, color: "#fff", outline: "none", resize: "none" as const, boxSizing: "border-box" as const, fontFamily: "inherit", lineHeight: 1.6 }}
              />
            </div>

            {error && (
              <div style={{ background: "rgba(255,61,0,0.08)", border: "1px solid rgba(255,61,0,0.22)", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#FF7A5A" }}>
                {error}
              </div>
            )}

            <button
              onClick={generateSite}
              disabled={!businessName.trim() || !description.trim()}
              className="pg-cta"
              style={{ width: "100%", height: 54, borderRadius: 12, border: "none", background: (!businessName.trim() || !description.trim()) ? "rgba(255,61,0,0.28)" : "#FF3D00", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (!businessName.trim() || !description.trim()) ? "not-allowed" : "pointer", letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              Build my website — free →
            </button>

            <p style={{ textAlign: "center" as const, marginTop: 12, marginBottom: 0, fontSize: 12, color: "rgba(255,255,255,0.18)" }}>
              Free to preview · $9 to download · No account needed
            </p>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: "clamp(12px,4vw,28px)", flexWrap: "wrap" as const }}>
            {["Works on mobile", "Ready to publish", "Real HTML file"].map(f => (
              <span key={f} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.27)" }}>
                <span style={{ color: "#FF3D00", fontSize: 9 }}>✓</span>{f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── STREAMING ──────────────────────────────── */}
      {step === "streaming" && (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px 60px" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <PulsingDot />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.03em" }}>Building your website...</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{loadingMsg}</div>
            </div>
          </div>

          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <ChromeBar>
              <div style={{ flex: 1, background: "#222", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.28)", display: "flex", alignItems: "center", gap: 6 }}>
                <Spinner small />{businessName.toLowerCase().replace(/\s+/g, "-")}.html — generating...
              </div>
            </ChromeBar>
            <div style={{ background: "#090909", height: 500, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom,#090909,transparent)", zIndex: 2, pointerEvents: "none" as const }}/>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to top,#090909,transparent)", zIndex: 2, pointerEvents: "none" as const }}/>
              <pre style={{ margin: 0, padding: "28px 24px 24px", fontFamily: "ui-monospace,'SF Mono',Consolas,monospace", fontSize: 11.5, lineHeight: 1.75, color: "#5A6474", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, height: "100%", boxSizing: "border-box" as const, overflow: "hidden" }}>
                <span style={{ color: "#2D3748", display: "block", marginBottom: 8 }}>{"// AI is writing your website..."}</span>
                {displayedCode}
                <span style={{ display: "inline-block", width: 2, height: "1em", background: "#FF3D00", verticalAlign: "middle", marginLeft: 2, animation: "blink 1s step-end infinite" }}/>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ───────────────────────────────────── */}
      {step === "done" && (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px 120px" }}>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" as const, gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em" }}>
                Your website is ready <span style={{ color: "#FF3D00" }}>✓</span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
                {hasSub ? "Unlimited plan — download anytime" : "Like it? Download for $9 — keep it forever"}
              </div>
            </div>
            <button
              onClick={reset}
              style={{ padding: "9px 16px", borderRadius: 9, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
            >
              ← New site
            </button>
          </div>

          {error && (
            <div style={{ background: "rgba(255,61,0,0.08)", border: "1px solid rgba(255,61,0,0.22)", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#FF7A5A" }}>
              {error}
            </div>
          )}

          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <ChromeBar>
              <div style={{ flex: 1, background: "#222", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                pagegenie.org / {businessName.toLowerCase().replace(/\s+/g, "-")}
              </div>
            </ChromeBar>
            {previewUrl && (
              <iframe
                key={previewUrl}
                src={previewUrl}
                style={{ width: "100%", height: 580, display: "block", border: "none", background: "#fff" }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                title="Website preview"
              />
            )}
          </div>

          <p style={{ textAlign: "center" as const, marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.18)" }}>
            Not happy? Hit ← New site to generate another one for free.
          </p>
        </div>
      )}

      {/* ── STICKY DOWNLOAD BAR ─────────────────────── */}
      {step === "done" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#161616", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 20px 16px", zIndex: 100 }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            {hasSub ? (
              <button
                onClick={() => triggerDownload(html, businessName)}
                className="pg-cta"
                style={{ width: "100%", height: 50, borderRadius: 12, border: "none", background: "#FF3D00", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                ↓ Download website
              </button>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => handleDownload("single")}
                  disabled={isPaying}
                  className="pg-cta"
                  style={{ height: 50, borderRadius: 12, border: "none", background: isPaying ? "rgba(255,61,0,0.35)" : "#FF3D00", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isPaying ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {isPaying ? <><Spinner />Processing...</> : <>↓ Download — $9</>}
                </button>
                <button
                  onClick={() => handleDownload("unlimited")}
                  disabled={isPaying}
                  style={{ height: 50, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: isPaying ? "not-allowed" : "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 1 }}
                >
                  <span>Unlimited — $19/mo</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", fontWeight: 400 }}>Generate &amp; download forever</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111111; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.18) !important; }
        .pg-input:focus { border-color: rgba(255,61,0,0.4) !important; box-shadow: 0 0 0 3px rgba(255,61,0,0.07) !important; }
        .pg-cta { transition: transform 0.14s ease, opacity 0.14s ease; }
        .pg-cta:not(:disabled):hover { opacity: 0.87; transform: translateY(-1px); }
        .pg-cta:not(:disabled):active { transform: translateY(0); opacity: 1; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes ping  { 75%, 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </main>
  );
}

function ChromeBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#1A1A1A", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f56" }}/>
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd2e" }}/>
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#27c93f" }}/>
      </div>
      {children}
    </div>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const s = small ? 10 : 14;
  return (
    <svg style={{ animation: "spin 0.75s linear infinite", width: s, height: s, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function PulsingDot() {
  return (
    <span style={{ position: "relative", display: "flex", width: 12, height: 12, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#FF3D00", opacity: 0.4, animation: "ping 1.4s ease-out infinite" }}/>
      <span style={{ position: "relative", width: 12, height: 12, borderRadius: "50%", background: "#FF3D00", display: "block" }}/>
    </span>
  );
}
