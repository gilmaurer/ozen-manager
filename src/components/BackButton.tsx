import { useLocation, useNavigate } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  useLocation(); // re-render on navigation so the history idx below is fresh

  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx <= 0) return null;

  return (
    <button
      type="button"
      className="btn btn-secondary back-btn"
      onClick={() => navigate(-1)}
    >
      › אחורה
    </button>
  );
}
