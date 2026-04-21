import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EventsPage } from "./features/events/EventsPage";
import { EventDetailPage } from "./features/events/EventDetailPage";
import { StaffPage } from "./features/staff/StaffPage";

function Sidebar() {
  return (
    <nav className="sidebar">
      <h1>אוזן</h1>
      <NavLink to="/" end className="nav-link">
        לוח בקרה
      </NavLink>
      <NavLink to="/events" className="nav-link">
        אירועים
      </NavLink>
      <NavLink to="/staff" className="nav-link">
        צוות
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/staff" element={<StaffPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
