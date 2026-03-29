import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface AuthContextValue {
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { identity, login, clear, isInitializing } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const [isAdmin, setIsAdmin] = useState(false);

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  useEffect(() => {
    if (isAuthenticated && actor && !isFetching) {
      actor
        .isCallerAdmin()
        .then(setIsAdmin)
        .catch(() => setIsAdmin(false));
    } else if (!isAuthenticated) {
      setIsAdmin(false);
    }
  }, [isAuthenticated, actor, isFetching]);

  const loading = isInitializing || (isAuthenticated && isFetching);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isAdmin, loading, login, logout: clear }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
