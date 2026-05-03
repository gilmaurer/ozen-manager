import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import ozenLogo from "./assets/ozen-logo.png";
import { BackupStatus } from "./components/BackupStatus";
import { DialogProvider, useDialog } from "./components/dialog";
import { AuthGate } from "./features/auth/AuthGate";
import { useIsAdmin } from "./features/auth/useIsAdmin";
import { supabase } from "./db/supabase";
import { EnumsProvider } from "./services/enums";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EventsPage } from "./features/events/EventsPage";
import { EventDetailPage } from "./features/events/EventDetailPage";
import { ProducersPage } from "./features/producers/ProducersPage";
import { ProducerDetailPage } from "./features/producers/ProducerDetailPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { EventSummaryPage } from "./features/summaries/EventSummaryPage";
import { PaymentsPage } from "./features/payments/PaymentsPage";
import { UpdaterProvider } from "./features/updates/UpdaterProvider";
import { UpdateBanner } from "./features/updates/UpdateBanner";
import { UpdateCheckButton } from "./features/updates/UpdateCheckButton";

function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const handleOn = () => setOffline(false);
    const handleOff = () => setOffline(true);
    window.addEventListener("online", handleOn);
    window.addEventListener("offline", handleOff);
    return () => {
      window.removeEventListener("online", handleOn);
      window.removeEventListener("offline", handleOff);
    };
  }, []);
  if (!offline) return null;
  return <div className="offline-banner">אין חיבור לאינטרנט — שינויים יישמרו כשהחיבור יחזור</div>;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserChip() {
  const { ask } = useDialog();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setUser(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email ||
    "משתמש";
  const email = user.email ?? "";
  const avatar =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  const initials = initialsOf(name);

  async function handleSignOut() {
    setOpen(false);
    if (!(await ask("להתנתק?"))) return;
    await supabase.auth.signOut();
  }

  return (
    <div className="user-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="user-chip"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="user-chip-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="user-chip-avatar" aria-hidden>
            {initials}
          </span>
        )}
        <span className="user-chip-name row-value" dir="auto">
          {name}
        </span>
        <span className="user-chip-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="user-popover" role="menu">
          <div className="user-popover-header">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="user-chip-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="user-chip-avatar" aria-hidden>
                {initials}
              </span>
            )}
            <div className="user-popover-identity">
              <div className="user-popover-name row-value" dir="auto">
                {name}
              </div>
              <div className="user-popover-email" dir="ltr">
                {email}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSignOut}
          >
            יציאה
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const isAdmin = useIsAdmin();

  return (
    <nav className="sidebar">
      <img src={ozenLogo} alt="Ozen" className="sidebar-logo" />
      <NavLink to="/" end className="nav-link">
        לוח בקרה
      </NavLink>
      <NavLink to="/events" className="nav-link">
        אירועים
      </NavLink>
      <NavLink to="/payments" className="nav-link">
        תשלומים
      </NavLink>
      <NavLink to="/producers" className="nav-link">
        מפיקים
      </NavLink>
      {isAdmin && (
        <NavLink to="/settings" className="nav-link">
          הגדרות
        </NavLink>
      )}
      <div className="sidebar-footer">
        <BackupStatus />
        <UpdateCheckButton />
        <UserChip />
      </div>
    </nav>
  );
}

function AdminGuardedSettings() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) {
    return (
      <div className="card">
        <div className="empty">אין גישה לעמוד הזה.</div>
      </div>
    );
  }
  return <SettingsPage />;
}

export default function App() {
  return (
    <AuthGate>
      <EnumsProvider>
        <DialogProvider>
          <UpdaterProvider>
            <HashRouter>
              <UpdateBanner />
              <OfflineBanner />
              <div className="layout">
                <Sidebar />
                <main className="main">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/events/:id" element={<EventDetailPage />} />
                    <Route path="/events/:id/summary" element={<EventSummaryPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/producers" element={<ProducersPage />} />
                    <Route path="/producers/:id" element={<ProducerDetailPage />} />
                    <Route path="/settings" element={<AdminGuardedSettings />} />
                  </Routes>
                </main>
              </div>
            </HashRouter>
          </UpdaterProvider>
        </DialogProvider>
      </EnumsProvider>
    </AuthGate>
  );
}
