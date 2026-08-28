import { paginateCollage } from '@/lib/collage';

describe('paginateCollage', () => {
  it('returns no pages for an empty list', () => {
    expect(paginateCollage([])).toEqual([]);
  });

  it('keeps everything on one page when it fits the target rows', () => {
    const cards = Array.from({ length: 30 }, (_, i) => i);
    expect(paginateCollage(cards, 6, 7)).toEqual([cards]);
  });

  it('splits into evenly-sized pages instead of leaving a tiny remainder', () => {
    const cards = Array.from({ length: 173 }, (_, i) => i);
    const pages = paginateCollage(cards, 6, 7);

    const sizes = pages.map((page) => page.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(173);
  });

  it('never produces more pages than needed', () => {
    const cards = Array.from({ length: 84 }, (_, i) => i);
    expect(paginateCollage(cards, 6, 7).length).toBe(2);
  });
});
