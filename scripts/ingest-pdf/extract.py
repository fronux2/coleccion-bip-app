"""Extracts card images + dates from the Colección BIP checklist PDF.

Usage:
    python extract.py "<path to PDF>" [--out output]

One-time script (see docs/designs/coleccion-bip.md, Next Steps #3): reads
the PDF, matches each card photo to the date printed under it, and writes:
  - <out>/extraction.json   structured result, consumed later by the
                            catalogo.json build step (Next Steps #4)
  - <out>/images/*.jpg|png  the extracted card photos, one file per card
  - <out>/report.html       visual report for manual review before the
                            extraction is approved (see report.py)

Does NOT touch the "Pendiente/Lo tengo!" widgets: confirmed in an earlier
validation pass that they're stateless pushbuttons in this PDF, not real
checkboxes (see design doc, Approaches Considered).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from dataclasses import asdict
from pathlib import Path

import pymupdf

from matching import ImageBox, Word, classify_images, group_words_into_runs, match_images_to_dates

# More than this many ambiguous cards means something structural is off
# (wrong tolerance, PDF layout changed) rather than a handful of one-off
# print quirks -- see design doc Next Steps #3.
AMBIGUOUS_WARN_RATIO = 0.07


def extract_page_images(page: pymupdf.Page) -> tuple[list[ImageBox], dict[str, tuple[int, int]]]:
    """Returns image boxes placed on the page, plus a key -> (xref, smask_xref) map."""
    boxes = []
    xref_by_key: dict[str, tuple[int, int]] = {}
    for img in page.get_images(full=True):
        xref, smask_xref = img[0], img[1]
        rects = page.get_image_rects(xref)
        if not rects:
            continue
        rect = rects[0]
        key = f"xref{xref}"
        boxes.append(ImageBox(key=key, x0=rect.x0, y0=rect.y0, x1=rect.x1, y1=rect.y1))
        xref_by_key[key] = (xref, smask_xref)
    return boxes, xref_by_key


def extract_page_words(page: pymupdf.Page) -> list[Word]:
    return [
        Word(x0=w[0], y0=w[1], x1=w[2], y1=w[3], text=w[4])
        for w in page.get_text("words")
    ]


def get_card_image_bytes(page: pymupdf.Page, xref: int, box: ImageBox) -> tuple[bytes, str, str]:
    """Returns (bytes, file_extension, source) for one card image.

    Tries the embedded image object first (native resolution, no
    recompression). Falls back to rendering + cropping that region of
    the page if the embedded object turns out to be undecodable (per
    design doc: "fallback de render-and-crop").
    """
    try:
        base = page.parent.extract_image(xref)
        data = base["image"]
        ext = base["ext"]
        pymupdf.Pixmap(data)  # sanity check: raises if truly undecodable
        return data, ext, "embedded"
    except Exception:
        rect = pymupdf.Rect(box.x0, box.y0, box.x1, box.y1)
        pix = page.get_pixmap(clip=rect, dpi=200)
        return pix.tobytes("png"), "png", "rendered"


def process_pdf(pdf_path: Path) -> dict:
    doc = pymupdf.open(pdf_path)
    cards = []
    excluded_decorative = []
    orphan_dates = []

    for page_no, page in enumerate(doc):
        image_boxes, xref_by_key = extract_page_images(page)
        words = extract_page_words(page)

        card_boxes, decorative_boxes = classify_images(image_boxes)
        for box in decorative_boxes:
            excluded_decorative.append({"page": page_no, "key": box.key})

        date_runs = group_words_into_runs(words)
        results = match_images_to_dates(card_boxes, date_runs)

        matched_run_ids = {id(r.date_run) for r in results if r.date_run is not None}
        for run in date_runs:
            if id(run) not in matched_run_ids:
                from matching import parse_date_run

                if parse_date_run(run) is not None:
                    orphan_dates.append({"page": page_no, "text": run.text})

        for result in results:
            xref, _smask = xref_by_key[result.image.key]
            image_bytes, ext, source = get_card_image_bytes(page, xref, result.image)
            image_hash = hashlib.sha256(image_bytes).hexdigest()

            card = {
                "key": f"p{page_no}_{result.image.key}",
                "page": page_no,
                "rect": [result.image.x0, result.image.y0, result.image.x1, result.image.y1],
                "status": result.status,
                "image_ext": ext,
                "image_source": source,
                "image_hash": image_hash,
                "date_raw": result.parsed.raw if result.parsed else None,
                "date_iso": result.parsed.iso if result.parsed else None,
                "nota": (result.parsed.nota if result.parsed else None) or result.annotation,
                "ambiguous_candidates": (
                    [c.text for c in result.candidates] if result.status == "ambiguous" else []
                ),
            }
            cards.append((card, image_bytes))

    return {
        "cards": cards,
        "excluded_decorative": excluded_decorative,
        "orphan_dates": orphan_dates,
        "page_count": len(doc),
    }


def mark_duplicates(cards: list[dict]) -> None:
    by_hash: dict[str, list[dict]] = {}
    for card in cards:
        by_hash.setdefault(card["image_hash"], []).append(card)
    for group in by_hash.values():
        if len(group) > 1:
            for card in group:
                card["duplicate_of"] = [c["key"] for c in group if c is not card]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Path to the checklist PDF")
    parser.add_argument("--out", type=Path, default=Path("output"), help="Output directory")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"No existe el archivo: {args.pdf}", file=sys.stderr)
        return 1

    out_dir = args.out
    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    result = process_pdf(args.pdf)
    cards = []
    for card, image_bytes in result["cards"]:
        image_path = images_dir / f"{card['key']}.{card['image_ext']}"
        image_path.write_bytes(image_bytes)
        card["image_path"] = str(image_path.relative_to(out_dir).as_posix())
        cards.append(card)

    mark_duplicates(cards)

    matched = [c for c in cards if c["status"] == "matched" and "duplicate_of" not in c]
    retired = [c for c in cards if c["status"] == "retired" and "duplicate_of" not in c]
    ambiguous = [c for c in cards if c["status"] == "ambiguous"]
    no_date = [c for c in cards if c["status"] == "no_date"]
    duplicates = [c for c in cards if "duplicate_of" in c]

    total = len(cards)
    # "retired" is a confident read of a real PDF annotation, not a
    # matching failure -- it doesn't count toward the pause threshold.
    flagged = len(ambiguous) + len(no_date)
    threshold = max(15, round(AMBIGUOUS_WARN_RATIO * total)) if total else 0
    warn = flagged > threshold

    extraction = {
        "source_pdf": str(args.pdf),
        "page_count": result["page_count"],
        "cards": cards,
        "excluded_decorative": result["excluded_decorative"],
        "orphan_dates": result["orphan_dates"],
        "summary": {
            "total_candidates": total,
            "matched": len(matched),
            "retired": len(retired),
            "ambiguous": len(ambiguous),
            "no_date": len(no_date),
            "duplicates": len(duplicates),
            "excluded_decorative": len(result["excluded_decorative"]),
            "orphan_dates": len(result["orphan_dates"]),
            "ambiguous_threshold": threshold,
            "warn_threshold_exceeded": warn,
        },
    }

    (out_dir / "extraction.json").write_text(
        json.dumps(extraction, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    import report

    report.write_html_report(extraction, out_dir / "report.html")

    print(f"Tarjetas candidatas: {total}")
    print(f"  matched:     {len(matched)}")
    print(f"  retired:     {len(retired)}")
    print(f"  ambiguous:   {len(ambiguous)}")
    print(f"  no_date:     {len(no_date)}")
    print(f"  duplicados:  {len(duplicates)}")
    print(f"  descartadas (no parecen tarjeta): {len(result['excluded_decorative'])}")
    print(f"Reporte: {out_dir / 'report.html'}")

    if warn:
        print(
            f"\nAVISO: {flagged} tarjetas marcadas ambiguous/no_date, por sobre el umbral "
            f"de {threshold} ({AMBIGUOUS_WARN_RATIO:.0%} de {total}). Revisar la tolerancia "
            "de matching antes de aprobar el catálogo — ver report.html.",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
