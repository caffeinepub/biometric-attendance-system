import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ScanFace, Shield } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function LoginPage() {
  const { isAuthenticated, loading, login } = useAuth();
  const { isLoggingIn } = useInternetIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  const busy = loading || isLoggingIn;

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-white p-8 shadow-card">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary mb-4">
              <ScanFace className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">BioAttend</h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Coaching Institute Management
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {["Face Recognition", "Live Sessions", "Reports"].map((f) => (
              <span
                key={f}
                className="text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground font-medium border border-border"
              >
                {f}
              </span>
            ))}
          </div>

          <Button
            className="w-full h-11 font-semibold text-sm gap-2 bg-primary text-white hover:bg-primary/90"
            onClick={login}
            disabled={busy}
            data-ocid="login.primary_button"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Sign In with Internet Identity
              </>
            )}
          </Button>

          <p className="text-xs text-center mt-4 text-muted-foreground">
            Secure authentication powered by Internet Computer
          </p>
        </div>

        <p className="text-center text-xs mt-6 text-muted-foreground">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
