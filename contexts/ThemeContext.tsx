/**
 * ThemeContext — dark mode state management (paridad con la web).
 *
 * - Persiste la preferencia en `customStorage` (SecureStore en native,
 *   localStorage en web) bajo la misma key que la web: `umpi-theme`.
 * - La preferencia del sistema (useColorScheme) es el default MIENTRAS el
 *   usuario no haya elegido explicitamente — mismo comportamiento que el
 *   ThemeContext web (solo sigue al sistema cuando no hay preferencia
 *   guardada).
 * - La hidratacion es asincrona porque customStorage es async en native;
 *   el SplashOverlay cubre el arranque, asi que no hay flash de tema.
 *
 * SCOPE DECISION (documentado): lib/toast.tsx queda estatico por diseño —
 * sus colores son de marca (verde/rojo) y funcionan sobre ambos temas; la
 * config de react-native-toast-message vive a nivel de modulo, fuera del
 * arbol de providers, y no se migra.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, DarkColors, type Palette } from '@/constants/colors';
import { customStorage } from '@/lib/storage';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  colors: Palette;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'umpi-theme';

const PALETTES: Record<Theme, Palette> = {
  light: Colors,
  dark: DarkColors,
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('light');
  // La hidratacion asincrona no debe pisar una eleccion explicita del
  // usuario hecha antes de que resuelva el getItem.
  const hydratedRef = useRef(false);

  // Hidratacion asincrona + seguimiento del sistema cuando no hay
  // preferencia guardada (el efecto re-corre ante cambios del sistema).
  useEffect(() => {
    let cancelled = false;
    customStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || hydratedRef.current) return;
        if (stored === 'dark' || stored === 'light') {
          setThemeState(stored);
        } else {
          // Sin preferencia guardada → seguir al sistema (paridad web)
          setThemeState(systemScheme === 'dark' ? 'dark' : 'light');
        }
      })
      .catch(() => {
        // SecureStore/localStorage pueden fallar (keychain roto, quota);
        // degradar al default del sistema sin romper el arranque.
        if (!cancelled && !hydratedRef.current) setThemeState(systemScheme === 'dark' ? 'dark' : 'light');
      });
    return () => {
      cancelled = true;
    };
  }, [systemScheme]);

  const setTheme = (next: Theme) => {
    hydratedRef.current = true;
    setThemeState(next);
    // Fire-and-forget: en web es sync, en native async (SecureStore).
    customStorage.setItem(STORAGE_KEY, next).catch((err) => {
      console.warn('Theme save error:', err);
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      isDark: theme === 'dark',
      colors: PALETTES[theme],
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return context;
}

/** Paleta activa (light o dark) para los estilos por tema. */
export function useThemeColors(): Palette {
  return useTheme().colors;
}
