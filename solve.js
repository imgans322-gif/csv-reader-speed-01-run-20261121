// A fast drop-in replacement for csv-reader 1.0.0.
//
// It returns exactly csv-reader's answer for every input — {columns, rows,
// errors} under the same broken-row policy — but reads the text in slices
// instead of character by character: each field is located with indexOf
// jumps between the few characters that can end it (comma, LF, CR, quote),
// and the pieces are joined once. The slow paths (stray CRs, quote junk,
// unterminated quotes) fall back to the same segment machinery, so the
// observable behaviour — values, error codes, line and row numbers, and
// their order — is unchanged.

const COMMA = 1;
const LINE_BREAK = 2;
const END = 3;
const CR_HIT = 4; // the nearest delimiter found was a CR (stray or part of CRLF)

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const N = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on, and its index in rows
  // (null while it is the header).
  let recordLine = 1;
  let recordRow = null;

  // The next CR at or after the last place one was looked for. CRs can be
  // thousands of characters apart, so rescanning for one at every field
  // would dwarf the parse itself; pos only moves forward (the one rewind,
  // for an unterminated quote, resets the cache), so one cached position
  // serves the whole read. -2 means "not looked yet", -1 "none left".
  let crCache = -2;
  function peekCR(from) {
    if (crCache < from) crCache = text.indexOf("\r", from);
    return crCache;
  }

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Count the LFs in text[a..b): each one moves the line counter.
  function countNL(a, b) {
    let n = 0;
    let i = text.indexOf("\n", a);
    while (i !== -1 && i < b) {
      n += 1;
      i = text.indexOf("\n", i + 1);
    }
    return n;
  }

  // Read unquoted characters onto `value` up to the next comma or line
  // break. A CR not followed by LF is dropped (stray_cr). Returns the
  // field, how it ended, and how many characters were kept.
  function readUnquoted(value) {
    let added = 0;
    let segs = null;
    let segStart = pos;
    const keep = (upto) => {
      if (upto > segStart) {
        if (segs === null) segs = [];
        segs.push(text.slice(segStart, upto));
        added += upto - segStart;
      }
    };
    const finish = (ended) => ({
      value: segs === null ? value : value + segs.join(""),
      ended,
      added,
    });
    while (pos < N) {
      const nc = text.indexOf(",", pos);
      const nn = text.indexOf("\n", pos);
      const nr = peekCR(pos);
      let j = N;
      let kind = END;
      if (nc !== -1 && nc < j) { j = nc; kind = COMMA; }
      if (nn !== -1 && nn < j) { j = nn; kind = LINE_BREAK; }
      if (nr !== -1 && nr < j) { j = nr; kind = CR_HIT; }
      if (kind === COMMA) {
        keep(j);
        pos = j + 1;
        return finish(COMMA);
      }
      if (kind === LINE_BREAK) {
        keep(j);
        pos = j + 1;
        line += 1;
        return finish(LINE_BREAK);
      }
      if (kind === CR_HIT) {
        if (text[j + 1] === "\n") {
          keep(j);
          pos = j + 2;
          line += 1;
          return finish(LINE_BREAK);
        }
        // A stray CR: close the current segment, drop it, read on.
        keep(j);
        error("stray_cr");
        pos = j + 1;
        segStart = pos;
        continue;
      }
      // No delimiter left: the rest of the text is the field.
      keep(N);
      pos = N;
      return finish(END);
    }
    return finish(END);
  }

  // Read a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let p = pos + 1;
    let segs = null;
    let segStart = p;
    let closedAt = -1;
    const pushSeg = (upto) => {
      if (segs === null) segs = [];
      segs.push(text.slice(segStart, upto));
      line += countNL(segStart, upto);
    };
    while (p < N) {
      const q = text.indexOf('"', p);
      const r = peekCR(p);
      if (q === -1 && r === -1) { p = N; break; }
      if (r !== -1 && (q === -1 || r < q)) {
        // CRLF and a lone CR inside quotes are each read as one LF.
        pushSeg(r);
        segs.push("\n");
        line += 1;
        p = text[r + 1] === "\n" ? r + 2 : r + 1;
        segStart = p;
        continue;
      }
      if (text[q + 1] === '"') {
        // A doubled quote is one literal quote.
        pushSeg(q);
        segs.push('"');
        p = q + 2;
        segStart = p;
        continue;
      }
      closedAt = q;
      break;
    }
    if (closedAt === -1) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as an unquoted field.
      pos = open + 1;
      line = openLine;
      crCache = -2; // the one rewind: the CR cache no longer holds
      error("unterminated_quote");
      return readUnquoted('"');
    }
    let value;
    if (segs === null) {
      value = text.slice(open + 1, closedAt);
      line += countNL(open + 1, closedAt);
    } else {
      pushSeg(closedAt);
      value = segs.join("");
    }
    pos = closedAt + 1;
    if (pos >= N) return { value, ended: END };
    const c = text[pos];
    if (c === ",") {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === "\n") {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === "\r" && text[pos + 1] === "\n") {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break (quote_junk, when anything was appended).
    const junk = readUnquoted(value);
    if (junk.added > 0) error("quote_junk");
    return junk;
  }

  while (true) {
    // Lines left with no characters are no records.
    while (pos < N) {
      if (text[pos] === "\n") {
        pos += 1;
        line += 1;
      } else if (text[pos] === "\r" && text[pos + 1] === "\n") {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= N) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text[pos] === '"';
      field = quoted ? readQuoted() : readUnquoted("");
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no
    // record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === "" && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: "short_row", line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push("");
    } else if (fields.length > width) {
      errors.push({ code: "long_row", line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
