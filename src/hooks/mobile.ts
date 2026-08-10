"use client";

import { useEffect, useState } from "react";

export const MOBILE_BREAKPOINT = 900;
export const COMPACT_BREAKPOINT = 640;

function media(query: string) {
  return typeof window !== "undefined" ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string, fallback = false) {
  const [matches, setMatches] = useState(fallback);

  useEffect(() => {
    const list = media(query);
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function useMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

export function useCompactMobile() {
  return useMediaQuery(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
}

export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useTouchDevice() {
  return useMediaQuery("(pointer: coarse)");
}

export function useLandscapeMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px) and (orientation: landscape)`);
}
