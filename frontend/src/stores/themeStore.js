import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useThemeStore = create(
  persist(
    (set, get) => ({
      // État initial
      theme: "light", // 'light' | 'dark' | 'system'
      actualTheme: "light", // Le thème réellement appliqué

      // Actions
      setTheme: (newTheme) => {
        set({ theme: newTheme });
        get().applyTheme(newTheme);
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "light" ? "dark" : "light";
        get().setTheme(newTheme);
      },

      applyTheme: (theme) => {
        let actualTheme = theme;

        if (theme === "system") {
          // Détecter le thème système
          actualTheme = window.matchMedia("(prefers-color-scheme: dark)")
            .matches
            ? "dark"
            : "light";
        }

        set({ actualTheme });

        // Appliquer le thème sur le DOM
        const root = document.documentElement;
        if (actualTheme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      },

      initializeTheme: () => {
        const { theme, applyTheme } = get();

        // Écouter les changements de thème système
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        mediaQuery.addEventListener("change", () => {
          if (get().theme === "system") {
            applyTheme("system");
          }
        });

        // Appliquer le thème initial
        applyTheme(theme);
      },

      // Getters
      isDark: () => get().actualTheme === "dark",
      isLight: () => get().actualTheme === "light",
      isSystem: () => get().theme === "system",
    }),
    {
      name: "theme-storage",
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);
