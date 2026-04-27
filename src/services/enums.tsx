import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../db/supabase";

export interface StatusRow {
  id: number;
  code: string;
  label: string;
  color: string;
}

export interface TypeRow {
  id: number;
  code: string;
  label: string;
}

interface Ctx {
  statuses: StatusRow[];
  types: TypeRow[];
  statusByCode: Record<string, StatusRow>;
  typeByCode: Record<string, TypeRow>;
  reload: () => Promise<void>;
}

const EnumsContext = createContext<Ctx | null>(null);

export function EnumsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    statuses: StatusRow[];
    types: TypeRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sRes, tRes] = await Promise.all([
      supabase.from("event_statuses").select("*").order("id", { ascending: true }),
      supabase.from("event_types").select("*").order("id", { ascending: true }),
    ]);
    if (sRes.error) throw sRes.error;
    if (tRes.error) throw tRes.error;
    setState({
      statuses: (sRes.data ?? []) as StatusRow[],
      types: (tRes.data ?? []) as TypeRow[],
    });
  }, []);

  useEffect(() => {
    reload().catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [reload]);

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null;
    const statusByCode = Object.fromEntries(
      state.statuses.map((s) => [s.code, s]),
    );
    const typeByCode = Object.fromEntries(
      state.types.map((t) => [t.code, t]),
    );
    return { ...state, statusByCode, typeByCode, reload };
  }, [state, reload]);

  if (error) {
    return (
      <div className="empty" style={{ padding: 40 }}>
        שגיאה בטעינת הגדרות: {error}
      </div>
    );
  }
  if (!value) return <div className="empty" style={{ padding: 40 }}>טוען…</div>;
  return <EnumsContext.Provider value={value}>{children}</EnumsContext.Provider>;
}

export function useEnums(): Ctx {
  const v = useContext(EnumsContext);
  if (!v) throw new Error("useEnums must be used within EnumsProvider");
  return v;
}
