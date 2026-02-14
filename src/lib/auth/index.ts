import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { mysql } from "@database/mysql";
import { compare } from "bcryptjs";

import { MySqlAdapter } from "./mysql-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MySqlAdapter(),
  // Credentials provider requires JWT strategy — database sessions are only
  // auto-created for OAuth/magic-link flows. The adapter is still used for
  // user lookup (getUserByEmail, etc.) and will be used when we add OAuth later.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/udaman",
  },
  providers: [
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
        }>`
          SELECT id, email, name, encrypted_password
          FROM users WHERE email = ${email}
        `;

        const user = rows[0];
        if (!user) return null;

        // Devise stores bcrypt hashes — some accounts may be deactivated
        const hash = user.encrypted_password;
        if (!hash || !hash.startsWith("$2")) return null;

        const valid = await compare(password, hash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, persist user ID into the JWT
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user ID from JWT in the session object
      session.user.id = token.id as string;
      return session;
    },
  },
});
