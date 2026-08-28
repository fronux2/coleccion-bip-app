import { useWindowDimensions } from 'react-native';

import { MaxGridWidth } from '@/constants/theme';

// Mobile ya quedó fijo en 3 columnas (decisión de /plan-design-review,
// ver docs/designs/coleccion-bip.md). Por encima de este ancho (tablet/web)
// se agregan columnas para que la grilla no quede dispersa.
const MOBILE_BREAKPOINT = 600;
const MIN_TILE_WIDTH = 130;
const MIN_WIDE_COLUMNS = 4;
const MAX_COLUMNS = 6;

// Lógica pura, separada del hook para poder testearla sin mockear
// react-native (ver src/hooks/__tests__/use-grid-columns.test.ts).
export function computeGridColumns(width: number): number {
  if (width < MOBILE_BREAKPOINT) return 3;

  const usableWidth = Math.min(width, MaxGridWidth);
  const fitted = Math.floor(usableWidth / MIN_TILE_WIDTH);
  return Math.min(MAX_COLUMNS, Math.max(MIN_WIDE_COLUMNS, fitted));
}

export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  return computeGridColumns(width);
}
