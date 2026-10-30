# quoted-printable-utils

Encodes and decodes quoted-printable format as specified in RFC 2045, suitable for MIME email content.

```js
import { encode, decode } from 'quoted-printable-utils';

encode('café résumé');   // "caf=C3=A9 r=C3=A9sum=C3=A9"
decode('caf=C3=A9');     // "café"
```

## Why

Email transports are required to handle 7-bit ASCII, which means anything
outside that range — accented letters, emoji, raw bytes — must be escaped.
Quoted-printable keeps mostly-readable text mostly-readable: printable ASCII
passes through unchanged and only the non-ASCII bytes become `=XX` hex
escapes. This library exists to give you that codec in a single ESM file with
zero dependencies.

The trade-off: this library operates on JavaScript strings, which are UTF-16
internally. Internally it UTF-8-encodes the input before applying
quoted-printable rules, so multi-byte characters produce one `=XX` per byte,
matching what RFC 2045 expects. Decoding reverses this by UTF-8-decoding the
reassembled byte stream.

## Edge cases

- The `=` sign is **always** encoded as `=3D`, even mid-line, because a bare
  `=` would be mistaken for the start of an escape sequence.
- Space and tab at the **end of a line** are encoded (`=20` / `=09`) because
  some mail servers silently strip trailing whitespace, which would corrupt
  the content. Space and tab in the middle of a line are left literal.
- Soft line breaks (`=\r\n`) are inserted automatically when a line would
  exceed the 76-character limit RFC 2045 imposes. On decode they are removed.
- `decode` is strict: a `=` not followed by two hex digits or a line
  terminator throws rather than silently dropping or inventing a byte.
  Lowercase hex digits are accepted on input.
