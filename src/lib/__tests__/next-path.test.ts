import { safeNextPath } from '@/lib/next-path';

describe('safeNextPath', () => {
  it('keeps in-app absolute paths', () => {
    expect(safeNextPath('/routines/abc')).toBe('/routines/abc');
    expect(safeNextPath('/history/1?tab=notes')).toBe('/history/1?tab=notes');
  });

  it('falls back when there is nothing to return to', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it('refuses anything that could leave the app', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('/redirect?to=https://evil.com')).toBe('/');
    expect(safeNextPath('guitarcoachfe://routines')).toBe('/');
    expect(safeNextPath('routines/abc')).toBe('/');
  });
});
