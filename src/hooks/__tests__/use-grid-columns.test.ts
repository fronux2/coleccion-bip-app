import { computeGridColumns } from '@/hooks/use-grid-columns';

describe('computeGridColumns', () => {
  it('stays at 3 columns on mobile widths', () => {
    expect(computeGridColumns(320)).toBe(3);
    expect(computeGridColumns(375)).toBe(3);
    expect(computeGridColumns(599)).toBe(3);
  });

  it('adds columns on tablet-width viewports', () => {
    expect(computeGridColumns(600)).toBe(4);
    expect(computeGridColumns(768)).toBe(5);
  });

  it('caps columns on very wide desktop viewports', () => {
    expect(computeGridColumns(1000)).toBe(6);
    expect(computeGridColumns(1400)).toBe(6);
    expect(computeGridColumns(2560)).toBe(6);
  });
});
