import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import styles from "./BoardList.module.css";

type Board = {
  id: string;
  title: string;
  updated_at: string;
  thumbnail: string | null;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function BoardList() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("boards")
      .select("id,title,updated_at,thumbnail")
      .order("updated_at", { ascending: false });
    if (error) setError("Couldn't load boards. Refresh to try again.");
    else setBoards(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createBoard = async () => {
    const { data, error } = await supabase
      .from("boards")
      .insert({ title: "Untitled board", created_by: session!.user.id })
      .select("id")
      .single();
    if (error) return setError("Couldn't create the board.");
    navigate(`/board/${data.id}`);
  };

  const renameBoard = async (b: Board) => {
    const title = prompt("Board name", b.title);
    if (!title || title === b.title) return;
    await supabase.from("boards").update({ title }).eq("id", b.id);
    load();
  };

  const deleteBoard = async (b: Board) => {
    if (!confirm(`Delete "${b.title}"? This can't be undone.`)) return;
    await supabase.from("boards").delete().eq("id", b.id);
    load();
  };

  const importFile = async (file: File) => {
    try {
      const scene = JSON.parse(await file.text());
      const { data, error } = await supabase
        .from("boards")
        .insert({
          title: file.name.replace(/\.excalidraw$/, ""),
          scene: { elements: scene.elements ?? [], files: scene.files ?? {} },
          created_by: session!.user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      navigate(`/board/${data.id}`);
    } catch {
      setError("That file isn't a valid .excalidraw board.");
    }
  };

  const shown = boards.filter((b) =>
    b.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className={styles.page}>
      {/* ── top bar ── */}
      <header className={styles.topbar}>
        <span className={styles.wordmark}>TeamBoard</span>
        <div className={styles.topbarRight}>
          <span className={styles.userEmail}>{session?.user.email}</span>
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {/* ── toolbar ── */}
      <div className={styles.toolbar}>
        <input
          className={`input ${styles.search}`}
          placeholder="Search boards…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className={`btn ${styles.importBtn}`}>
          Import
          <input
            type="file"
            accept=".excalidraw,.json"
            hidden
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
        </label>
        <button className="btn btn-primary" onClick={createBoard}>
          + New board
        </button>
      </div>

      {/* ── error banner ── */}
      {error && (
        <p className={styles.errorBanner} role="alert">{error}</p>
      )}

      {/* ── loading ── */}
      {loading && (
        <div className="state-center" style={{ marginTop: 80 }}>
          <p>Loading boards…</p>
        </div>
      )}

      {/* ── empty state ── */}
      {!loading && shown.length === 0 && (
        <div className="state-center" style={{ marginTop: 80 }}>
          <h2>{query ? "No boards match your search" : "Start your first board"}</h2>
          {!query && (
            <p>Create a board and start sketching with your team.</p>
          )}
          {!query && (
            <button className="btn btn-primary" onClick={createBoard}>
              Create board
            </button>
          )}
        </div>
      )}

      {/* ── grid ── */}
      {!loading && shown.length > 0 && (
        <div className={styles.grid}>
          {shown.map((b) => (
            <div key={b.id} className={styles.card}>
              {/* thumbnail */}
              <div
                className={styles.thumb}
                onClick={() => navigate(`/board/${b.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/board/${b.id}`)}
                aria-label={`Open ${b.title}`}
              >
                {b.thumbnail ? (
                  <img src={b.thumbnail} alt="" className={styles.thumbImg} />
                ) : (
                  <span className={styles.thumbEmpty}>Empty board</span>
                )}
              </div>

              {/* meta */}
              <div className={styles.meta}>
                <div
                  className={styles.cardTitle}
                  onClick={() => navigate(`/board/${b.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/board/${b.id}`)}
                >
                  {b.title}
                </div>
                <div className={styles.cardTime}>Edited {timeAgo(b.updated_at)}</div>
                <div className={styles.cardActions}>
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: "4px 8px" }}
                    onClick={() => renameBoard(b)}>
                    Rename
                  </button>
                  <button className="btn btn-danger" style={{ fontSize: 13, padding: "4px 8px" }}
                    onClick={() => deleteBoard(b)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
