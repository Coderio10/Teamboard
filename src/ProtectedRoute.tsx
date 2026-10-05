import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p style={{ textAlign: "center", marginTop: "30vh" }}>Loading...</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}