import { useState, useRef } from "react";

const SYSTEM_PROMPT = `You are a senior equity research analyst specializing in earnings call analysis. 
You analyze earnings call transcripts and management commentary with precision and objectivity.
Your job is to extract structured insights WITHOUT hallucinating — only report what is explicitly stated or clearly implied in the document.
If a section is missing or unclear, explicitly state "Not mentioned" or "Insufficient data".
Always return a valid JSON object with no extra text or markdown.`;

const USER_PROMPT = (text) => `Analyze the following earnings call transcript or management commentary and return a structured JSON analysis.

TRANSCRIPT:
"""
${text.slice(0, 15000)}
"""

Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "company": "Company name if mentioned, else 'Unknown'",
  "period": "Reporting period if mentioned, else 'Unknown'",
  "management_tone": {
    "overall": "optimistic | cautious | neutral | pessimistic",
    "confidence_level": "high | medium | low",
    "rationale": "1-2 sentence explanation based on direct evidence from the transcript"
  },
  "key_positives": [
    {"point": "concise positive", "quote": "direct quote or 'N/A'"}
  ],
  "key_concerns": [
    {"point": "concise concern", "quote": "direct quote or 'N/A'"}
  ],
  "forward_guidance": {
    "revenue": "specific guidance or 'Not mentioned'",
    "margin": "specific guidance or 'Not mentioned'",
    "capex": "specific guidance or 'Not mentioned'",
    "other": "any other forward looking statements or 'Not mentioned'"
  },
  "capacity_utilization": {
    "current": "current utilization rate or trend if mentioned, else 'Not mentioned'",
    "outlook": "future utilization outlook or 'Not mentioned'"
  },
  "growth_initiatives": [
    {"initiative": "initiative name", "description": "brief description"}
  ],
  "analyst_note": "1-2 sentence overall takeaway for an analyst reading this"
}

RULES:
- Only include what is in the transcript. Do not infer beyond what is stated.
- key_positives and key_concerns must have 3-5 items each (fill with available data, mark missing ones as "Insufficient data in transcript")
- growth_initiatives must have 2-3 items (mark missing ones similarly)
- All quotes must be verbatim from transcript or 'N/A'`;

const toneConfig = {
  optimistic:  { icon: "▲", color: "#00d97e", bg: "#00d97e12", label: "Optimistic" },
  cautious:    { icon: "►", color: "#f6c90e", bg: "#f6c90e12", label: "Cautious"   },
  neutral:     { icon: "■", color: "#8892a4", bg: "#8892a412", label: "Neutral"    },
  pessimistic: { icon: "▼", color: "#ff4757", bg: "#ff475712", label: "Pessimistic"},
};

const confConfig = {
  high:   { color: "#00d97e", bg: "#00d97e18", border: "#00d97e40" },
  medium: { color: "#f6c90e", bg: "#f6c90e18", border: "#f6c90e40" },
  low:    { color: "#ff4757", bg: "#ff475718", border: "#ff475740" },
};

export default function App() {
  const [file, setFile]         = useState(null);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState("");
  const fileRef = useRef();

  const readFile = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = rej;
      r.readAsText(f);
    });

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f); setResult(null); setError("");
    try { setText(await readFile(f)); }
    catch { setError("Could not read file. Please upload a .txt file."); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const analyze = async () => {
    if (!text.trim()) { setError("Please upload a document first."); return; }
    setLoading(true); setResult(null); setError("");
    const steps = [
      "Ingesting document…",
      "Extracting management tone…",
      "Identifying key positives & concerns…",
      "Analyzing forward guidance…",
      "Compiling growth initiatives…",
      "Finalizing report…",
    ];
    let i = 0;
    setProgress(steps[0]);
    const iv = setInterval(() => { i = Math.min(i + 1, steps.length - 1); setProgress(steps[i]); }, 1200);

    try {
      const res = await fetch(
        "`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + USER_PROMPT(text) }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
          }),
        }
      );
      const data = await res.json();
      clearInterval(iv);
      if (data.error) { setError(`API Error: ${data.error.message}`); setLoading(false); return; }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      setResult(JSON.parse(raw.replace(/```json|```/g, "").trim()));
    } catch (err) {
      clearInterval(iv);
      setError("Analysis failed. Please try again.");
      console.error(err);
    }
    setLoading(false);
  };

  const tone = result ? (toneConfig[result.management_tone?.overall?.toLowerCase()] || toneConfig.neutral) : null;
  const conf = result ? (confConfig[result.management_tone?.confidence_level?.toLowerCase()] || confConfig.medium) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: #060810; }
        body { font-family: 'Inter', system-ui, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .btn-primary {
          width: 100%; padding: 15px; border: none; border-radius: 10px; cursor: pointer;
          background: linear-gradient(135deg, #00d97e 0%, #0ea5e9 100%);
          color: #000; font-weight: 700; font-size: 14px; letter-spacing: 0.06em;
          text-transform: uppercase; transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 0 24px #00d97e30;
        }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 0 36px #00d97e50; }
        .btn-primary:disabled { background: #1e2a3a; color: #3d4f63; cursor: not-allowed; box-shadow: none; }
        .card { background: #0d1424; border: 1px solid #1a2540; border-radius: 14px; padding: 28px; margin-bottom: 18px; }
        .section-label {
          font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
          color: #3d5070; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #1a2540;
        }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
        .list-row { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid #111d30; align-items: flex-start; }
        .list-row:last-child { border-bottom: none; }
        .guide-row { display: flex; gap: 16px; align-items: baseline; padding: 10px 0; border-bottom: 1px solid #111d30; }
        .guide-row:last-child { border-bottom: none; }
        .dropzone { border: 2px dashed #1a2540; border-radius: 12px; padding: 52px 24px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .dropzone:hover, .dropzone.over { border-color: #00d97e; background: #00d97e08; }
        .init-card { background: #080f1e; border: 1px solid #1a2540; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
        .init-card:last-child { margin-bottom: 0; }
      `}</style>

      <header style={{ background: "#080f1e", borderBottom: "1px solid #1a2540", padding: "0 40px", height: 60, display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#00d97e,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#000", flexShrink: 0 }}>R</div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "0.14em", color: "#fff", textTransform: "uppercase" }}>Research Portal</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#2d4060", letterSpacing: "0.1em", textTransform: "uppercase" }}>Earnings Intelligence · v1.0</span>
      </header>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px 80px" }}>
        <div style={{ width: "100%", maxWidth: 900 }}>

          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", background: "#00d97e14", border: "1px solid #00d97e30", borderRadius: 20, padding: "5px 16px", fontSize: 11, color: "#00d97e", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 20 }}>
              AI-Powered · Analyst-Grade
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #ffffff 0%, #00d97e 55%, #0ea5e9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16 }}>
              Earnings Call Analyzer
            </h1>
            <p style={{ fontSize: 15, color: "#3d5070", letterSpacing: "0.03em" }}>
              Upload a transcript · Get structured analyst-grade insights in seconds
            </p>
          </div>

          <div className="card">
            <div className="section-label">📄 Document Upload</div>
            <div
              className={`dropzone${dragOver ? " over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
            >
              <input ref={fileRef} type="file" accept=".txt,.md,.csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.5 }}>⬆</div>
              {file
                ? <div style={{ fontSize: 14, color: "#00d97e", fontWeight: 600 }}>✓ {file.name}</div>
                : <div style={{ fontSize: 14, color: "#3d5070", marginBottom: 8 }}>Drop your transcript here, or <span style={{ color: "#0ea5e9" }}>browse files</span></div>
              }
              <div style={{ fontSize: 11, color: "#1e3050", marginTop: 6 }}>Supports .txt · .md · .csv</div>
            </div>
            {text && (
              <div style={{ marginTop: 12, fontSize: 11, color: "#2d4060", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#00d97e" }}>✓</span>
                {text.length.toLocaleString()} characters loaded
                {text.length > 15000 && <span style={{ color: "#f6c90e" }}> · First 15,000 chars will be analyzed</span>}
              </div>
            )}
            <button className="btn-primary" style={{ marginTop: 20 }} disabled={!text || loading} onClick={analyze}>
              {loading ? "Analyzing…" : "▶  Run Earnings Analysis"}
            </button>
            {error && (
              <div style={{ marginTop: 14, background: "#ff47570a", border: "1px solid #ff475730", borderRadius: 8, padding: "12px 16px", color: "#ff6b7a", fontSize: 13 }}>
                ⚠ {error}
              </div>
            )}
          </div>

          {loading && (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ width: 36, height: 36, border: "3px solid #1a2540", borderTop: "3px solid #00d97e", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 20px" }} />
              <div style={{ fontSize: 13, color: "#3d5070", animation: "pulse 1.5s ease infinite", letterSpacing: "0.04em" }}>{progress}</div>
            </div>
          )}

          {result && (
            <div className="fade-up">
              <div className="card" style={{ borderColor: "#00d97e28", background: "linear-gradient(135deg, #0d1424 0%, #091420 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{result.company}</div>
                    <div style={{ fontSize: 12, color: "#2d4060" }}>Reporting Period: <span style={{ color: "#4a6080" }}>{result.period}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ background: tone.bg, border: `1px solid ${tone.color}40`, color: tone.color, padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
                      {tone.icon} {tone.label}
                    </span>
                    <span style={{ background: conf.bg, border: `1px solid ${conf.border}`, color: conf.color, padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {result.management_tone?.confidence_level} Confidence
                    </span>
                  </div>
                </div>
                {result.management_tone?.rationale && (
                  <div style={{ marginTop: 16, fontSize: 13, color: "#4a6080", lineHeight: 1.7, borderTop: "1px solid #1a2540", paddingTop: 16 }}>
                    {result.management_tone.rationale}
                  </div>
                )}
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="section-label">✅ Key Positives</div>
                  {result.key_positives?.map((p, i) => (
                    <div key={i} className="list-row">
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00d97e", marginTop: 6, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: "#b0c4d8" }}>{p.point}</div>
                        {p.quote && p.quote !== "N/A" && (
                          <div style={{ fontSize: 11, color: "#2d4060", fontStyle: "italic", marginTop: 5, borderLeft: "2px solid #1a3050", paddingLeft: 8 }}>"{p.quote}"</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="section-label">⚠ Key Concerns</div>
                  {result.key_concerns?.map((c, i) => (
                    <div key={i} className="list-row">
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4757", marginTop: 6, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: "#b0c4d8" }}>{c.point}</div>
                        {c.quote && c.quote !== "N/A" && (
                          <div style={{ fontSize: 11, color: "#2d4060", fontStyle: "italic", marginTop: 5, borderLeft: "2px solid #301a1a", paddingLeft: 8 }}>"{c.quote}"</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="section-label">📈 Forward Guidance</div>
                {Object.entries(result.forward_guidance || {}).map(([k, v]) => (
                  <div key={k} className="guide-row">
                    <div style={{ fontSize: 10, color: "#2d4060", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, width: 70, flexShrink: 0 }}>{k}</div>
                    <div style={{ fontSize: 13, color: v === "Not mentioned" ? "#1e3050" : "#b0c4d8", fontStyle: v === "Not mentioned" ? "italic" : "normal", flex: 1 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="section-label">🏭 Capacity Utilization</div>
                  {[["Current", result.capacity_utilization?.current], ["Outlook", result.capacity_utilization?.outlook]].map(([label, val]) => (
                    <div key={label} className="guide-row">
                      <div style={{ fontSize: 10, color: "#2d4060", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, width: 70, flexShrink: 0 }}>{label}</div>
                      <div style={{ fontSize: 13, color: val === "Not mentioned" ? "#1e3050" : "#b0c4d8", fontStyle: val === "Not mentioned" ? "italic" : "normal" }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="section-label">🚀 Growth Initiatives</div>
                  {result.growth_initiatives?.map((g, i) => (
                    <div key={i} className="init-card">
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#00d97e", marginBottom: 5 }}>{g.initiative}</div>
                      <div style={{ fontSize: 12, color: "#3d5070", lineHeight: 1.6 }}>{g.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.analyst_note && (
                <div className="card" style={{ borderColor: "#00d97e20" }}>
                  <div className="section-label">🔍 Analyst Summary</div>
                  <div style={{ background: "#00d97e08", border: "1px solid #00d97e20", borderRadius: 10, padding: "18px 20px", fontSize: 14, lineHeight: 1.8, color: "#7a9ab8" }}>
                    {result.analyst_note}
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center", fontSize: 11, color: "#1a2a40", marginTop: 8 }}>
                Generated by Research Portal · Powered by Gemini · For internal use only
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}