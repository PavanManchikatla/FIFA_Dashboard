import { describe, expect, it } from 'vitest';
import { unwrapList } from './unwrap';

describe('unwrapList (wc26ir response shapes)', () => {
  it('passes through a bare array', () => {
    expect(unwrapList([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('unwraps the verified {games|teams|stadiums} wrappers', () => {
    expect(unwrapList({ games: [{ id: '1' }] })).toEqual([{ id: '1' }]);
    expect(unwrapList({ teams: ['a'] })).toEqual(['a']);
    expect(unwrapList({ stadiums: ['s'] })).toEqual(['s']);
  });

  it('unwraps generic {data|results} wrappers', () => {
    expect(unwrapList({ data: [1] })).toEqual([1]);
    expect(unwrapList({ results: [2] })).toEqual([2]);
  });

  it('returns [] for shapes with no list (never throws)', () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList(undefined)).toEqual([]);
    expect(unwrapList({ error: 'nope' })).toEqual([]);
    expect(unwrapList('a string')).toEqual([]);
    expect(unwrapList(42)).toEqual([]);
  });
});
