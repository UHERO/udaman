export type UniverseAttrs = { name: string };

class Universe {
  readonly name: string;

  constructor(attrs: UniverseAttrs) {
    this.name = attrs.name;
  }

  toString(): string {
    return this.name;
  }

  toJSON() {
    return { name: this.name };
  }
}

export default Universe;
