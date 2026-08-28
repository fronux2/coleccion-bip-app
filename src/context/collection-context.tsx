import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { catalogo } from '@/lib/catalogo';

const STORAGE_KEY = 'coleccion-bip:estado';

type Estado = Record<string, boolean>;

type CollectionContextValue = {
  loading: boolean;
  notice: string | null;
  has: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  total: number;
  tengoCount: number;
  percentage: number;
};

const CollectionContext = createContext<CollectionContextValue | null>(null);

function isEstado(value: unknown): value is Estado {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstadoState] = useState<Estado>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Mirrors `estado` synchronously (unlike React state, which only
  // becomes visible on the next render). Without it, two toggle() calls
  // fired back to back -- before a re-render happens -- would both read
  // the same stale `estado` from their closures and the second write
  // would silently clobber the first instead of compounding.
  const estadoRef = useRef<Estado>({});

  const setEstado = useCallback((next: Estado) => {
    estadoRef.current = next;
    setEstadoState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (isEstado(parsed)) setEstado(parsed);
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('No se pudo cargar tu colección guardada. Se muestra vacía.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setEstado]);

  // Optimistic: the UI flips instantly, then persists. On failure it
  // rolls back to the pre-toggle state and surfaces a non-blocking
  // notice -- the user should never believe something saved that didn't
  // (see docs/designs/coleccion-bip.md, Recommended Approach).
  const toggle = useCallback(
    async (id: string) => {
      const previous = estadoRef.current;
      const next = { ...previous, [id]: !previous[id] };
      setEstado(next);

      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setNotice(null);
      } catch {
        setEstado(previous);
        setNotice('No se pudo guardar el cambio. Intenta de nuevo.');
      }
    },
    [setEstado]
  );

  const total = catalogo.length;
  const tengoCount = useMemo(() => Object.values(estado).filter(Boolean).length, [estado]);
  const percentage = total === 0 ? 0 : Math.round((tengoCount / total) * 100);
  const has = useCallback((id: string) => Boolean(estado[id]), [estado]);

  const value = useMemo<CollectionContextValue>(
    () => ({ loading, notice, has, toggle, total, tengoCount, percentage }),
    [loading, notice, has, toggle, total, tengoCount, percentage]
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error('useCollection debe usarse dentro de un CollectionProvider');
  }
  return ctx;
}
