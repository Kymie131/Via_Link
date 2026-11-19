import { describe, expect, it } from 'vitest';
import { parseVdf, asObject, asString } from '../src/scanners/vdf.js';

describe('parseVdf', () => {
  it('parses nested objects', () => {
    const result = parseVdf('"root" { "child" { "leaf" "value" } }');
    const root = asObject(result.root);
    expect(root).toBeDefined();
    const child = asObject(root?.child);
    expect(asString(child?.leaf)).toBe('value');
  });

  it('parses flat key values', () => {
    const result = parseVdf('"a" "1"\n"b" "2"');
    expect(asString(result.a)).toBe('1');
    expect(asString(result.b)).toBe('2');
  });

  it('ignores line comments', () => {
    const result = parseVdf('// comment\n"a" "1" // trailing\n');
    expect(asString(result.a)).toBe('1');
  });

  it('decodes escaped quotes and backslashes', () => {
    const result = parseVdf('"path" "D:\\\\Games\\\\Some \\"Game\\""');
    expect(asString(result.path)).toBe('D:\\Games\\Some "Game"');
  });

  it('handles keys without quotes', () => {
    const result = parseVdf('root { child value }');
    expect(asString(asObject(result.root)?.child)).toBe('value');
  });

  it('rejects an unterminated string', () => {
    expect(() => parseVdf('"key" "unterminated')).toThrow();
  });

  it('rejects a missing closing brace', () => {
    expect(() => parseVdf('"root" { "child" "value"')).toThrow();
  });
});
