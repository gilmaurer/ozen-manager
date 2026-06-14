import { type RefObject } from "react";
import { useMainScrollRestoration } from "../hooks/useMainScrollRestoration";

export function ScrollRestorer({
  mainRef,
}: {
  mainRef: RefObject<HTMLElement | null>;
}) {
  useMainScrollRestoration(mainRef);
  return null;
}
