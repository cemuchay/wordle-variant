// src/utils/theme.ts

export type AppThemeValue = "dark" | "light" | "wordup" | "wordgrid" | string;

/**
 * Resolves a theme key or hex string to an exact hex background color.
 */
export function getThemeBackgroundColor(theme?: AppThemeValue): string {
   if (!theme) return "#121213";
   if (theme.startsWith("#")) return theme;
   if (theme === "wordup") return "#18181b";
   if (theme === "wordgrid") return "#0F172B";
   if (theme === "light") return "#ffffff";
   if (theme === "dark") return "#121213";
   return "#121213";
}

/**
 * Central theme updater function.
 * Updates data-theme attributes, document background color, body background color,
 * and the HTML <meta name="theme-color"> tag for iOS/Android status & home bar.
 */
export function applyTheme(theme?: AppThemeValue): void {
   if (typeof window === "undefined") return;

   const hexColor = getThemeBackgroundColor(theme);

   if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
   }

   document.documentElement.style.backgroundColor = hexColor;
   document.body.style.backgroundColor = hexColor;

   // Sync HTML meta theme-color tag
   let metaThemeColor = document.querySelector('meta[name="theme-color"]');
   if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
   }
   metaThemeColor.setAttribute("content", hexColor);
}
