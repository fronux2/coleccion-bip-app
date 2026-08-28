export const COLLAGE_COLUMNS = 6;
const COLLAGE_TARGET_ROWS = 7;

// Reparte las tarjetas en paginas de tamano parejo (en vez de paginas fijas
// con una ultima pagina casi vacia) para que cada imagen resultante quede
// razonablemente cuadrada.
export function paginateCollage<T>(
  cards: T[],
  columns: number = COLLAGE_COLUMNS,
  targetRows: number = COLLAGE_TARGET_ROWS
): T[][] {
  if (cards.length === 0) return [];

  const targetPageSize = columns * targetRows;
  const numPages = Math.max(1, Math.ceil(cards.length / targetPageSize));
  const baseSize = Math.floor(cards.length / numPages);
  const remainder = cards.length % numPages;

  const pages: T[][] = [];
  let start = 0;
  for (let i = 0; i < numPages; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    pages.push(cards.slice(start, start + size));
    start += size;
  }
  return pages;
}
