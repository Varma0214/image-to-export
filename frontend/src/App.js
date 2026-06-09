import { useState, useRef, useCallback } from "react";

const API = "http://localhost:5000";
const STEPS = ["Upload Image", "Edit Data", "Export"];

/* ─── Responsive helpers ─── */
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useState(() => {
    const handler = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  });
  return mobile;
};

/* ─── Step indicator ─── */
function StepBar({ step }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0 }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{
              width: isMobile ? 30 : 36, height: isMobile ? 30 : 36,
              borderRadius: "50%",
              background: i <= step ? "#4F46E5" : "#E5E7EB",
              color: i <= step ? "#fff" : "#9CA3AF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: isMobile ? 13 : 15, transition: "all 0.3s",
              flexShrink: 0,
            }}>{i < step ? "✓" : i + 1}</div>
            {!isMobile && (
              <span style={{
                fontSize: 11, color: i <= step ? "#4F46E5" : "#9CA3AF",
                fontWeight: i === step ? 700 : 400, whiteSpace: "nowrap"
              }}>{label}</span>
            )}
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2,
              background: i < step ? "#4F46E5" : "#E5E7EB",
              margin: `0 ${isMobile ? 4 : 8}px`,
              marginBottom: isMobile ? 0 : 20,
              transition: "all 0.3s",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Editable table ─── */
function EditableTable({ table, onChange }) {
  const handleCell = (rIdx, cIdx, val) => {
    const updated = table.map((row, ri) =>
      ri === rIdx ? row.map((cell, ci) => (ci === cIdx ? val : cell)) : row
    );
    onChange(updated);
  };

  const addRow = () => onChange([...table, Array(table[0]?.length || 1).fill("")]);
  const addCol = () => onChange(table.map(row => [...row, ""]));
  const delRow = (ri) => { if (table.length > 1) onChange(table.filter((_, i) => i !== ri)); };
  const delCol = (ci) => { if ((table[0]?.length || 0) > 1) onChange(table.map(row => row.filter((_, i) => i !== ci))); };

  if (!table.length)
    return <p style={{ color: "#9CA3AF", textAlign: "center", padding: 32 }}>No data extracted. Try another image.</p>;

  return (
    <div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1.5px solid #E5E7EB", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "max-content" }}>
          <tbody>
            {table.map((row, ri) => (
              <tr key={ri} style={{ background: ri === 0 ? "#1a1a2e" : ri % 2 === 0 ? "#F8F9FF" : "#fff" }}>
                {/* Row number */}
                <td style={{
                  padding: "6px 8px", border: "1px solid #E5E7EB",
                  fontSize: 11, color: ri === 0 ? "#a5b4fc" : "#9CA3AF",
                  textAlign: "center", minWidth: 32, background: ri === 0 ? "#12122a" : "#F1F5F9",
                  userSelect: "none",
                }}>{ri === 0 ? "#" : ri}</td>

                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: 0, border: "1px solid #E5E7EB", minWidth: 100, maxWidth: 260 }}>
                    <input
                      value={cell}
                      onChange={e => handleCell(ri, ci, e.target.value)}
                      style={{
                        width: "100%", border: "none", outline: "none",
                        padding: "9px 10px",
                        background: "transparent", fontSize: 13,
                        color: ri === 0 ? "#fff" : "#1a1a2e",
                        fontWeight: ri === 0 ? 700 : 400,
                        boxSizing: "border-box", minWidth: 80,
                      }}
                    />
                  </td>
                ))}

                {/* Delete row btn */}
                <td style={{ background: "transparent", padding: "0 2px", border: "none", verticalAlign: "middle" }}>
                  <button onClick={() => delRow(ri)} title="Delete row"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 16, padding: "4px 5px", borderRadius: 4 }}>×</button>
                </td>
              </tr>
            ))}

            {/* Delete column row */}
            {table[0]?.length > 1 && (
              <tr style={{ background: "#F8F9FF" }}>
                <td style={{ border: "1px solid #E5E7EB" }} />
                {table[0].map((_, ci) => (
                  <td key={ci} style={{ border: "1px solid #E5E7EB", textAlign: "center", padding: "3px" }}>
                    <button onClick={() => delCol(ci)} title="Delete column"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 12, padding: "2px 6px", borderRadius: 3 }}>▲ del</button>
                  </td>
                ))}
                <td style={{ border: "none" }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={addRow} style={btnStyle("#4F46E5", true)}>+ Row</button>
        <button onClick={addCol} style={btnStyle("#059669", true)}>+ Column</button>
      </div>
    </div>
  );
}

function btnStyle(color, small) {
  return {
    background: color, color: "#fff", border: "none", borderRadius: 7,
    padding: small ? "7px 14px" : "10px 22px",
    cursor: "pointer", fontSize: small ? 12 : 13,
    fontWeight: 600, transition: "opacity 0.2s, transform 0.1s",
    flexShrink: 0,
  };
}

/* ─── Main App ─── */
export default function App() {
  const [step, setStep] = useState(0);
  const [imgSrc, setImgSrc] = useState(null);
  const [imgBase64, setImgBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [table, setTable] = useState([]);
  const [detectedInfo, setDetectedInfo] = useState(null);
  const [title, setTitle] = useState("Extracted Data");
  const [exportStatus, setExportStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();
  const isMobile = useIsMobile();

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, BMP, TIFF, WebP).");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgSrc(e.target.result);
      setImgBase64(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        handleFile(item.getAsFile());
        break;
      }
    }
  }, []);

  const runOCR = async () => {
    if (!imgBase64) { setError("Upload an image first."); return; }
    setLoading(true); setError(""); setRawText(""); setTable([]); setDetectedInfo(null);
    setLoadingMsg("Preprocessing image…");

    const msgs = [
      "Preprocessing image…",
      "Running OCR engine…",
      "Detecting columns & rows…",
      "Reconstructing table…",
    ];
    let mi = 0;
    const ticker = setInterval(() => {
      mi = (mi + 1) % msgs.length;
      setLoadingMsg(msgs[mi]);
    }, 1200);

    try {
      const res = await fetch(`${API}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imgBase64 }),
      });
      const data = await res.json();
      clearInterval(ticker);
      if (data.error) throw new Error(data.error);

      const t = data.table?.length ? data.table : [[data.raw_text || ""]];
      setRawText(data.raw_text || "");
      setTable(t);
      setDetectedInfo({ rows: data.rows || t.length, cols: data.cols || (t[0]?.length || 0) });
      setStep(1);
    } catch (e) {
      clearInterval(ticker);
      setError("OCR failed: " + e.message + ". Make sure the Python server is running on port 5000.");
    }
    setLoading(false);
    setLoadingMsg("");
  };

  const doExport = async (format) => {
    setExportStatus(""); setError("");
    const endpoint = format === "pdf" ? "/export/pdf" : "/export/excel";
    const key = format === "pdf" ? "pdf" : "excel";
    const mime = format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    try {
      setExportStatus(`Generating ${format.toUpperCase()}…`);
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, title }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const bytes = Uint8Array.from(atob(data[key]), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
      setExportStatus(`✅ ${data.filename} downloaded!`);
    } catch (e) {
      setError("Export failed: " + e.message);
      setExportStatus("");
    }
  };

  const reset = () => {
    setStep(0); setImgSrc(null); setImgBase64(null); setTable([]);
    setRawText(""); setError(""); setExportStatus(""); setTitle("Extracted Data");
    setDetectedInfo(null);
  };

  /* Shared card style */
  const card = {
    background: "#fff", borderRadius: 16,
    padding: isMobile ? "20px 16px" : "28px 32px",
    boxShadow: "0 2px 20px #4F46E510",
  };

  return (
    <div
      onPaste={handlePaste}
      style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f4ff 0%,#fafaff 100%)", fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#1a1a2e", color: "#fff",
        padding: isMobile ? "14px 16px" : "16px 32px",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 16px #0004",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          width: 36, height: 36, background: "#4F46E5", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
        }}>📋</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 17, letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Image → Data Extractor
          </div>
          {!isMobile && <div style={{ fontSize: 11, color: "#a5b4fc", marginTop: 1 }}>OCR · Edit · Export PDF or Excel</div>}
        </div>
        {step > 0 && (
          <button onClick={reset} style={{ ...btnStyle("#374151", true), flexShrink: 0 }}>↺ {isMobile ? "" : "Start Over"}</button>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "20px 12px" : "32px 20px" }}>
        <StepBar step={step} />

        {/* Error */}
        {error && (
          <div style={{
            background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626",
            borderRadius: 9, padding: "12px 16px", marginBottom: 18, fontSize: 13
          }}>⚠️ {error}</div>
        )}

        {/* ── STEP 0: Upload ── */}
        {step === 0 && (
          <div style={card}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 17 : 20, color: "#1a1a2e" }}>Upload Your Image</h2>
            <p style={{ color: "#6B7280", fontSize: 12, margin: "0 0 20px" }}>
              Supports JPG, PNG, BMP, TIFF, WebP — screenshots, printed tables, scanned docs, handwritten notes. You can also paste an image (Ctrl+V).
            </p>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2.5px dashed ${dragging ? "#4F46E5" : "#C7D2FE"}`,
                borderRadius: 12,
                padding: isMobile ? "28px 12px" : "44px 20px",
                textAlign: "center",
                background: dragging ? "#EEF2FF" : "#F8F9FF",
                cursor: "pointer", transition: "all 0.2s", marginBottom: 20,
              }}>
              <div style={{ fontSize: isMobile ? 32 : 44, marginBottom: 8 }}>🖼️</div>
              <div style={{ fontWeight: 600, color: "#4F46E5", fontSize: isMobile ? 13 : 15 }}>
                Drop image here or tap to browse
              </div>
              <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 4 }}>
                JPG · PNG · BMP · TIFF · WebP &nbsp;|&nbsp; Paste works too (Ctrl+V)
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            {imgSrc && (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <img src={imgSrc} alt="preview" style={{
                  maxWidth: isMobile ? "100%" : 340, maxHeight: 240,
                  borderRadius: 10, border: "2px solid #E5E7EB", objectFit: "contain", width: "100%",
                }} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ color: "#059669", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>✓ Image ready</div>

                  {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#EEF2FF", borderRadius: 9, padding: "12px 16px"
                      }}>
                        <span style={{ fontSize: 18, animation: "spin 1s linear infinite" }}>⏳</span>
                        <span style={{ fontSize: 13, color: "#4F46E5", fontWeight: 600 }}>{loadingMsg}</span>
                      </div>
                      <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", background: "linear-gradient(90deg,#4F46E5,#7C3AED)",
                          borderRadius: 2, animation: "progress 1.5s ease-in-out infinite",
                        }} />
                      </div>
                    </div>
                  ) : (
                    <button onClick={runOCR}
                      style={{ ...btnStyle("#4F46E5"), fontSize: isMobile ? 13 : 15, padding: "12px 24px", width: isMobile ? "100%" : "auto" }}>
                      🔍 Extract Text with OCR
                    </button>
                  )}

                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10 }}>
                    Tip: Use clear, well-lit photos for best accuracy. Handwriting supported via LSTM engine.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: Edit ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <div style={{
                display: "flex", alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18,
                flexDirection: isMobile ? "column" : "row",
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 19, color: "#1a1a2e" }}>Edit Extracted Data</h2>
                  <p style={{ color: "#6B7280", fontSize: 11, margin: "4px 0 0" }}>
                    Click any cell to edit. Use +Row / +Column buttons to adjust.
                  </p>
                </div>
                <input
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Document title"
                  style={{
                    padding: "8px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB",
                    fontSize: 13, color: "#1a1a2e", outline: "none",
                    width: isMobile ? "100%" : 200, boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Detected grid info */}
              {detectedInfo && (
                <div style={{
                  display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap",
                }}>
                  {[
                    { label: "Rows detected", val: detectedInfo.rows, color: "#4F46E5" },
                    { label: "Columns detected", val: detectedInfo.cols, color: "#059669" },
                    { label: "Current rows", val: table.length, color: "#6B7280" },
                    { label: "Current cols", val: table[0]?.length || 0, color: "#6B7280" },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{
                      background: "#F8F9FF", borderRadius: 8, padding: "6px 12px",
                      border: "1px solid #E5E7EB", fontSize: 12,
                    }}>
                      <span style={{ color: "#9CA3AF" }}>{label}: </span>
                      <span style={{ fontWeight: 700, color }}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              <EditableTable table={table} onChange={setTable} />
            </div>

            {rawText && (
              <details style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 8px #0001" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, color: "#4F46E5", fontSize: 13 }}>📄 View Raw OCR Text</summary>
                <pre style={{
                  marginTop: 12, fontSize: 11, color: "#374151", background: "#F8F9FF",
                  borderRadius: 7, padding: 14, overflow: "auto", maxHeight: 200,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{rawText}</pre>
              </details>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
              <button onClick={() => setStep(0)} style={btnStyle("#6B7280", true)}>← Back</button>
              <button onClick={() => setStep(2)} style={{ ...btnStyle("#4F46E5"), padding: "11px 28px" }}>
                Proceed to Export →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Export ── */}
        {step === 2 && (
          <div style={card}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 17 : 20, color: "#1a1a2e" }}>Export Your Data</h2>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 24px" }}>
              <strong>"{title}"</strong> — {table.length} rows × {table[0]?.length || 0} columns
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
              {[
                {
                  format: "pdf",
                  label: "Export as PDF",
                  sub: "Formatted, printable A4 document",
                  icon: "📄",
                  grad: "linear-gradient(135deg,#4F46E5,#7C3AED)",
                  shadow: "#4F46E530",
                  shadowHover: "#4F46E550",
                },
                {
                  format: "excel",
                  label: "Export as Excel",
                  sub: "Styled .xlsx with editable cells",
                  icon: "📊",
                  grad: "linear-gradient(135deg,#059669,#10B981)",
                  shadow: "#05966930",
                  shadowHover: "#05966950",
                },
              ].map(({ format, label, sub, icon, grad, shadow, shadowHover }) => (
                <div
                  key={format}
                  onClick={() => doExport(format)}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 30px ${shadowHover}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 4px 20px ${shadow}`; }}
                  style={{
                    flex: "1 1 200px", minWidth: 0,
                    background: grad, borderRadius: 14,
                    padding: isMobile ? "20px 16px" : "26px 20px",
                    cursor: "pointer", textAlign: "center",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    boxShadow: `0 4px 20px ${shadow}`,
                  }}>
                  <div style={{ fontSize: isMobile ? 32 : 40, marginBottom: 8 }}>{icon}</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? 15 : 17 }}>{label}</div>
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>

            {exportStatus && (
              <div style={{
                background: exportStatus.startsWith("✅") ? "#F0FDF4" : "#EEF2FF",
                border: `1.5px solid ${exportStatus.startsWith("✅") ? "#86EFAC" : "#C7D2FE"}`,
                color: exportStatus.startsWith("✅") ? "#166534" : "#3730A3",
                borderRadius: 9, padding: "12px 16px", fontSize: 13, textAlign: "center", marginBottom: 12,
              }}>{exportStatus}</div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setStep(1)} style={btnStyle("#6B7280", true)}>← Back to Edit</button>
              <button onClick={reset} style={btnStyle("#374151", true)}>↺ Start Over</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes progress {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
        * { box-sizing: border-box; }
        input:focus { box-shadow: 0 0 0 2px #4F46E540; border-radius: 4px; }
        @media (max-width: 480px) {
          table { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}