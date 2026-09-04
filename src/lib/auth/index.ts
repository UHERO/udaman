import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import UserCollection from "@catalog/collections/user-collection";
import { mysql } from "@database/mysql";
import { compare } from "bcryptjs";

import { DEVISE_PEPPER } from "@/lib/auth/pepper";

import { resolveClientIp } from "./client-ip";
import { MySqlAdapter } from "./mysql-adapter";

const adapter = MySqlAdapter();

/** `?error=` value the login page turns into the "no account" dialog. */
export const NO_ACCOUNT_ERROR = "no-account";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  // Credentials provider requires JWT strategy. The adapter is still used
  // for user/account CRUD (linking OAuth accounts, looking up users, etc.).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/udaman",
  },
  providers: [
    Google,
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const rows = await mysql<{
          id: number;
          email: string;
          name: string | null;
          encrypted_password: string;
          role: string;
          universe: string;
          created_at: Date | string | null;
        }>`
          SELECT id, email, name, encrypted_password, role, universe, created_at
          FROM users WHERE email = ${email}
        `;

        const user = rows[0];
        if (!user) return null;

        // Devise stores bcrypt hashes
        const hash = user.encrypted_password;
        if (!hash || !hash.startsWith("$2")) return null;

        const valid = await compare(password + DEVISE_PEPPER, hash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          universe: user.universe,
          createdAt: user.created_at
            ? new Date(user.created_at as string | Date).toISOString()
            : "",
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials sign-in: already validated in authorize(), allow through
      if (!account || account.provider === "credentials") return true;

      // OAuth sign-in: only pre-created accounts may sign in. Accounts are
      // created by an admin (rail user menu → Create Account, /admin/users,
      // or scripts/import-user-whitelist.ts) — never on first sign-in.
      // Unknown emails are bounced to the login page, which shows a dialog
      // telling them how to request access. Returning a URL here (rather
      // than false) skips Auth.js's generic AccessDenied error page.
      if (!user.email) return false;

      const existing = await adapter.getUserByEmail!(user.email);
      if (!existing) return `/udaman?error=${NO_ACCOUNT_ERROR}`;

      {
        // Check if this OAuth account is already linked
        const linked = await adapter.getUserByAccount!({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });

        if (!linked) {
          // Link the OAuth account to the existing user
          await adapter.linkAccount!({
            ...account,
            userId: existing.id,
            type: account.type as "oauth" | "oidc" | "email" | "webauthn",
          });
        }

        // Use the existing user's ID and role so the JWT gets the right values
        user.id = existing.id;
        user.name = existing.name ?? user.name;

        // Fetch role, universe, and createdAt from DB for the linked user
        const userRows = await mysql<{
          role: string;
          universe: string;
          created_at: Date | string | null;
        }>`
          SELECT role, universe, created_at FROM users WHERE id = ${Number(existing.id)} LIMIT 1
        `;
        if (userRows[0]) {
          user.role = userRows[0].role;
          user.universe = userRows[0].universe;
          user.createdAt = userRows[0].created_at
            ? new Date(userRows[0].created_at as string | Date).toISOString()
            : "";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // On sign-in, persist user ID, role, universe, and createdAt into the JWT
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.universe = user.universe;
        token.createdAt = user.createdAt;
      }
      // Backfill: if existing session has id but missing role/universe, fetch once
      if (token.id && (!token.role || !token.universe)) {
        const rows = await mysql<{
          role: string;
          universe: string;
          created_at: Date | string | null;
        }>`
          SELECT role, universe, created_at FROM users WHERE id = ${Number(token.id)} LIMIT 1
        `;
        if (!token.role) token.role = rows[0]?.role ?? "external";
        if (!token.universe) token.universe = rows[0]?.universe ?? "UHERO";
        if (!token.createdAt && rows[0]?.created_at) {
          token.createdAt = new Date(
            rows[0].created_at as string | Date,
          ).toISOString();
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user ID, role, universe, and createdAt from JWT in the session object
      session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "external";
      session.user.universe = (token.universe as string) ?? "UHERO";
      session.user.createdAt = (token.createdAt as string) ?? "";
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow relative URLs and same-origin URLs (e.g. /udaman after sign-out)
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  events: {
    /**
     * Devise-style sign-in tracking. Fires once per actual sign-in — both
     * Credentials and Google — and never on JWT refresh, so `current_sign_in_at`
     * marks when the session began, not when the user was last active. (For
     * "last active", read the page_view rows in app_logs.)
     */
    async signIn({ user }) {
      const id = Number(user?.id);
      if (!id || Number.isNaN(id)) return;
      await UserCollection.recordSignIn(id, await resolveClientIp());
    },
  },
});
