import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Excalidraw,
  getSceneVersion,
  exportToBlob,
  exportToSvg,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { supabase } from "./supabase";

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

export default function BoardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const apiRef = useRef<any>(null);
  const [initial, setInitial] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [exportOpen, setExportOpen] = useState(false);

  const [presenting, setPresenting] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const timer = useRef<any>(null);
  const lastVersion = useRef(-1);
  const latest = useRef<{ elements: any; appState: any; files: any } | null>(null);
  const dirty = useRef(false);

  // ---------- load ----------
  useEffect(() => {
    supabase
      .from("boards")
      .select("title,scene")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return navigate("/");
        const s = data.scene ?? { elements: [], files: {} };
        lastVersion.current = getSceneVersion(s.elements ?? []);
        setTitle(data.title);
        setInitial({
          elements: s.elements ?? [],
          files: s.files ?? {},
          appState: { viewBackgroundColor: s.viewBackgroundColor ?? "#ffffff" },
          scrollToContent: true,
        });
      });
  }, [id, navigate]);

  // ---------- save ----------
  const saveNow = useCallback(async () => {
    clearTimeout(timer.current);
    if (!latest.current || !dirty.current) return;
    const { elements, appState, files } = latest.current;
    setStatus("saving");

    let thumbnail: string | null = null;
    const live = elements.filter((e: any) => !e.isDeleted);
    if (live.length) {
      try {
        const blob = await exportToBlob({
          elements, appState, files, mimeType: "image/png",
          getDimensions: (w: number, h: number) => {
            const scale = 300 / Math.max(w, h);
            return { width: w * scale, height: h * scale, scale };
          },
        });
        thumbnail = await blobToDataUrl(blob);
      } catch { /* thumbnail is optional; never block the save */ }
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
    const v = getSceneVersion(elements);
    if (v === lastVersion.current) return;
    lastVersion.current = v;
    latest.current = { elements, appState, files };
    dirty.current = true;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, 1500);
  };

  // warn before closing the tab with unsaved changes
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) { e.preventDefault(); e.returnValue = ""; }
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

  // ---------- export ----------
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

  const exportSvg = async () => {
    const api = apiRef.current;
    const svg = await exportToSvg({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true },
      files: api.getFiles(),
    });
    download(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${title}.svg`);
    setExportOpen(false);
  };

  const exportFile = () => {
    const api = apiRef.current;
    const json = serializeAsJSON(
      api.getSceneElements(), api.getAppState(), api.getFiles(), "local"
    );
    download(new Blob([json], { type: "application/json" }), `${title}.excalidraw`);
    setExportOpen(false);
  };

  // ---------- present mode ----------
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
      alert("This board has no frames yet. Press F and draw a frame around each slide.");
      return;
    }
    await saveNow();
    setPresenting(true);
    try { await document.documentElement.requestFullscreen(); } catch {}
    // wait a tick so view mode applies before moving the camera
    setTimeout(() => goToFrame(0), 100);
  };

  const stopPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen();
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") goToFrame(frameIdx + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") goToFrame(frameIdx - 1);
      if (e.key === "Escape") stopPresenting();
    };
    // Esc exits browser fullscreen *before* your keydown fires,
    // so also end presenting when fullscreen is left by any route
    const onFs = () => { if (!document.fullscreenElement) setPresenting(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [presenting, frameIdx, goToFrame, stopPresenting]);

  const initialData = useMemo(() => initial, [initial]);
  if (!initialData) return <p style={{ textAlign: "center", marginTop: "30vh" }}>Loading...</p>;

  const statusText =
    status === "saved" ? "Saved" : status === "saving" ? "Saving..." : "Save failed. Retrying on next change.";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ---------- top bar ---------- */}
      {!presenting && (
        <div style={{ height: 48, display: "flex", alignItems: "center", gap: 12,
                      padding: "0 12px", borderBottom: "1px solid #ddd", background: "#fff" }}>
          <button onClick={goBack}>← Boards</button>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Board title"
            style={{ fontSize: 16, fontWeight: 500, border: "1px solid transparent",
                     padding: "4px 8px", borderRadius: 6, minWidth: 200 }}
          />

          <span style={{ fontSize: 13, color: status === "error" ? "crimson" : "#666" }}>
            {statusText}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, position: "relative" }}>
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? "Dark" : "Light"}
            </button>

            <button onClick={() => setExportOpen(!exportOpen)}>Export ▾</button>
            {exportOpen && (
              <div style={{ position: "absolute", top: 38, right: 90, background: "#fff",
                            border: "1px solid #ddd", borderRadius: 8, padding: 4, zIndex: 20,
                            display: "flex", flexDirection: "column", minWidth: 150 }}>
                <button onClick={exportPng}>PNG image</button>
                <button onClick={exportSvg}>SVG image</button>
                <button onClick={exportFile}>.excalidraw file</button>
              </div>
            )}

            <button onClick={startPresenting}>▶ Present</button>
          </div>
        </div>
      )}

      {/* ---------- editor ---------- */}
      <div style={{ flex: 1, position: "relative" }}>
        <Excalidraw
          excalidrawAPI={(api: any) => (apiRef.current = api)}
          initialData={initialData}
          onChange={handleChange}
          theme={theme}
          viewModeEnabled={presenting}
          zenModeEnabled={presenting}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
        />

        {/* ---------- present controls ---------- */}
        {presenting && (
          <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                        display: "flex", alignItems: "center", gap: 12, padding: "8px 14px",
                        background: "rgba(0,0,0,0.75)", color: "#fff", borderRadius: 999, zIndex: 20 }}>
            <button onClick={() => goToFrame(frameIdx - 1)} aria-label="Previous slide">←</button>
            <span style={{ fontSize: 14, minWidth: 48, textAlign: "center" }}>
              {frameIdx + 1} / {frameCount}
            </span>
            <button onClick={() => goToFrame(frameIdx + 1)} aria-label="Next slide">→</button>
            <button onClick={stopPresenting}>Exit</button>
          </div>
        )}
      </div>
    </div>
  );
}