"""Builds the final catalogo.json + compressed card images from a
reviewed extraction (see extract.py, Next Steps #3 in the design doc).

Usage:
    python build_catalog.py [--extraction output/extraction.json] [--assets-dir ../../assets/catalogo]

Run this only after approving output/report.html. Assigns each card a
permanent id (its position in reading order: page, then top-to-bottom,
left-to-right) -- ids are not reassigned on a future re-run, since this
is meant to be a one-time extraction (see design doc, Open Question 2).

Includes cards with status "matched" or "retired" ("TARJETA RETIRADA" in
the source PDF -- a real card, just without an issue date; approved by
the user 2026-08-28 to enter the catalog with fecha=null). Skips
"ambiguous", "no_date" (decorative, not a real card) and any card
flagged as an exact-image duplicate -- none of those exist in the
current PDF snapshot, but the skip is intentional if they show up in a
future run.
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
from pathlib import Path

import pymupdf

INCLUDED_STATUSES = {"matched", "retired"}

THUMB_MAX_DIM = 300
THUMB_QUALITY = 78
DETAIL_MAX_DIM = 800
DETAIL_QUALITY = 85

ID_WIDTH = 4


def to_jpeg(image_bytes: bytes, max_dim: int, quality: int) -> bytes:
    """Re-encodes as JPEG, downscaled to fit max_dim on the long edge.

    Never upscales: most card photos embedded in the PDF are natively
    well under 800px (median ~260x180), so "detail" ends up close to
    the original size rather than the ~800px the design doc assumed --
    intentional, upscaling would just bloat the file without adding
    real detail.
    """
    src = pymupdf.Pixmap(image_bytes)
    if src.colorspace is None or src.colorspace.name != "DeviceRGB":
        src = pymupdf.Pixmap(pymupdf.csRGB, src)
    if src.alpha:
        src = pymupdf.Pixmap(src, 0)

    scale = min(1.0, max_dim / max(src.width, src.height))
    if scale < 1.0:
        new_w = max(1, round(src.width * scale))
        new_h = max(1, round(src.height * scale))
        src = pymupdf.Pixmap(src, new_w, new_h)

    return src.tobytes("jpeg", jpg_quality=quality)


def reading_order_key(card: dict) -> tuple:
    x0, y0, _x1, _y1 = card["rect"]
    return (card["page"], round(y0), round(x0))


def build(extraction: dict, extraction_dir: Path, assets_dir: Path) -> dict:
    cards = extraction["cards"]

    eligible = [c for c in cards if c["status"] in INCLUDED_STATUSES and "duplicate_of" not in c]
    skipped_duplicate = [c for c in cards if "duplicate_of" in c and c["status"] in INCLUDED_STATUSES]
    eligible.sort(key=reading_order_key)

    thumb_dir = assets_dir / "thumb"
    detail_dir = assets_dir / "detail"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    detail_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    thumb_requires = []
    detail_requires = []

    for i, card in enumerate(eligible, start=1):
        card_id = f"{i:0{ID_WIDTH}d}"
        source_path = extraction_dir / card["image_path"]
        raw = source_path.read_bytes()

        thumb_bytes = to_jpeg(raw, THUMB_MAX_DIM, THUMB_QUALITY)
        detail_bytes = to_jpeg(raw, DETAIL_MAX_DIM, DETAIL_QUALITY)

        (thumb_dir / f"{card_id}.jpg").write_bytes(thumb_bytes)
        (detail_dir / f"{card_id}.jpg").write_bytes(detail_bytes)
        thumb_requires.append(card_id)
        detail_requires.append(card_id)

        entries.append(
            {
                "id": card_id,
                "fecha": card["date_iso"],
                "nota": card["nota"],
                "serie": None,
                "rareza": None,
                "nombre": None,
                "imagen": f"{card_id}.jpg",
            }
        )

    catalogo = {
        "schemaVersion": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "cards": entries,
    }

    return {
        "catalogo": catalogo,
        "thumb_ids": thumb_requires,
        "detail_ids": detail_requires,
        "skipped_duplicate": len(skipped_duplicate),
        "skipped_other": len(cards) - len(eligible) - len(skipped_duplicate),
    }


def write_index_ts(thumb_ids: list[str], detail_ids: list[str], assets_dir: Path) -> None:
    lines = [
        "// GENERADO por scripts/ingest-pdf/build_catalog.py -- no editar a mano.",
        "// Metro necesita require() con rutas literales, por eso el mapeo se genera",
        "// en vez de construirse dinámicamente en runtime.",
        "",
        "export const thumbnails: Record<string, number> = {",
    ]
    for card_id in thumb_ids:
        lines.append(f'  "{card_id}": require("./thumb/{card_id}.jpg"),')
    lines.append("};")
    lines.append("")
    lines.append("export const detail: Record<string, number> = {")
    for card_id in detail_ids:
        lines.append(f'  "{card_id}": require("./detail/{card_id}.jpg"),')
    lines.append("};")
    lines.append("")

    (assets_dir / "index.ts").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--extraction", type=Path, default=Path("output/extraction.json"),
        help="Path to extraction.json produced by extract.py",
    )
    parser.add_argument(
        "--assets-dir", type=Path, default=Path("../../assets/catalogo"),
        help="Where to write catalogo.json, thumb/, detail/ and index.ts",
    )
    args = parser.parse_args()

    if not args.extraction.exists():
        print(f"No existe {args.extraction} -- corré extract.py primero.", file=sys.stderr)
        return 1

    extraction = json.loads(args.extraction.read_text(encoding="utf-8"))
    extraction_dir = args.extraction.parent

    result = build(extraction, extraction_dir, args.assets_dir)

    (args.assets_dir / "catalogo.json").write_text(
        json.dumps(result["catalogo"], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_index_ts(result["thumb_ids"], result["detail_ids"], args.assets_dir)

    total_bytes = sum(f.stat().st_size for f in args.assets_dir.rglob("*.jpg"))

    print(f"Tarjetas en catalogo.json: {len(result['catalogo']['cards'])}")
    print(f"Omitidas (duplicado exacto): {result['skipped_duplicate']}")
    print(f"Omitidas (ambiguous/no_date): {result['skipped_other']}")
    print(f"Peso total de imágenes (thumb+detail): {total_bytes / 1_000_000:.1f} MB")
    print(f"Escrito en: {args.assets_dir}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
