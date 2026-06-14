import { useEffect, useLayoutEffect, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// scrollTop keyed by history entry key (stable across back/forward).
const scrollPositions = new Map<string, number>();

export function useMainScrollRestoration(
  containerRef: RefObject<HTMLElement | null>,
): void {
  const location = useLocation();
  const navType = useNavigationType(); // "POP" | "PUSH" | "REPLACE"

  // Continuously record the current entry's scroll position.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      scrollPositions.set(location.key, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, location.key]);

  // On navigation: restore (POP) or reset to top (PUSH/REPLACE).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (navType !== "POP") {
      el.scrollTop = 0;
      return;
    }

    const target = scrollPositions.get(location.key) ?? 0;
    if (target === 0) {
      el.scrollTop = 0;
      return;
    }

    const start = performance.now();
    let raf = 0;
    let cancelled = false;
    // If the user starts scrolling during the restore window, stop fighting them.
    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    window.addEventListener("keydown", stop, { once: true });

    const tryRestore = () => {
      if (cancelled) return;
      el.scrollTop = target;
      const reached = Math.abs(el.scrollTop - target) < 2;
      if (!reached && performance.now() - start < 1200) {
        raf = requestAnimationFrame(tryRestore);
      }
    };
    raf = requestAnimationFrame(tryRestore);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [containerRef, location.key, navType]);
}
