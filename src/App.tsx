import { useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import ozenLogo from "./assets/ozen-logo.png";
import { BackupStatus } from "./components/BackupStatus";
import { DialogProvider, useDialog } from "./components/dialog";
import { AuthGate } from "./features/auth/AuthGate";
import { supabase } from "./db/supabase";
import { EnumsProvider } from "./services/enums";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EventsPage } from "./features/events/EventsPage";
import { EventDetailPage } from "./features/events/EventDetailPage";
import { ProducersPage } from "./features/producers/ProducersPage";
import { ProducerDetailPage } from "./features/producers/ProducerDetailPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { EventSummaryPage } from "./features/summaries/EventSummaryPage";
import { UpdaterProvider } from "./features/updates/UpdaterProvider";
import { UpdateBanner } from "./features/updates/UpdateBanner";
import { UpdateCheckButton } from "./features/updates/UpdateCheckButton";

const ADMIN_EMAILS = ["maurer.gil@gmail.com", "booking@ozenlive.com"];

function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const email = data.user?.email?.toLowerCase() ?? "";
      setIsAdmin(ADMIN_EMAILS.includes(email));
    });
    return () => {
      active = false;
    };
  }, []);
  return isAdmin;
}

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

function Sidebar() {
  const isAdmin = useIsAdmin();
  const { ask } = useDialog();

  async function handleSignOut() {
    if (!(await ask("להתנתק?"))) return;
    await supabase.auth.signOut();
  }

  return (
    <nav className="sidebar">
      <img src={ozenLogo} alt="Ozen" className="sidebar-logo" />
      <NavLink to="/" end className="nav-link">
        לוח בקרה
      </NavLink>
      <NavLink to="/events" className="nav-link">
        אירועים
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
        <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>
          יציאה
        </button>
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
