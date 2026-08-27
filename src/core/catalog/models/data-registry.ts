export type DataRegistryAuthor = {
  id: number;
  universe: string;
  role: string;
  mnemo_search: boolean;
  email: string;
  name: string | null;
  image: string | null;
  email_verified: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
};

export type DataRegistryEntryAttrs = {
  id: number;
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: string;
  requires_approval: boolean | number;
  approval_details: string | null;
  description: string;
  author_id: number;
  created_at: Date;
  updated_at: Date;
  author: DataRegistryAuthor;
};

class DataRegistryEntry {
  readonly id: number;
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: string;
  requiresApproval: boolean;
  approvalDetails: string | null;
  description: string;
  authorId: number;
  createdAt: Date;
  updatedAt: Date;
  author: DataRegistryAuthor;

  constructor(attrs: DataRegistryEntryAttrs) {
    this.id = attrs.id;
    this.title = attrs.title;
    this.source = attrs.source;
    this.access = attrs.access;
    this.owner = attrs.owner;
    this.contact = attrs.contact;
    this.format = attrs.format;
    this.security = attrs.security;
    this.requiresApproval = Boolean(attrs.requires_approval);
    this.approvalDetails = attrs.approval_details ?? null;
    this.description = attrs.description;
    this.authorId = attrs.author_id;
    this.createdAt = attrs.created_at;
    this.updatedAt = attrs.updated_at;
    this.author = attrs.author;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      source: this.source,
      access: this.access,
      owner: this.owner,
      contact: this.contact,
      format: this.format,
      security: this.security,
      requiresApproval: this.requiresApproval,
      approvalDetails: this.approvalDetails,
      description: this.description,
      author_id: this.authorId,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      author: this.author,
    };
  }
}

export default DataRegistryEntry;
