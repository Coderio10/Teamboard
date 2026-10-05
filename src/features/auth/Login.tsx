import { useState } from "react";
import { supabase } from "../../lib/supabase";
import styles from "./Login.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
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
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.icon} aria-hidden="true">✉️</div>
          <h1 className={styles.heading}>Check your email</h1>
          <p className={styles.sub}>
            We sent a magic link to <strong>{email}</strong>.<br />
            Click it to sign in — no password needed.
          </p>
          <button
            className="btn"
            onClick={() => setStatus("idle")}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="var(--brand)" />
            <path d="M8 26L14 10L20 22L24 14L30 26" stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className={styles.heading}>TeamBoard</h1>
        <p className={styles.sub}>Sign in with your team email to continue.</p>

        <form onSubmit={handleLogin} className={styles.form}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === "sending"}
            style={{ width: "100%", justifyContent: "center", padding: "10px" }}
          >
            {status === "sending" ? "Sending link…" : "Send login link"}
          </button>
        </form>

        {status === "error" && (
          <p className={styles.error} role="alert">{message}</p>
        )}
      </div>
    </div>
  );
}
