import { useEffect, useState } from "react";
import { supabase } from "../../db/supabase";

export const ADMIN_EMAILS = ["maurer.gil@gmail.com", "booking@ozenlive.com"];

export function useIsAdmin(): boolean {
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
