// ─── AST Types ──────────────────────────────────────────────────────

export type EvalNode =
  | { type: "series_ref"; name: string; nullable: boolean }
  | { type: "scalar"; value: number }
  | {
      type: "instance_method";
      target: EvalNode;
      method: string;
      args: EvalArg[];
    }
  | { type: "static_method"; method: string; args: EvalArg[] }
  | {
      type: "arithmetic";
      op: "+" | "-" | "*" | "/" | "**";
      left: EvalNode;
      right: EvalNode;
    };

export type EvalArg =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "symbol"; value: string }
  | { type: "series_ref"; name: string; nullable: boolean }
  | { type: "options"; value: Record<string, string | number | boolean> };

// ─── Token Types ────────────────────────────────────────────────────

type TokenType =
  | "QUOTED_STRING"
  | "DOT_TS"
  | "DOT_TSN"
  | "DOT_IDENT"
  | "SERIES_CLASS"
  | "LPAREN"
  | "RPAREN"
  | "OP"
  | "NUMBER"
  | "SYMBOL"
  | "STRING_ARG"
  | "HASH"
  | "HASH_KEY"
  | "COMMA";

interface Token {
  type: TokenType;
  value: string;
}

// ─── Tokenizer ──────────────────────────────────────────────────────

/** Series name pattern: PREFIX@GEO.FREQ */
const SERIES_NAME_PATTERN = /^[%$\w]+(?:&[0-9Q]+[FH]\d+)?@\w+\.\w$/;

function isSeriesName(s: string): boolean {
  return SERIES_NAME_PATTERN.test(s);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  function peek(n = 1): string {
    return input.slice(i, i + n);
  }

  function advance(n = 1): void {
    i += n;
  }

  function skipWhitespace(): void {
    while (i < input.length && /\s/.test(input[i])) advance();
  }

  while (i < input.length) {
    skipWhitespace();
    if (i >= input.length) break;

    const ch = input[i];

    // Check for "Series." prefix (static class call)
    if (input.slice(i).startsWith("Series.")) {
      tokens.push({ type: "SERIES_CLASS", value: "Series" });
      advance(7); // skip "Series."
      continue;
    }

    // Quoted string — could be series name or string argument
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance(); // skip opening quote
      let str = "";
      while (i < input.length && input[i] !== quote) {
        str += input[i];
        advance();
      }
      if (i < input.length) advance(); // skip closing quote

      // Classify: series name literal or plain string arg
      if (isSeriesName(str)) {
        tokens.push({ type: "QUOTED_STRING", value: str });
      } else {
        tokens.push({ type: "STRING_ARG", value: str });
      }
      continue;
    }

    // Dot-prefixed: .ts, .tsn, or .method_name
    if (ch === ".") {
      advance(); // skip the dot
      let ident = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        advance();
      }
      if (ident === "ts") {
        tokens.push({ type: "DOT_TS", value: ".ts" });
      } else if (ident === "tsn") {
        tokens.push({ type: "DOT_TSN", value: ".tsn" });
      } else if (ident) {
        tokens.push({ type: "DOT_IDENT", value: ident });
      }
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      advance();
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      advance();
      continue;
    }

    // Comma
    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      advance();
      continue;
    }

    // Ruby hash: { ... }
    if (ch === "{") {
      let depth = 1;
      let hash = "{";
      advance();
      while (i < input.length && depth > 0) {
        if (input[i] === "{") depth++;
        if (input[i] === "}") depth--;
        hash += input[i];
        advance();
      }
      tokens.push({ type: "HASH", value: hash });
      continue;
    }

    // Operators: **, +, -, *, /
    if (peek(2) === "**") {
      tokens.push({ type: "OP", value: "**" });
      advance(2);
      continue;
    }
    if ("+-*/".includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      advance();
      continue;
    }

    // Ruby symbol: :word
    if (ch === ":") {
      advance(); // skip colon
      let sym = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        sym += input[i];
        advance();
      }
      if (sym) {
        tokens.push({ type: "SYMBOL", value: sym });
        continue;
      }
      // Lone colon — skip (shouldn't happen in valid input)
      continue;
    }

    // Number literal (integer or float, possibly negative already handled as OP + NUMBER)
    if (
      /[0-9]/.test(ch) ||
      (ch === "-" && i + 1 < input.length && /[0-9]/.test(input[i + 1]))
    ) {
      let num = "";
      if (ch === "-") {
        num += ch;
        advance();
      }
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i];
        advance();
      }
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }

    // Identifier (for method names without leading dot — e.g. after Series.)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        advance();
      }
      // Check for Ruby hash key syntax: `Identifier:` (colon immediately after)
      if (i < input.length && input[i] === ":") {
        advance(); // skip the colon
        tokens.push({ type: "HASH_KEY", value: ident });
        continue;
      }
      // Treat as DOT_IDENT since it's likely a method after Series.
      tokens.push({ type: "DOT_IDENT", value: ident });
      continue;
    }

    // Unknown character — skip
    advance();
  }

  return tokens;
}

// ─── Ruby Hash Parser ───────────────────────────────────────────────

function parseRubyHash(
  hashStr: string,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  // Match key-value pairs in both Ruby hash syntaxes:
  //   new-style:  `word: value`
  //   old-style:  `:word => value`
  const pairRegex =
    /(?::(\w+)\s*=>|(\w+):)\s*(?:(["'])(.*?)\3|(\d+(?:\.\d+)?)|true|false)/g;
  let match;
  while ((match = pairRegex.exec(hashStr)) !== null) {
    const key = match[1] || match[2];
    if (match[4] !== undefined) {
      result[key] = match[4];
    } else if (match[5] !== undefined) {
      result[key] = Number(match[5]);
    } else {
      // true/false
      const raw = match[0];
      if (raw.includes("true")) result[key] = true;
      else if (raw.includes("false")) result[key] = false;
    }
  }
  return result;
}

// ─── Recursive Descent Parser ───────────────────────────────────────

class EvalParser {
  private tokens: Token[];
  private pos: number;

  private constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  static parse(evalStr: string): EvalNode {
    const tokens = tokenize(evalStr.trim());
    const parser = new EvalParser(tokens);
    const node = parser.parseExpression();
    return node;
  }

  private current(): Token | undefined {
    return this.tokens[this.pos];
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (!tok) throw new EvalParseError("Unexpected end of input");
    this.pos++;
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.current();
    if (!tok || tok.type !== type) {
      throw new EvalParseError(
        `Expected ${type}, got ${tok ? `${tok.type}(${tok.value})` : "EOF"}`,
      );
    }
    return this.advance();
  }

  /** Lowest precedence: + and - */
  private parseExpression(): EvalNode {
    let left = this.parseTerm();

    while (
      this.current()?.type === "OP" &&
      (this.current()!.value === "+" || this.current()!.value === "-")
    ) {
      const op = this.advance().value as "+" | "-";
      const right = this.parseTerm();
      left = { type: "arithmetic", op, left, right };
    }

    return left;
  }

  /** Medium precedence: *, /, ** */
  private parseTerm(): EvalNode {
    let left = this.parsePrimary();

    while (
      this.current()?.type === "OP" &&
      (this.current()!.value === "*" ||
        this.current()!.value === "/" ||
        this.current()!.value === "**")
    ) {
      const op = this.advance().value as "*" | "/" | "**";
      const right = this.parsePrimary();
      left = { type: "arithmetic", op, left, right };
    }

    return left;
  }

  /** Highest precedence: atoms and unary constructs */
  private parsePrimary(): EvalNode {
    const tok = this.current();
    if (!tok) throw new EvalParseError("Unexpected end of input");

    // Grouped expression: (expr)
    if (tok.type === "LPAREN") {
      this.advance(); // skip (
      const expr = this.parseExpression();
      this.expect("RPAREN"); // skip )
      return this.parsePostfix(expr);
    }

    // Static method: Series.method(args)
    if (tok.type === "SERIES_CLASS") {
      return this.parseStaticMethod();
    }

    // Series reference: "NAME".ts or "NAME".tsn
    if (tok.type === "QUOTED_STRING") {
      return this.parseSeriesRef();
    }

    // Number literal
    if (tok.type === "NUMBER") {
      this.advance();
      return { type: "scalar", value: Number(tok.value) };
    }

    throw new EvalParseError(`Unexpected token: ${tok.type}(${tok.value})`);
  }

  /** Parse postfix operators: .method(), .ts, .tsn, arithmetic */
  private parsePostfix(node: EvalNode): EvalNode {
    while (this.current()) {
      const tok = this.current()!;

      // .ts or .tsn on a grouped expression — shouldn't normally occur but handle it
      if (tok.type === "DOT_TS" || tok.type === "DOT_TSN") {
        this.advance();
        // The node must be a series_ref or we wrap it
        continue;
      }

      // .method_name(args)
      if (tok.type === "DOT_IDENT") {
        const method = this.advance().value;
        const args = this.parseMethodArgs();
        node = { type: "instance_method", target: node, method, args };
        continue;
      }

      break;
    }
    return node;
  }

  /** Parse: Series.method_name(args) */
  private parseStaticMethod(): EvalNode {
    this.advance(); // skip SERIES_CLASS

    const methodTok = this.current();
    if (!methodTok || methodTok.type !== "DOT_IDENT") {
      throw new EvalParseError(
        `Expected method name after Series., got ${methodTok ? `${methodTok.type}(${methodTok.value})` : "EOF"}`,
      );
    }
    const method = this.advance().value;
    const args = this.parseMethodArgs();
    return { type: "static_method", method, args };
  }

  /** Parse: "SERIES@GEO.FREQ".ts[.method(args)...] */
  private parseSeriesRef(): EvalNode {
    const nameTok = this.advance(); // QUOTED_STRING
    const resolverTok = this.current();

    if (
      !resolverTok ||
      (resolverTok.type !== "DOT_TS" && resolverTok.type !== "DOT_TSN")
    ) {
      throw new EvalParseError(
        `Expected .ts or .tsn after "${nameTok.value}", got ${resolverTok ? `${resolverTok.type}(${resolverTok.value})` : "EOF"}`,
      );
    }

    const nullable = resolverTok.type === "DOT_TSN";
    this.advance(); // skip .ts/.tsn

    let node: EvalNode = { type: "series_ref", name: nameTok.value, nullable };

    // Parse chained methods: .method_name(args) or .method_name "arg".ts (Ruby space-call)
    while (this.current()?.type === "DOT_IDENT") {
      const method = this.advance().value;
      const args = this.parseMethodArgs();
      node = { type: "instance_method", target: node, method, args };
    }

    return node;
  }

  /** Parse method arguments — either parenthesized or Ruby-style space-separated */
  private parseMethodArgs(): EvalArg[] {
    const args: EvalArg[] = [];

    // Parenthesized arguments
    if (this.current()?.type === "LPAREN") {
      this.advance(); // skip (
      while (this.current() && this.current()!.type !== "RPAREN") {
        args.push(this.parseOneArg());
        if (this.current()?.type === "COMMA") this.advance();
      }
      if (this.current()?.type === "RPAREN") this.advance();
      return args;
    }

    // Ruby space-call: method "arg".ts (series ref) or method "arg" (plain string)
    if (this.current()?.type === "QUOTED_STRING") {
      const next = this.peek(1);
      if (next?.type === "DOT_TS" || next?.type === "DOT_TSN") {
        const name = this.advance().value;
        const nullable = this.advance().type === "DOT_TSN";
        args.push({ type: "series_ref", name, nullable });
      }
    } else if (this.current()?.type === "STRING_ARG") {
      args.push({ type: "string", value: this.advance().value });
    }

    return args;
  }

  /** Parse a single argument value */
  private parseOneArg(): EvalArg {
    const tok = this.current();
    if (!tok)
      throw new EvalParseError("Unexpected end of input in argument list");

    // Ruby symbol :word
    if (tok.type === "SYMBOL") {
      this.advance();
      return { type: "symbol", value: tok.value };
    }

    // Number
    if (tok.type === "NUMBER") {
      this.advance();
      return { type: "number", value: Number(tok.value) };
    }

    // String argument (non-series quoted string)
    if (tok.type === "STRING_ARG") {
      this.advance();
      return { type: "string", value: tok.value };
    }

    // Series name as argument: "NAME".ts
    if (tok.type === "QUOTED_STRING") {
      const name = this.advance().value;
      const resolver = this.current();
      if (resolver?.type === "DOT_TS" || resolver?.type === "DOT_TSN") {
        const nullable = this.advance().type === "DOT_TSN";
        return { type: "series_ref", name, nullable };
      }
      // Bare quoted string that happened to match series pattern — treat as string
      return { type: "string", value: name };
    }

    // Ruby hash { ... }
    if (tok.type === "HASH") {
      this.advance();
      return { type: "options", value: parseRubyHash(tok.value) };
    }

    // Ruby implicit hash (key: value pairs without braces)
    if (tok.type === "HASH_KEY") {
      const opts: Record<string, string | number | boolean> = {};
      while (this.current()?.type === "HASH_KEY") {
        const key = this.advance().value;
        const valTok = this.current();
        if (!valTok)
          throw new EvalParseError("Unexpected end of input after hash key");

        if (valTok.type === "STRING_ARG" || valTok.type === "QUOTED_STRING") {
          opts[key] = this.advance().value;
        } else if (valTok.type === "NUMBER") {
          opts[key] = Number(this.advance().value);
        } else if (
          valTok.type === "DOT_IDENT" &&
          (valTok.value === "true" || valTok.value === "false")
        ) {
          opts[key] = valTok.value === "true";
          this.advance();
        } else if (valTok.type === "SYMBOL") {
          opts[key] = this.advance().value;
        } else {
          throw new EvalParseError(
            `Unexpected hash value for key "${key}": ${valTok.type}(${valTok.value})`,
          );
        }

        if (this.current()?.type === "COMMA") this.advance();
      }
      return { type: "options", value: opts };
    }

    throw new EvalParseError(
      `Unexpected argument token: ${tok.type}(${tok.value})`,
    );
  }
}

// ─── Errors ─────────────────────────────────────────────────────────

export class EvalParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalParseError";
  }
}

export default EvalParser;
