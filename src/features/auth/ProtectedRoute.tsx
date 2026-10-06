import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;

    setAllowed(null); // reset while checking

    supabase.rpc("is_team_member").then(({ data, error }) => {
      // Treat any error or a non-true result as not allowed
      setAllowed(!error && data === true);
    });
  }, [session]);

  // 1. Auth still loading
  if (loading) {
    return (
      <div className="state-center" style={{ marginTop: "30vh" }}>
        <p>Loading…</p>
      </div>
    );
  }

  // 2. No session → send to login
  if (!session) return <Navigate to="/login" replace />;

  // 3. Session exists but membership check not done yet
  if (allowed === null) {
    return (
      <div className="state-center" style={{ marginTop: "30vh" }}>
        <p>Checking access…</p>
      </div>
    );
  }

  // 4. Not a team member
  if (!allowed) {
    return (
      <div className="state-center" style={{ marginTop: "20vh" }}>
        <h2>You're not on the team yet</h2>
        <p>
          <strong>{session.user.email}</strong> doesn't have access to TeamBoard.
          <br />
          Ask your admin to add you, or sign in with a different account.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: 8 }}
        >
          Sign out
        </button>
      </div>
    );
  }

  // 5. Allowed → render the page
  return <>{children}</>;
}
