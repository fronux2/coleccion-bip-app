"""Pure geometry/text logic for the PDF ingest pipeline.

No PyMuPDF import here on purpose: this module only deals with plain
dataclasses (bounding boxes + strings) so the matching logic — the part
that would silently corrupt the catalog if it had a bug — can be unit
tested without opening a PDF at all. `extract.py` is the thin layer that
feeds real PyMuPDF output into these functions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

MESES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

# "04-03-14" or "04/03/2014" as a single token.
_DATE_TOKEN_RE = re.compile(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$")
_DAY_RE = re.compile(r"^\d{1,2}$")
_YEAR_RE = re.compile(r"^\d{4}$")

# Two words belong to the same run when the horizontal gap between them
# is under this many PDF points. Measured on the real PDF: words inside
# one date ("15" -> "septiembre") sit ~1-2pt apart; the blank space
# between two side-by-side date cells in the grid is ~50pt+. 12pt keeps
# a wide safety margin on both sides.
DEFAULT_X_GAP = 12.0

# A date run is "below" an image when its top edge is within this many
# points of the image's bottom edge (dates sit directly under their
# card's photo, with a few points of padding).
DEFAULT_MAX_V_GAP = 20.0

# Text baselines occasionally sit a couple of points *above* the image's
# reported bottom edge (font metrics vs. the tight image bbox don't line
# up exactly) -- seen on the real PDF as ~1-2pt of overlap. Allow a small
# negative gap instead of requiring the date to start strictly below.
DEFAULT_MIN_V_GAP = -5.0

# How far a date run's horizontal center may drift from the image's
# horizontal center and still count as "same column".
DEFAULT_X_CENTER_TOLERANCE = 20.0


@dataclass(frozen=True)
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass(frozen=True)
class TextRun:
    x0: float
    y0: float
    x1: float
    y1: float
    words: tuple[Word, ...]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)

    @property
    def x_center(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass(frozen=True)
class ImageBox:
    key: str
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def x_center(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0


@dataclass(frozen=True)
class ParsedDate:
    raw: str
    day: int
    month: int
    year: int
    nota: str | None = None

    @property
    def iso(self) -> str:
        return f"{self.year:04d}-{self.month:02d}-{self.day:02d}"


@dataclass
class MatchResult:
    image: ImageBox
    status: str  # "matched" | "retired" | "no_date" | "ambiguous"
    date_run: TextRun | None = None
    parsed: ParsedDate | None = None
    annotation: str | None = None  # e.g. "TARJETA RETIRADA", when status == "retired"
    candidates: list[TextRun] = field(default_factory=list)


# Cards the PDF marks as withdrawn from circulation print this instead
# of a date, in the exact same grid position a date would occupy. It's
# a real, deliberate annotation from the source -- not a matching
# failure -- so it gets its own status rather than falling into
# "no_date" alongside actually decorative (non-card) images.
_RETIRED_TEXT = "tarjeta retirada"


def is_retired_annotation(run: TextRun) -> bool:
    return run.text.strip().lower() == _RETIRED_TEXT


def _y_overlaps(a: Word, b: Word) -> bool:
    top = max(a.y0, b.y0)
    bottom = min(a.y1, b.y1)
    overlap = bottom - top
    min_height = min(a.y1 - a.y0, b.y1 - b.y0)
    if min_height <= 0:
        return False
    return overlap / min_height > 0.5


def group_words_into_runs(words: list[Word], x_gap: float = DEFAULT_X_GAP) -> list[TextRun]:
    """Groups words into left-to-right runs on the same visual line.

    Splits on a large horizontal gap even when two runs share a y-band,
    which is what separates side-by-side date cells in the grid (e.g. 4
    dates printed at the same height, one per column) from a single
    continuous line of text.
    """
    if not words:
        return []

    ordered = sorted(words, key=lambda w: (round(w.y0), w.x0))
    runs: list[TextRun] = []
    current = [ordered[0]]

    for prev, word in zip(ordered, ordered[1:]):
        same_line = _y_overlaps(prev, word)
        close_enough = (word.x0 - prev.x1) <= x_gap
        if same_line and close_enough:
            current.append(word)
        else:
            runs.append(_make_run(current))
            current = [word]
    runs.append(_make_run(current))
    return runs


def _make_run(words: list[Word]) -> TextRun:
    ordered = sorted(words, key=lambda w: w.x0)
    return TextRun(
        x0=min(w.x0 for w in ordered),
        y0=min(w.y0 for w in ordered),
        x1=max(w.x1 for w in ordered),
        y1=max(w.y1 for w in ordered),
        words=tuple(ordered),
    )


def parse_date_run(run: TextRun) -> ParsedDate | None:
    """Returns a ParsedDate if `run` starts with a recognizable date,
    with any trailing words (e.g. "SIN VENTA PUBLICA") kept as `nota`.
    Returns None for runs that aren't dates at all (titles, page
    headers, button labels, ...) so callers can ignore them as match
    candidates.
    """
    tokens = [w.text for w in run.words]
    if not tokens:
        return None

    first = tokens[0]
    m = _DATE_TOKEN_RE.match(first)
    if m:
        day, month, year = (int(g) for g in m.groups())
        year = _expand_year(year)
        if not _valid_date(day, month, year):
            return None
        nota = " ".join(tokens[1:]) or None
        return ParsedDate(raw=first, day=day, month=month, year=year, nota=nota)

    if _DAY_RE.match(first) and len(tokens) >= 3:
        month_name = tokens[1].lower()
        year_token = tokens[2]
        if month_name in MESES and _YEAR_RE.match(year_token):
            day = int(first)
            month = MESES[month_name]
            year = int(year_token)
            if not _valid_date(day, month, year):
                return None
            nota = " ".join(tokens[3:]) or None
            raw = f"{first} {tokens[1]} {year_token}"
            return ParsedDate(raw=raw, day=day, month=month, year=year, nota=nota)

    return None


def _expand_year(year: int) -> int:
    if year < 100:
        return 2000 + year
    return year


def _valid_date(day: int, month: int, year: int) -> bool:
    if not (1 <= month <= 12):
        return False
    if not (1 <= day <= 31):
        return False
    if not (2000 <= year <= 2100):
        return False
    return True


def match_images_to_dates(
    images: list[ImageBox],
    date_runs: list[TextRun],
    x_center_tolerance: float = DEFAULT_X_CENTER_TOLERANCE,
    max_v_gap: float = DEFAULT_MAX_V_GAP,
    min_v_gap: float = DEFAULT_MIN_V_GAP,
    ambiguous_delta: float = 3.0,
) -> list[MatchResult]:
    """Matches each image to the date run printed just below it.

    A date run is a candidate for an image when it sits below the image
    (small vertical gap) and roughly in the same column (x-center within
    tolerance). Zero candidates -> "no_date" (often a decorative image,
    e.g. a header logo, not an actual card). Two or more candidates
    within `ambiguous_delta` points of each other's distance -> flagged
    "ambiguous" instead of guessing which one is right.
    """
    parsed_runs = [(run, parse_date_run(run)) for run in date_runs]
    date_candidates = [(run, parsed) for run, parsed in parsed_runs if parsed is not None]
    retired_candidates = [run for run in date_runs if is_retired_annotation(run)]

    def _below(run: TextRun, image: ImageBox) -> bool:
        v_gap = run.y0 - image.y1
        if v_gap < min_v_gap or v_gap > max_v_gap:
            return False
        return abs(run.x_center - image.x_center) <= x_center_tolerance

    results: list[MatchResult] = []
    for image in images:
        scored: list[tuple[float, TextRun, ParsedDate]] = []
        for run, parsed in date_candidates:
            if _below(run, image):
                v_gap = run.y0 - image.y1
                scored.append((v_gap, run, parsed))

        if not scored:
            retired = [run for run in retired_candidates if _below(run, image)]
            if retired:
                results.append(
                    MatchResult(image=image, status="retired", annotation=retired[0].text)
                )
            else:
                results.append(MatchResult(image=image, status="no_date"))
            continue

        scored.sort(key=lambda t: t[0])
        best_gap = scored[0][0]
        tied = [s for s in scored if s[0] - best_gap <= ambiguous_delta]

        if len(tied) > 1:
            results.append(
                MatchResult(
                    image=image,
                    status="ambiguous",
                    candidates=[t[1] for t in tied],
                )
            )
        else:
            _, run, parsed = scored[0]
            results.append(
                MatchResult(image=image, status="matched", date_run=run, parsed=parsed)
            )

    return results


def classify_images(
    images: list[ImageBox],
    size_tolerance_low: float = 0.5,
    size_tolerance_high: float = 2.0,
) -> tuple[list[ImageBox], list[ImageBox]]:
    """Splits images into (card_candidates, decorative) by size.

    Card photos in this PDF are all nearly the same size (one photo per
    grid cell); headers, logos, and button-label graphics are outliers
    (much wider, much smaller, or a very different aspect ratio). Using
    the *median* card size found on the page/doc — instead of a
    hardcoded pixel size — keeps this working if a future version of the
    PDF ships at a different resolution or physical card size.
    """
    if not images:
        return [], []

    widths = sorted(im.width for im in images)
    heights = sorted(im.height for im in images)
    median_w = widths[len(widths) // 2]
    median_h = heights[len(heights) // 2]

    cards, decorative = [], []
    for im in images:
        w_ok = median_w * size_tolerance_low <= im.width <= median_w * size_tolerance_high
        h_ok = median_h * size_tolerance_low <= im.height <= median_h * size_tolerance_high
        (cards if (w_ok and h_ok) else decorative).append(im)
    return cards, decorative
