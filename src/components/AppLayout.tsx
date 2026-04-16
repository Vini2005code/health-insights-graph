import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, MessageSquare, Users, LayoutDashboard, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: MessageSquare, label: "Chat" },
  { to: "/patients", icon: Users, label: "Pacientes" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform md:static md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-2 border-b p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Primordial Data</span>
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3" />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-2 font-semibold">Primordial Data</span>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
