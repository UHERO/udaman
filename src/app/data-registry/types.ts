/**
 * Shared type definitions for the Data Registry feature: the author
 * account shape and the DataSource entry shape used across the UI.
 */

export type Account = {
  email: string;
  emailVerified: boolean | null;
  id: string;
  image: string;
  name: string;
  phone: string | null;
  role: string;
  smsNotifications?: boolean | null;
  sessionToken?: string;
};

export type DataSource = {
  access: string;
  author: Account;
  authorId: string;
  contact: string;
  createdAt: Date;
  description: string;
  format: string;
  id: number;
  owner: string;
  requiresApproval: boolean;
  approvalDetails: string | null;
  security: string;
  source: string;
  title: string;
  updatedAt: Date;
};
