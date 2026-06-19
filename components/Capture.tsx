"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

// ---------- Photo capture / upload ----------
export function PhotoCapture({
  label, value, onChange,
}: { label: string; value: string; onChange: (link: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(""); setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const link = await api.upload(`car-${Date.now()}-${file.name}`, file.type || "image/jpeg", base64);
      onChange(link);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value ? (
        <div className="flex items-center gap-2">
          <a href={value} target="_blank" rel="noreferrer" className="chip text-text">Photo saved ↗</a>
          <button className="btn-ghost text-xs" onClick={() => inputRef.current?.click()}>Replace</button>
        </div>
      ) : (
        <button className="btn-ghost w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : "📷 Take / upload photo"}
        </button>
      )}
      {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

// ---------- Signature pad ----------
export function SignaturePad({
  value, onChange,
}: { value: string; onChange: (link: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0E0F11";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#F2F4F7";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true; setHasInk(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function up() { drawing.current = false; }

  function clear() {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0E0F11"; ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  async function save() {
    setErr(""); setBusy(true);
    try {
      const data = canvasRef.current!.toDataURL("image/png");
      const link = await api.upload(`signature-${Date.now()}.png`, "image/png", data);
      onChange(link);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <span className="label">Customer signature</span>
      {value ? (
        <div className="flex items-center gap-2">
          <a href={value} target="_blank" rel="noreferrer" className="chip text-text">Signature saved ↗</a>
          <button className="btn-ghost text-xs" onClick={() => onChange("")}>Redo</button>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef} width={400} height={140}
            className="w-full touch-none rounded-lg border border-border"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          />
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost text-xs" onClick={clear}>Clear</button>
            <button className="btn-primary text-xs" disabled={busy || !hasInk} onClick={save}>
              {busy ? "Saving…" : "Save signature"}
            </button>
          </div>
        </>
      )}
      {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

// ---------- Generic document upload (PDF/image) ----------
export function DocUpload({
  label, value, onChange,
}: { label: string; value: string; onChange: (link: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    setErr(""); setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const link = await api.upload(`doc-${Date.now()}-${file.name}`, file.type || "application/octet-stream", base64);
      onChange(link);
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <div className="flex items-center gap-2">
        {value && <a href={value} target="_blank" rel="noreferrer" className="chip text-text">File ↗</a>}
        <button className="btn-ghost text-xs" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
      </div>
      {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
