import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanFace,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/" as const, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/students" as const, icon: Users, label: "Students" },
  { to: "/attendance" as const, icon: ScanFace, label: "Attendance" },
  { to: "/reports" as const, icon: FileText, label: "Reports" },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <ScanFace className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-none text-foreground">
            BioAttend
          </p>
          <p className="text-xs mt-0.5 text-muted-foreground">
            Coaching Institute
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Main Menu
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            activeProps={{
              className:
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all bg-primary text-white",
            }}
            onClick={onClose}
            data-ocid={`nav.${label.toLowerCase()}.link`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold bg-primary text-white">
            AD
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={handleLogout}
          data-ocid="nav.logout.button"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col border-r border-border shadow-xs">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-white px-4 lg:px-6 shadow-xs">
          <button
            type="button"
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
            data-ocid="nav.menu.button"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold bg-primary text-white">
            AD
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
