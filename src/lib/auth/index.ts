import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { mysql } from "@database/mysql";
import { compare } from "bcryptjs";

import { DEVISE_PEPPER } from "@/lib/auth/pepper";
import { isEmailAllowed } from "./auth-whitelist";
import { MySqlAdapter } from "./mysql-adapter";

const adapter = MySqlAdapter();

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
        if (!isEmailAllowed(email)) return null;

        const rows = await mysql<{
          id: number;
          email: string;
          name: string | null;
          encrypted_password: string;
          role: string;
          universe: string;
        }>`
          SELECT id, email, name, encrypted_password, role, universe
          FROM users WHERE email = ${email}
        `;

        const user = rows[0];
        if (!user) return null;

        // Devise stores bcrypt hashes — some accounts may be deactivated
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
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials sign-in: already validated in authorize(), allow through
      if (!account || account.provider === "credentials") return true;

      // OAuth sign-in: link to existing user if one exists with the same email.
      // With JWT strategy Auth.js doesn't auto-link, so we do it manually.
      if (!user.email || !isEmailAllowed(user.email)) return false;

      const existing = await adapter.getUserByEmail!(user.email);
      if (existing) {
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

        // Fetch role and universe from DB for the linked user
        const userRows = await mysql<{ role: string; universe: string }>`
          SELECT role, universe FROM users WHERE id = ${Number(existing.id)} LIMIT 1
        `;
        if (userRows[0]) {
          user.role = userRows[0].role;
          user.universe = userRows[0].universe;
        }
      }
      // If no existing user, Auth.js will call createUser + linkAccount via the adapter

      return true;
    },
    async jwt({ token, user }) {
      // On sign-in, persist user ID, role, and universe into the JWT
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.universe = user.universe;
      }
      // Backfill: if existing session has id but missing role/universe, fetch once
      if (token.id && (!token.role || !token.universe)) {
        const rows = await mysql<{ role: string; universe: string }>`
          SELECT role, universe FROM users WHERE id = ${Number(token.id)} LIMIT 1
        `;
        if (!token.role) token.role = rows[0]?.role ?? "external";
        if (!token.universe) token.universe = rows[0]?.universe ?? "UHERO";
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user ID, role, and universe from JWT in the session object
      session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "external";
      session.user.universe = (token.universe as string) ?? "UHERO";
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow relative URLs and same-origin URLs (e.g. /udaman after sign-out)
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
});
