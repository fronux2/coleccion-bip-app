"""Renders extraction.json as a single self-contained HTML report.

Card thumbnails are embedded as base64 data URIs so the whole report is
one file the user can open directly (double-click) without a server or
a separate images folder alongside it -- even though the images are also
written to disk under output/images/ for the next pipeline step.
"""

from __future__ import annotations

import base64
import html
from pathlib import Path

_EXT_TO_MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}


def _data_uri(image_path: Path) -> str:
    ext = image_path.suffix.lstrip(".").lower()
    mime = _EXT_TO_MIME.get(ext, "application/octet-stream")
    data = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def _card_html(card: dict, out_dir: Path, css_class: str) -> str:
    image_path = out_dir / card["image_path"]
    uri = _data_uri(image_path)
    date_label = html.escape(card["date_raw"] or "(sin fecha)")
    nota = f"<div class='nota'>{html.escape(card['nota'])}</div>" if card.get("nota") else ""
    extra = ""
    if card["status"] == "ambiguous":
        candidates = "; ".join(html.escape(c) for c in card["ambiguous_candidates"])
        extra = f"<div class='extra'>candidatos: {candidates}</div>"
    if "duplicate_of" in card:
        extra += f"<div class='extra'>duplicado de: {html.escape(', '.join(card['duplicate_of']))}</div>"
    return f"""
    <div class="card {css_class}">
      <img src="{uri}" loading="lazy" alt="{date_label}">
      <div class="meta">
        <div class="key">{html.escape(card['key'])} (pág {card['page']})</div>
        <div class="date">{date_label}</div>
        {nota}
        {extra}
      </div>
    </div>"""


_CSS = """
body { font-family: -apple-system, Segoe UI, Arial, sans-serif; margin: 0; padding: 24px; background: #f6f7f5; color: #1a1a1a; }
h1 { margin-bottom: 4px; }
.summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0 28px; }
.stat { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 10px 16px; min-width: 100px; }
.stat .n { font-size: 1.4em; font-weight: 700; display: block; }
.warn { background: #fff2cc; border: 1px solid #e0b400; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-weight: 600; }
section { margin-bottom: 40px; }
h2 { border-bottom: 2px solid #ddd; padding-bottom: 6px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.card { background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
.card img { width: 100%; height: 90px; object-fit: cover; display: block; background: #eee; }
.card .meta { padding: 8px; font-size: 12px; }
.card .key { color: #777; }
.card .date { font-weight: 600; margin-top: 2px; }
.card .nota { color: #a15c00; margin-top: 2px; }
.card .extra { color: #b00020; margin-top: 2px; }
.card.ambiguous { border-color: #e0b400; box-shadow: 0 0 0 2px #fff2cc inset; }
.card.no_date { border-color: #b00020; box-shadow: 0 0 0 2px #fde8ea inset; }
.card.duplicate { border-color: #6a3fb0; box-shadow: 0 0 0 2px #f0e8fb inset; }
.card.retired { border-color: #555; box-shadow: 0 0 0 2px #eee inset; }
.empty { color: #777; font-style: italic; }
"""


def write_html_report(extraction: dict, out_path: Path) -> None:
    out_dir = out_path.parent
    summary = extraction["summary"]
    cards = extraction["cards"]

    matched = [c for c in cards if c["status"] == "matched" and "duplicate_of" not in c]
    retired = [c for c in cards if c["status"] == "retired" and "duplicate_of" not in c]
    ambiguous = [c for c in cards if c["status"] == "ambiguous"]
    no_date = [c for c in cards if c["status"] == "no_date"]
    duplicates = [c for c in cards if "duplicate_of" in c]

    matched.sort(key=lambda c: (c["page"], c["date_iso"] or ""))

    warn_html = ""
    if summary["warn_threshold_exceeded"]:
        warn_html = (
            "<div class='warn'>"
            f"{summary['ambiguous'] + summary['no_date']} tarjetas quedaron marcadas "
            f"ambiguous/no_date, por sobre el umbral de {summary['ambiguous_threshold']} "
            "(~7% del total). Revisar la tolerancia de matching antes de aprobar el "
            "catálogo a ciegas."
            "</div>"
        )

    stats = "".join(
        f"<div class='stat'><span class='n'>{v}</span>{html.escape(k)}</div>"
        for k, v in [
            ("candidatas totales", summary["total_candidates"]),
            ("emparejadas", summary["matched"]),
            ("retiradas (sin fecha)", summary["retired"]),
            ("ambiguas", summary["ambiguous"]),
            ("sin fecha", summary["no_date"]),
            ("duplicadas", summary["duplicates"]),
            ("descartadas (no parecen tarjeta)", summary["excluded_decorative"]),
            ("fechas sin imagen", summary["orphan_dates"]),
        ]
    )

    def section(title: str, items: list[dict], css_class: str) -> str:
        if not items:
            body = "<p class='empty'>Ninguna.</p>"
        else:
            body = f"<div class='grid'>{''.join(_card_html(c, out_dir, css_class) for c in items)}</div>"
        return f"<section><h2>{html.escape(title)} ({len(items)})</h2>{body}</section>"

    orphan_html = ""
    if extraction["orphan_dates"]:
        rows = "".join(
            f"<li>pág {o['page']}: {html.escape(o['text'])}</li>" for o in extraction["orphan_dates"]
        )
        orphan_html = (
            "<section><h2>Fechas sin imagen asociada "
            f"({len(extraction['orphan_dates'])})</h2><ul>{rows}</ul></section>"
        )

    excluded_html = ""
    if extraction["excluded_decorative"]:
        rows = "".join(
            f"<li>pág {e['page']}: {html.escape(e['key'])}</li>"
            for e in extraction["excluded_decorative"]
        )
        excluded_html = (
            "<details><summary>Imágenes descartadas por tamaño "
            f"(no parecen tarjeta) — {len(extraction['excluded_decorative'])}</summary>"
            f"<ul>{rows}</ul></details>"
        )

    doc = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte de extracción — Colección BIP</title>
<style>{_CSS}</style>
</head>
<body>
<h1>Reporte de extracción — Colección BIP</h1>
<p>Fuente: {html.escape(extraction['source_pdf'])} ({extraction['page_count']} páginas)</p>
{warn_html}
<div class="summary">{stats}</div>
{section("Ambiguas — requieren decisión", ambiguous, "ambiguous")}
{section("Sin fecha asociada (posible decorativo, no tarjeta)", no_date, "no_date")}
{section("Retiradas — el PDF las marca sin fecha de emisión", retired, "retired")}
{section("Duplicados exactos de imagen", duplicates, "duplicate")}
{section("Emparejadas correctamente", matched, "")}
{orphan_html}
{excluded_html}
</body>
</html>"""

    out_path.write_text(doc, encoding="utf-8")
