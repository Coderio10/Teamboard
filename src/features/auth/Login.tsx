import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import styles from "./Login.module.css";
import logoAlt from "../../assets/logo alt.png";

export default function Login() {
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in — go straight to the app
  if (!loading && session) return <Navigate to="/" replace />;

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setError("Couldn't start sign-in. Please try again.");
      setBusy(false);
    }
    // On success the browser redirects — no further state update needed
  };

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={logoAlt} alt="TeamBoard logo" width={125} height={32} />
        </div>

        <h1 className={styles.heading}>TeamBoard</h1>
        <p className={styles.sub}>Sign in to access your team's boards.</p>

        <button
          className="btn btn-primary"
          onClick={handleGoogleSignIn}
          disabled={busy || loading}
          style={{ width: "100%", justifyContent: "center", padding: "10px" }}
        >
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <p className={styles.error} role="alert">{error}</p>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
          You'll stay signed in on this device for 30 days.
        </p>
      </div>
    </div>
  );
}
