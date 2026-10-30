/**
 * quoted-printable-utils — RFC 2045 quoted-printable codec.
 */

const UPPER_HEX = '0123456789ABCDEF';

/**
 * Strict hex parser: only uppercase A–F / lowercase a–F / 0–9 are accepted.
 * Rejecting stray characters early prevents silent data corruption when an
 * encoded stream contains a malformed escape sequence (e.g. "=GG" or "=\n").
 */
function parseHex(c1, c2) {
  const a = c1 >= '0' && c1 <= '9' ? c1.charCodeAt(0) - 48
          : c1 >= 'A' && c1 <= 'F' ? c1.charCodeAt(0) - 55
          : c1 >= 'a' && c1 <= 'f' ? c1.charCodeAt(0) - 87
          : -1;
  const b = c2 >= '0' && c2 <= '9' ? c2.charCodeAt(0) - 48
          : c2 >= 'A' && c2 <= 'F' ? c2.charCodeAt(0) - 55
          : c2 >= 'a' && c2 <= 'f' ? c2.charCodeAt(0) - 87
          : -1;
  return (a < 0 || b < 0) ? -1 : (a << 4) | b;
}

/**
 * Encodes a UTF-8 string into quoted-printable form per RFC 2045 §6.7.
 *
 * Design decisions:
 *  - The input is first UTF-8-encoded so multi-byte characters become the
 *    byte sequences RFC 2045 expects (one =XX per byte, not per codepoint).
 *  - Printable ASCII (33–126) is left literal except '=' (always =3D) and
 *    SPACE / TAB, which are encoded when they fall at the end of a line.
 *  - Soft line breaks ("=\r\n") are inserted before a line exceeds 76 chars.
 *    The 76-char limit is the maximum permitted by RFC 2045; we never produce
 *    a physical line longer than that.
 *
 * @param {string} input
 * @returns {string}
 */
export function encode(input) {
  const bytes = new TextEncoder().encode(input);
  const out = [];
  let lineLen = 0;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    let encoded;

    if (byte === 0x3D) {                       // '=' → always =3D
      encoded = '=3D';
    } else if (byte === 0x20) {                // space
      // Peek ahead: if end-of-data or the next byte is LF/CR, encode the space
      // so it is not stripped by a transport that trims trailing whitespace.
      const next = bytes[i + 1];
      encoded = (next === 0x0A || next === 0x0D || next === undefined) ? '=20' : ' ';
    } else if (byte === 0x09) {                // tab
      const next = bytes[i + 1];
      encoded = (next === 0x0A || next === 0x0D || next === undefined) ? '=09' : '\t';
    } else if (byte >= 33 && byte <= 126 && byte !== 0x3D) {
      encoded = String.fromCharCode(byte);
    } else {
      encoded = '=' + UPPER_HEX[(byte >> 4) & 0x0F] + UPPER_HEX[byte & 0x0F];
    }

    // Insert a soft break if this encoded chunk would push the line past 76.
    // 75 is the safe limit because we need room for the trailing '='.
    if (lineLen + encoded.length > 75) {
      out.push('=\r\n');
      lineLen = 0;
    }

    out.push(encoded);
    lineLen += encoded.length;
  }

  return out.join('');
}

/**
 * Decodes a quoted-printable string back to its original UTF-8 text.
 *
 * Handles:
 *  - =XX hex escapes (upper or lower case hex digits)
 *  - soft line breaks: "=" followed by CRLF, LF, or (leniently) bare CR
 *  - strict rejection of malformed escapes so bad data is never silently
 *    turned into a wrong byte
 *
 * @param {string} input
 * @returns {string}
 * @throws {Error} if a "=" is followed by anything that is not a valid hex
 *   pair or a recognized line terminator.
 */
export function decode(input) {
  const out = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch !== '=') {
      out.push(ch.charCodeAt(0));
      i++;
      continue;
    }

    // ch === '='
    const next = input[i + 1];

    if (next === '\r') {
      if (input[i + 2] === '\n') i += 3; else i += 2;   // CRLF or bare CR
      continue;
    }
    if (next === '\n') {
      i += 2;
      continue;
    }

    const c1 = input[i + 1];
    const c2 = input[i + 2];
    const byte = parseHex(c1, c2);
    if (byte < 0) {
      throw new Error(`Invalid quoted-printable escape "=${c1 ?? ''}${c2 ?? ''}" at position ${i}`);
    }
    out.push(byte);
    i += 3;
  }

  return new TextDecoder().decode(Uint8Array.from(out));
}
