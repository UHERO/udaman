import type { Universe } from "../types/shared";

export type ApiApplicationAttrs = {
  id: number;
  universe?: string | null;
  name?: string | null;
  hostname?: string | null;
  api_key?: string | null;
  github_nickname?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class ApiApplication {
  readonly id: number;
  readonly universe: Universe;
  name: string | null;
  hostname: string | null;
  apiKey: string | null;
  githubNickname: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ApiApplicationAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.name = attrs.name ?? null;
    this.hostname = attrs.hostname ?? null;
    this.apiKey = attrs.api_key ?? null;
    this.githubNickname = attrs.github_nickname ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  toString(): string {
    return `${this.name} (${this.universe})`;
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      name: this.name,
      hostname: this.hostname,
      apiKey: this.apiKey,
      githubNickname: this.githubNickname,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export default ApiApplication;
