import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../src/index.js';

test('round-trips plain ASCII', () => {
  const s = 'Hello, World!';
  assert.equal(decode(encode(s)), s);
});

test('encodes the equals sign', () => {
  assert.equal(encode('a=b'), 'a=3Db');
});

test('decodes the equals sign', () => {
  assert.equal(decode('a=3Db'), 'a=b');
});

test('encodes high bytes as =XX', () => {
  // é in UTF-8 is C3 A9
  assert.equal(encode('é'), '=C3=A9');
});

test('decodes high bytes from =XX', () => {
  assert.equal(decode('=C3=A9'), 'é');
});

test('accepts lowercase hex on decode', () => {
  assert.equal(decode('=c3=a9'), 'é');
});

test('soft line breaks are removed on decode', () => {
  const encoded = 'Now is the time for all good folks to rest their weary =\r\nheads.';
  const expected = 'Now is the time for all good folks to rest their weary heads.';
  assert.equal(decode(encoded), expected);
});

test('soft break with bare LF also removed', () => {
  assert.equal(decode('line one =\ncontinued'), 'line one continued');
});

test('trailing space is encoded as =20', () => {
  const input = 'trailing space \n';
  const encoded = encode(input);
  assert.ok(encoded.includes('=20'), `expected =20 in "${encoded}"`);
  assert.equal(decode(encoded), input);
});

test('trailing tab is encoded as =09', () => {
  const input = 'trailing tab\t\n';
  const encoded = encode(input);
  assert.ok(encoded.includes('=09'), `expected =09 in "${encoded}"`);
  assert.equal(decode(encoded), input);
});

test('no output line exceeds 76 characters', () => {
  const encoded = encode('x'.repeat(200));
  for (const line of encoded.split('\r\n')) {
    assert.ok(line.length <= 76, `line too long (${line.length}): "${line}"`);
  }
});

test('round-trips multiline text', () => {
  const s = 'Line one\nLine two\nLine three';
  assert.equal(decode(encode(s)), s);
});

test('throws on malformed escape =G1', () => {
  assert.throws(() => decode('=G1'), /Invalid quoted-printable escape/);
});

test('throws on a dangling equals at end of input', () => {
  assert.throws(() => decode('abc='), /Invalid quoted-printable escape/);
});

test('CRLF in input is preserved through round-trip', () => {
  const s = 'first\r\nsecond';
  assert.equal(decode(encode(s)), s);
});

test('long line with soft breaks round-trips exactly', () => {
  const s = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
  assert.equal(decode(encode(s)), s);
});

test('does not encode space mid-line', () => {
  assert.equal(encode('a b'), 'a b');
});
