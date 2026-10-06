import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { supabase } from "../../lib/supabase";
import styles from "./BoardEditor.module.css";

type SaveStatus = "saved" | "saving" | "error";

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Lightweight scene version: sum of element versions */
const sceneVersion = (elements: any[]): number =>
  elements.reduce((acc: number, el: any) => acc + (el.version ?? 0), 0);

export default function BoardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const apiRef = useRef<any>(null);
  const [initial, setInitial] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [exportOpen, setExportOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVersion = useRef(-1);
  const latest = useRef<{ elements: any; appState: any; files: any } | null>(null);
  const dirty = useRef(false);

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("boards")
      .select("title,scene")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return navigate("/");
        const s = data.scene ?? { elements: [], files: {} };
        lastVersion.current = sceneVersion(s.elements ?? []);
        setTitle(data.title);
        setInitial({
          elements: s.elements ?? [],
          files: s.files ?? {},
          appState: { viewBackgroundColor: s.viewBackgroundColor ?? "#ffffff" },
          scrollToContent: true,
        });
      });
  }, [id, navigate]);

  // ── save ──────────────────────────────────────────────────────────────────
  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!latest.current || !dirty.current) return;
    const { elements, appState, files } = latest.current;
    setStatus("saving");

    let thumbnail: string | null = null;
    const live = elements.filter((e: any) => !e.isDeleted);
    if (live.length) {
      try {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png",
          getDimensions: (w: number, h: number) => {
            const scale = 300 / Math.max(w, h);
            return { width: w * scale, height: h * scale, scale };
          },
        });
        thumbnail = await blobToDataUrl(blob);
      } catch { /* thumbnail is optional */ }
    }

    const { error } = await supabase
      .from("boards")
      .update({
        scene: { elements, files, viewBackgroundColor: appState.viewBackgroundColor },
        thumbnail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setStatus("error");
    } else {
      dirty.current = false;
      setStatus("saved");
    }
  }, [id]);

  const handleChange = (elements: any, appState: any, files: any) => {
    const v = sceneVersion(elements);
    if (v === lastVersion.current) return;
    lastVersion.current = v;
    latest.current = { elements, appState, files };
    dirty.current = true;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, 1500);
  };

  // warn on unsaved close
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const goBack = async () => {
    await saveNow();
    navigate("/");
  };

  const saveTitle = async () => {
    const t = title.trim() || "Untitled board";
    setTitle(t);
    await supabase.from("boards").update({ title: t }).eq("id", id);
  };

  // ── export ────────────────────────────────────────────────────────────────
  const exportPng = async () => {
    const api = apiRef.current;
    const blob = await exportToBlob({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true },
      files: api.getFiles(),
      mimeType: "image/png",
    });
    download(blob, `${title}.png`);
    setExportOpen(false);
  };

  const exportSvgFile = async () => {
    const api = apiRef.current;
    const svg = await exportToSvg({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true },
      files: api.getFiles(),
    });
    download(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${title}.svg`);
    setExportOpen(false);
  };

  const exportExcalidraw = () => {
    const api = apiRef.current;
    const json = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local"
    );
    download(new Blob([json], { type: "application/json" }), `${title}.excalidraw`);
    setExportOpen(false);
  };

  // ── present mode ──────────────────────────────────────────────────────────
  const getFrames = () =>
    (apiRef.current?.getSceneElements() ?? [])
      .filter((e: any) => e.type === "frame" && !e.isDeleted)
      .sort((a: any, b: any) => a.y - b.y || a.x - b.x);

  const goToFrame = useCallback((i: number) => {
    const frames = getFrames();
    if (!frames.length) return;
    const n = Math.max(0, Math.min(i, frames.length - 1));
    setFrameIdx(n);
    setFrameCount(frames.length);
    apiRef.current.scrollToContent(frames[n], { fitToViewport: true, animate: true });
  }, []);

  const startPresenting = async () => {
    if (!getFrames().length) {
      alert("No frames found. Press F and draw a frame around each slide first.");
      return;
    }
    await saveNow();
    setPresenting(true);
    try { await document.documentElement.requestFullscreen(); } catch {}
    setTimeout(() => goToFrame(0), 100);
  };

  const stopPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen();
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) goToFrame(frameIdx + 1);
      if (["ArrowLeft", "PageUp"].includes(e.key)) goToFrame(frameIdx - 1);
      if (e.key === "Escape") stopPresenting();
    };
    const onFs = () => { if (!document.fullscreenElement) setPresenting(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [presenting, frameIdx, goToFrame, stopPresenting]);

  // ── render ────────────────────────────────────────────────────────────────
  const initialData = useMemo(() => initial, [initial]);

  if (!initialData) {
    return (
      <div className="state-center" style={{ marginTop: "30vh" }}>
        <p>Loading board…</p>
      </div>
    );
  }

  const statusLabel =
    status === "saved"  ? "Saved" :
    status === "saving" ? "Saving…" :
    "Save failed — will retry";

  return (
    <div className={styles.shell}>
      {/* ── top bar ── */}
      {!presenting && (
        <div className={styles.topbar}>
          <button className="btn btn-ghost" onClick={goBack} aria-label="Back to boards">
            ← Boards
          </button>

          <input
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Board title"
          />

          <span
            className={styles.saveStatus}
            data-error={status === "error"}
            aria-live="polite"
          >
            {statusLabel}
          </span>

          <div className={styles.topbarActions}>
            <button
              className="btn btn-ghost"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            <div className={styles.exportWrap}>
              <button
                className="btn"
                onClick={() => setExportOpen(!exportOpen)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
              >
                Export ▾
              </button>
              {exportOpen && (
                <>
                  <div className={styles.exportBackdrop} onClick={() => setExportOpen(false)} />
                  <div className={styles.exportMenu} role="menu">
                    <button className={styles.exportItem} role="menuitem" onClick={exportPng}>PNG image</button>
                    <button className={styles.exportItem} role="menuitem" onClick={exportSvgFile}>SVG image</button>
                    <button className={styles.exportItem} role="menuitem" onClick={exportExcalidraw}>.excalidraw file</button>
                  </div>
                </>
              )}
            </div>

            <button className="btn btn-primary" onClick={startPresenting}>
              ▶ Present
            </button>
          </div>
        </div>
      )}

      {/* ── canvas ── */}
      <div className={styles.canvas}>
        <Excalidraw
          excalidrawAPI={(api: any) => (apiRef.current = api)}
          initialData={initialData}
          onChange={handleChange}
          theme={theme}
          viewModeEnabled={presenting}
          zenModeEnabled={presenting}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
        />

        {/* ── present controls ── */}
        {presenting && (
          <div className={styles.presentBar} role="toolbar" aria-label="Presentation controls">
            <button
              className={styles.presentBtn}
              onClick={() => goToFrame(frameIdx - 1)}
              aria-label="Previous slide"
            >
              ←
            </button>
            <span className={styles.presentCounter}>
              {frameIdx + 1} / {frameCount}
            </span>
            <button
              className={styles.presentBtn}
              onClick={() => goToFrame(frameIdx + 1)}
              aria-label="Next slide"
            >
              →
            </button>
            <button className={styles.presentBtn} onClick={stopPresenting}>
              Exit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
