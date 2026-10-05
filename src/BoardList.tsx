import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { useAuth } from "./AuthProvider";

type Board = {
  id: string;
  title: string;
  updated_at: string;
  thumbnail: string | null;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
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
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>TeamBoard</h1>
        <div>
          <span style={{ marginRight: 12 }}>{session?.user.email}</span>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input
          placeholder="Search boards"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <label style={{ cursor: "pointer", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}>
          Import
          <input
            type="file"
            accept=".excalidraw,.json"
            hidden
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
        </label>
        <button onClick={createBoard} style={{ padding: "10px 16px" }}>+ New board</button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && shown.length === 0 && (
        <div style={{ textAlign: "center", marginTop: 80 }}>
          <h2>{query ? "No boards match your search" : "Start your first board"}</h2>
          {!query && <button onClick={createBoard}>Create board</button>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {shown.map((b) => (
          <div key={b.id} style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
            <div
              onClick={() => navigate(`/board/${b.id}`)}
              style={{ height: 130, background: "#f5f5f5", cursor: "pointer",
                       display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {b.thumbnail
                ? <img src={b.thumbnail} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                : <span style={{ color: "#999" }}>Empty board</span>}
            </div>
            <div style={{ padding: 12 }}>
              <div
                onClick={() => navigate(`/board/${b.id}`)}
                style={{ fontWeight: 500, cursor: "pointer" }}
              >
                {b.title}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Edited {timeAgo(b.updated_at)}
              </div>
              <button onClick={() => renameBoard(b)}>Rename</button>{" "}
              <button onClick={() => deleteBoard(b)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}