# Colección BIP

La Pokedex de las tarjetas Bip de Santiago. Catálogo navegable y trackeable de las tarjetas Bip, extraído del catálogo oficial de Miguel Garrido ("Don Tarjetón") y convertido en una app local-first con Expo.

Ver el diseño completo en [`docs/designs/coleccion-bip.md`](docs/designs/coleccion-bip.md).

## Qué hace

- **Catálogo**: grilla navegable de las 219 tarjetas (imagen + fecha), con búsqueda.
- **Ficha**: detalle de cada tarjeta con toggle "La tengo" / "Pendiente".
- **Mi colección**: solo las tarjetas marcadas como propias.
- **Progreso**: porcentaje global de la colección.

Todo el progreso vive en el dispositivo (AsyncStorage) — sin cuenta, sin servidor, sin base de datos por ahora.

## Empezar

1. Instalar dependencias

   ```bash
   npm install
   ```

2. Levantar la app

   ```bash
   npx expo start
   ```

   Desde ahí puedes abrirla en un development build, emulador Android, simulador iOS, Expo Go, o web (`npm run web`).

## Estructura

- `src/app/` — pantallas (expo-router, file-based routing): `catalogo/`, `mi-coleccion/`, `progreso.tsx`.
- `src/context/collection-context.tsx` — `CollectionProvider`: estado de colección compartido entre pantallas (toggle optimista con rollback).
- `src/components/` — `card-tile.tsx`, `ficha-screen.tsx`, `empty-state.tsx`, etc.
- `assets/catalogo/` — `catalogo.json` (219 tarjetas), imágenes `thumb/`/`detail/`, `index.ts` con el mapeo de `require()`.
- `scripts/ingest-pdf/` — script de extracción (Python + PyMuPDF) que generó el catálogo a partir del PDF original. Es una extracción de una sola vez, no un pipeline que se re-corre en cada build.

## Tests

```bash
npm test
```

Jest + jest-expo + Testing Library. Cubre el matching de ingesta y el `CollectionProvider` (toggle éxito/fallo/rollback, fórmula de progreso).

## Licencia

Todos los derechos reservados — ver [`LICENSE`](LICENSE).
