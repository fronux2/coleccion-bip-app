// Relative, not the `@/assets/*` alias: jest-expo's generated
// moduleNameMapper lists the broader `@/(.*)$` -> src/$1 rule before the
// more specific `@/assets/(.*)$` one, so under Jest the alias resolves
// into src/assets (which doesn't exist) instead of the repo-root assets/.
import catalogoData from '../../assets/catalogo/catalogo.json';
import { detail, thumbnails } from '../../assets/catalogo/index';

export type CatalogCard = {
  id: string;
  fecha: string | null;
  nota: string | null;
  serie: string | null;
  rareza: string | null;
  nombre: string | null;
  imagen: string;
};

export const catalogo: CatalogCard[] = catalogoData.cards;

const byId = new Map(catalogo.map((card) => [card.id, card]));

export function getCard(id: string | undefined): CatalogCard | undefined {
  return id ? byId.get(id) : undefined;
}

export function getThumbnail(id: string) {
  return thumbnails[id];
}

export function getDetailImage(id: string) {
  return detail[id];
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function formatFecha(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} de ${MESES[month - 1]} de ${year}`;
}
