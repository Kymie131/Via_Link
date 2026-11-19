import { describe, expect, it } from 'vitest';
import { parseAppManifest } from '../src/scanners/steam.js';

const manifest = `"AppState"
{
	"appid"		"400"
	"Universe"		"1"
	"name"		"Portal"
	"StateFlags"		"4"
	"installdir"		"Portal"
	"LastUpdated"		"1700000000"
	"SizeOnDisk"		"123456789"
}
`;

describe('parseAppManifest', () => {
  it('extracts appid, name and installdir', () => {
    expect(parseAppManifest(manifest)).toEqual({
      appId: 400,
      name: 'Portal',
      installDir: 'Portal',
    });
  });

  it('returns null without an AppState section', () => {
    expect(parseAppManifest('"Something" { "appid" "1" }')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    const partial = '"AppState" { "appid" "10" "name" "NoDir" }';
    expect(parseAppManifest(partial)).toBeNull();
  });

  it('returns null when appid is not a number', () => {
    const bad = '"AppState" { "appid" "abc" "name" "X" "installdir" "X" }';
    expect(parseAppManifest(bad)).toBeNull();
  });

  it('returns null when appid carries a numeric prefix or fraction', () => {
    const prefixed = '"AppState" { "appid" "400junk" "name" "X" "installdir" "X" }';
    const fractional = '"AppState" { "appid" "1.5" "name" "X" "installdir" "X" }';
    expect(parseAppManifest(prefixed)).toBeNull();
    expect(parseAppManifest(fractional)).toBeNull();
  });

  it('keeps titles with escapes intact', () => {
    const quoted = '"AppState" { "appid" "7" "name" "Tom \\"Cat\\"" "installdir" "Tom" }';
    expect(parseAppManifest(quoted)?.name).toBe('Tom "Cat"');
  });
});
