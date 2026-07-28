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
  security: string;
  source: string;
  title: string;
  updatedAt: Date;
};
