"""Unit tests for matching.py — the geometric/text logic that decides
which date belongs to which card image. Run with:

    python -m unittest scripts.ingest_pdf.test_matching -v

(or just `python -m unittest discover` from this directory).
"""

import unittest

from matching import (
    ImageBox,
    Word,
    classify_images,
    group_words_into_runs,
    match_images_to_dates,
    parse_date_run,
)


def word(x0, y0, x1, y1, text):
    return Word(x0=x0, y0=y0, x1=x1, y1=y1, text=text)


class GroupWordsIntoRunsTests(unittest.TestCase):
    def test_splits_four_side_by_side_dates_sharing_a_y_band(self):
        # Mirrors real page-0 data: 4 dates printed at the same height,
        # one per grid column, separated by wide gaps.
        words = [
            word(49.6, 183.8, 57.2, 191.3, "15"),
            word(58.9, 183.8, 94.5, 191.3, "septiembre"),
            word(96.2, 183.8, 111.4, 191.3, "2010"),
            word(166.5, 183.9, 174.2, 191.4, "27"),
            word(175.9, 183.9, 209.6, 191.4, "noviembre"),
            word(211.3, 183.9, 226.5, 191.4, "2013"),
        ]
        runs = group_words_into_runs(words)
        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0].text, "15 septiembre 2010")
        self.assertEqual(runs[1].text, "27 noviembre 2013")

    def test_keeps_annotation_words_in_same_run_as_date_token(self):
        words = [
            word(267.3, 266.9, 294.7, 274.4, "04-03-14"),
            word(296.4, 266.9, 306.9, 274.4, "SIN"),
            word(308.5, 266.9, 329.8, 274.4, "VENTA"),
            word(331.4, 266.9, 358.3, 274.4, "PUBLICA"),
        ]
        runs = group_words_into_runs(words)
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0].text, "04-03-14 SIN VENTA PUBLICA")

    def test_empty_input(self):
        self.assertEqual(group_words_into_runs([]), [])


class ParseDateRunTests(unittest.TestCase):
    def _run(self, *words_):
        from matching import _make_run

        return _make_run(list(words_))

    def test_spanish_month_name_form(self):
        run = self._run(
            word(49.6, 183.8, 57.2, 191.3, "15"),
            word(58.9, 183.8, 94.5, 191.3, "septiembre"),
            word(96.2, 183.8, 111.4, 191.3, "2010"),
        )
        parsed = parse_date_run(run)
        self.assertIsNotNone(parsed)
        self.assertEqual((parsed.day, parsed.month, parsed.year), (15, 9, 2010))
        self.assertEqual(parsed.iso, "2010-09-15")
        self.assertIsNone(parsed.nota)

    def test_numeric_token_with_trailing_annotation(self):
        run = self._run(
            word(267.3, 266.9, 294.7, 274.4, "04-03-14"),
            word(296.4, 266.9, 306.9, 274.4, "SIN"),
            word(308.5, 266.9, 329.8, 274.4, "VENTA"),
            word(331.4, 266.9, 358.3, 274.4, "PUBLICA"),
        )
        parsed = parse_date_run(run)
        self.assertIsNotNone(parsed)
        self.assertEqual((parsed.day, parsed.month, parsed.year), (4, 3, 2014))
        self.assertEqual(parsed.nota, "SIN VENTA PUBLICA")

    def test_two_digit_year_expands_to_2000s(self):
        run = self._run(word(0, 0, 40, 8, "30-08-15"))
        parsed = parse_date_run(run)
        self.assertEqual(parsed.year, 2015)

    def test_rejects_out_of_range_day(self):
        run = self._run(
            word(0, 0, 10, 8, "32"),
            word(11, 0, 40, 8, "marzo"),
            word(41, 0, 60, 8, "2020"),
        )
        self.assertIsNone(parse_date_run(run))

    def test_rejects_unknown_month_name(self):
        run = self._run(
            word(0, 0, 10, 8, "15"),
            word(11, 0, 40, 8, "rareza"),
            word(41, 0, 60, 8, "2020"),
        )
        self.assertIsNone(parse_date_run(run))

    def test_non_date_text_returns_none(self):
        run = self._run(
            word(0, 0, 20, 8, "SIN"),
            word(21, 0, 50, 8, "VENTA"),
        )
        self.assertIsNone(parse_date_run(run))

    def test_empty_run_returns_none(self):
        from matching import TextRun

        empty = TextRun(x0=0, y0=0, x1=0, y1=0, words=())
        self.assertIsNone(parse_date_run(empty))


class MatchImagesToDatesTests(unittest.TestCase):
    def _date_words(self, x0, y0, day, month_name, year):
        # lays out a 3-token date run starting at (x0, y0), single line
        x = x0
        words = []
        for text, w in [(day, 16), (month_name, 60), (year, 30)]:
            words.append(word(x, y0, x + w, y0 + 8, text))
            x += w + 2
        return words

    def test_simple_one_to_one_match(self):
        image = ImageBox(key="img1", x0=20, y0=100, x1=120, y1=150)
        date_words = self._date_words(30, 152, "15", "septiembre", "2010")
        runs = group_words_into_runs(date_words)

        results = match_images_to_dates([image], runs)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].status, "matched")
        self.assertEqual(results[0].parsed.iso, "2010-09-15")

    def test_image_with_no_date_below_is_flagged_no_date(self):
        # e.g. a header/logo image sitting alone with no date under it
        image = ImageBox(key="logo", x0=20, y0=10, x1=400, y1=60)
        other_date_words = self._date_words(30, 300, "15", "septiembre", "2010")
        runs = group_words_into_runs(other_date_words)

        results = match_images_to_dates([image], runs)

        self.assertEqual(results[0].status, "no_date")

    def test_two_equally_close_candidates_are_ambiguous(self):
        image = ImageBox(key="img1", x0=20, y0=100, x1=120, y1=150)
        # Two date runs both plausibly "under" the image, same distance.
        run_a = group_words_into_runs(self._date_words(30, 152, "15", "septiembre", "2010"))
        run_b = group_words_into_runs(self._date_words(30, 153, "16", "septiembre", "2010"))
        runs = run_a + run_b

        results = match_images_to_dates([image], runs)

        self.assertEqual(results[0].status, "ambiguous")
        self.assertEqual(len(results[0].candidates), 2)

    def test_retired_annotation_flagged_distinctly_from_no_date(self):
        image = ImageBox(key="img1", x0=20, y0=100, x1=120, y1=150)
        words = [
            word(30, 152, 60, 160, "TARJETA"),
            word(62, 152, 95, 160, "RETIRADA"),
        ]
        runs = group_words_into_runs(words)

        results = match_images_to_dates([image], runs)

        self.assertEqual(results[0].status, "retired")
        self.assertEqual(results[0].annotation, "TARJETA RETIRADA")
        self.assertIsNone(results[0].parsed)

    def test_independent_columns_do_not_cross_match(self):
        image_a = ImageBox(key="a", x0=20, y0=100, x1=120, y1=150)
        image_b = ImageBox(key="b", x0=200, y0=100, x1=300, y1=150)
        words = self._date_words(30, 152, "15", "septiembre", "2010") + self._date_words(
            210, 152, "20", "diciembre", "2013"
        )
        runs = group_words_into_runs(words)

        results = match_images_to_dates([image_a, image_b], runs)

        by_key = {r.image.key: r for r in results}
        self.assertEqual(by_key["a"].parsed.day, 15)
        self.assertEqual(by_key["b"].parsed.day, 20)


class ClassifyImagesTests(unittest.TestCase):
    def test_splits_outliers_from_uniform_card_grid(self):
        cards = [ImageBox(key=f"c{i}", x0=0, y0=i * 60, x1=105, y1=i * 60 + 54) for i in range(10)]
        banner = ImageBox(key="banner", x0=0, y0=0, x1=474, y1=68)
        icon = ImageBox(key="icon", x0=0, y0=0, x1=16, y1=22)

        found_cards, decorative = classify_images(cards + [banner, icon])

        self.assertEqual(len(found_cards), 10)
        self.assertEqual({im.key for im in decorative}, {"banner", "icon"})

    def test_uniform_set_has_no_decorative(self):
        images = [ImageBox(key=f"c{i}", x0=0, y0=0, x1=100, y1=50) for i in range(5)]
        found_cards, decorative = classify_images(images)
        self.assertEqual(len(found_cards), 5)
        self.assertEqual(decorative, [])

    def test_empty_input(self):
        self.assertEqual(classify_images([]), ([], []))


if __name__ == "__main__":
    unittest.main()
