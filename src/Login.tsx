import { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setStatus("sending");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false, // only invited users can log in
        emailRedirectTo: window.location.origin, // where the link sends them back to
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  };

  if (status === "sent") {
    return (
      <div style={{ maxWidth: 360, margin: "20vh auto", textAlign: "center" }}>
        <h2>Check your email</h2>
        <p>We sent a login link to <b>{email}</b>. Click it to sign in.</p>
        <button onClick={() => setStatus("idle")}>Use a different email</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin} style={{ maxWidth: 360, margin: "20vh auto" }}>
      <h1>TeamBoard</h1>
      <p>Sign in with your team email.</p>
      <input
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />
      <button type="submit" disabled={status === "sending"} style={{ width: "100%", padding: 10 }}>
        {status === "sending" ? "Sending..." : "Send login link"}
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>{message}</p>}
    </form>
  );
}