# TODOS

## Colección BIP

### Elegir herramienta de testing E2E

**What:** Decidir entre Detox, Maestro o Playwright (para la parte web) y configurarlo.

**Why:** Dos flujos críticos del diseño solo se prueban de punta a punta con E2E — mockear el `CollectionProvider` no probaría el bug real que ese componente existe para prevenir (estado obsoleto entre pantallas).

**Context:** Proyecto Expo SDK 57 nuevo (RN 0.86), sin infra de test todavía. Los 2 flujos son: (1) marcar "La tengo" en Ficha se refleja al instante en Progreso sin re-navegar (prueba el `CollectionProvider` compartido — ver `docs/designs/coleccion-bip.md`, decisión de /plan-eng-review 2026-08-27), y (2) el pipeline de ingesta del PDF completo (extracción → reporte → catálogo). Decidirlo junto con el setup de Jest, no después de tener código real que probar.

**Effort:** S
**Priority:** P2
**Depends on:** Jest + jest-expo instalado (Next Step 1 del diseño)

### Definir columnas de grilla responsivas para web

**What:** Elegir el número de columnas del Catálogo para viewports anchos (web/tablet) — mobile ya quedó en 3 columnas.

**Why:** Sin esto, la versión web hereda 3 columnas de mobile y se ve dispersa en una pantalla ancha.

**Context:** Decidido en /plan-design-review (2026-08-28) junto con el aspect ratio 1.6 y las 3 columnas de mobile. Expo ya compila a web sin costo extra (ver Distribution Plan en `docs/designs/coleccion-bip.md`) — esto se resuelve cuando toque validar la versión web, no antes.

**Effort:** XS
**Priority:** P3
**Depends on:** Pantallas Catálogo/Ficha implementadas en mobile primero
