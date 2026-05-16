// 라이트/다크 테마 전환 토글 (해/달 아이콘). 우클릭으로 시스템 자동 복귀
import { useTheme } from "../lib/theme";

export default function ThemeToggle({ className = "" }) {
  const { theme, setTheme, isExplicit } = useTheme();
  const isDark = theme === "dark";

  function handleClick() {
    setTheme(isDark ? "light" : "dark");
  }
  function handleReset(e) {
    e.preventDefault();
    setTheme("system");
  }

  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={handleClick}
      onContextMenu={handleReset}
      aria-label={label}
      title={`${label}${isExplicit ? " (우클릭: 시스템 설정 따르기)" : " · 시스템 자동"}`}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {!isExplicit && <span className="theme-dot" aria-hidden="true" />}
    </button>
  );
}
