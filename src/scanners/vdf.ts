export type VdfValue = string | VdfObject;

export interface VdfObject {
  readonly [key: string]: VdfValue;
}

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\r' || char === '\n';
}

class Parser {
  private index = 0;

  constructor(private readonly input: string) {}

  parseDocument(): VdfObject {
    const root: Record<string, VdfValue> = {};
    this.skipTrivia();
    while (!this.atEnd()) {
      this.readPairInto(root);
      this.skipTrivia();
    }
    return root;
  }

  private atEnd(): boolean {
    return this.index >= this.input.length;
  }

  private skipTrivia(): void {
    while (!this.atEnd()) {
      const char = this.input[this.index] as string;
      if (isSpace(char)) {
        this.index += 1;
        continue;
      }
      if (this.input.startsWith('//', this.index)) {
        const newline = this.input.indexOf('\n', this.index);
        this.index = newline === -1 ? this.input.length : newline + 1;
        continue;
      }
      break;
    }
  }

  private expect(char: string): void {
    if (this.input[this.index] !== char) {
      throw new Error(`expected "${char}" at offset ${this.index}`);
    }
    this.index += 1;
  }

  private readToken(): string {
    this.skipTrivia();
    if (this.input[this.index] === '"') {
      return this.readQuoted();
    }
    const start = this.index;
    while (!this.atEnd()) {
      const char = this.input[this.index] as string;
      if (isSpace(char) || char === '{' || char === '}' || char === '"') break;
      this.index += 1;
    }
    if (start === this.index) {
      throw new Error(`unexpected token at offset ${this.index}`);
    }
    return this.input.slice(start, this.index);
  }

  private readQuoted(): string {
    this.expect('"');
    let value = '';
    while (!this.atEnd()) {
      const char = this.input[this.index] as string;
      if (char === '\\') {
        const next = this.input[this.index + 1];
        if (next === undefined) {
          throw new Error('unterminated escape sequence');
        }
        value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
        this.index += 2;
        continue;
      }
      if (char === '"') {
        this.index += 1;
        return value;
      }
      value += char;
      this.index += 1;
    }
    throw new Error('unterminated quoted string');
  }

  private readPairInto(target: Record<string, VdfValue>): void {
    const key = this.readToken();
    this.skipTrivia();
    if (this.input[this.index] === '{') {
      this.index += 1;
      const child: Record<string, VdfValue> = {};
      this.skipTrivia();
      while (!this.atEnd() && this.input[this.index] !== '}') {
        this.readPairInto(child);
        this.skipTrivia();
      }
      this.expect('}');
      target[key] = child;
      return;
    }
    target[key] = this.readToken();
  }
}

export function parseVdf(input: string): VdfObject {
  return new Parser(input).parseDocument();
}

export function asObject(value: VdfValue | undefined): VdfObject | undefined {
  return typeof value === 'object' ? value : undefined;
}

export function asString(value: VdfValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
