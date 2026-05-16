// 라이트/다크 테마 상태 관리 훅. localStorage 'theme' 키 + 시스템 prefers-color-scheme 동기화
import { useEffect, useState, useCallback } from "react";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") || "light";
  });
  const [isExplicit, setIsExplicit] = useState(() => readStored() !== null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (readStored() === null) {
        const sys = mql.matches ? "dark" : "light";
        applyTheme(sys);
        setThemeState(sys);
      }
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const setTheme = useCallback((next) => {
    if (next === "system") {
      try {
        localStorage.removeItem("theme");
      } catch {}
      const sys = getSystemTheme();
      applyTheme(sys);
      setThemeState(sys);
      setIsExplicit(false);
    } else if (next === "light" || next === "dark") {
      try {
        localStorage.setItem("theme", next);
      } catch {}
      applyTheme(next);
      setThemeState(next);
      setIsExplicit(true);
    }
  }, []);

  return { theme, setTheme, isExplicit };
}
