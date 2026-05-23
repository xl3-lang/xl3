import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion, versionsEqual } from '../version.js';

describe('parseVersion', () => {
  it('parses MAJOR.MINOR', () => {
    expect(parseVersion('0.1')).toEqual([0, 1, 0]);
    expect(parseVersion('1.0')).toEqual([1, 0, 0]);
  });

  it('parses MAJOR.MINOR.PATCH', () => {
    expect(parseVersion('0.8.0')).toEqual([0, 8, 0]);
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  it('handles surrounding whitespace', () => {
    expect(parseVersion('  0.8.0  ')).toEqual([0, 8, 0]);
  });

  it('returns null for non-numeric or malformed input', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('0')).toBeNull();
    expect(parseVersion('0.1.0.0')).toBeNull();
    expect(parseVersion('0.1-pre')).toBeNull();
    expect(parseVersion('v0.1')).toBeNull();
    expect(parseVersion('latest')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders by major', () => {
    expect(compareVersions([1, 0, 0], [0, 9, 0])).toBeGreaterThan(0);
  });

  it('orders by minor when major equal', () => {
    expect(compareVersions([0, 10, 0], [0, 9, 0])).toBeGreaterThan(0);
    expect(compareVersions([0, 2, 0], [0, 10, 0])).toBeLessThan(0);
  });

  it('orders by patch when major.minor equal', () => {
    expect(compareVersions([0, 1, 5], [0, 1, 3])).toBeGreaterThan(0);
  });

  it('returns 0 for equal triples', () => {
    expect(compareVersions([0, 1, 0], [0, 1, 0])).toBe(0);
  });
});

describe('versionsEqual', () => {
  it('treats "0.1" and "0.1.0" as equal (the actual normalization win)', () => {
    expect(versionsEqual('0.1', '0.1.0')).toBe(true);
    expect(versionsEqual('0.1.0', '0.1')).toBe(true);
  });

  it('does not confuse "0.10" with "0.1" (lexical-sort trap)', () => {
    expect(versionsEqual('0.10', '0.1')).toBe(false);
    expect(versionsEqual('0.10.0', '0.1.0')).toBe(false);
  });

  it('correctly distinguishes adjacent versions', () => {
    expect(versionsEqual('0.8', '0.9')).toBe(false);
    expect(versionsEqual('0.8.0', '0.8.1')).toBe(false);
  });

  it('falls back to string equality when either side is malformed', () => {
    // Both malformed but identical → equal
    expect(versionsEqual('latest', 'latest')).toBe(true);
    // Malformed, not identical → not equal (no silent match)
    expect(versionsEqual('latest', '0.1')).toBe(false);
    expect(versionsEqual('0.1', 'latest')).toBe(false);
  });
});
