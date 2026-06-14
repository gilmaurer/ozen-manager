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
    const tryRestore = () => {
      el.scrollTop = target;
      const reached = Math.abs(el.scrollTop - target) < 2;
      if (!reached && performance.now() - start < 1200) {
        raf = requestAnimationFrame(tryRestore);
      }
    };
    raf = requestAnimationFrame(tryRestore);
    return () => cancelAnimationFrame(raf);
  }, [containerRef, location.key, navType]);
}
