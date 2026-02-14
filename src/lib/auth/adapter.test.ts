import { mysql } from "@database/mysql";

import { MySqlAdapter } from "./mysql-adapter";
import { runBasicTests } from "./mysql-adapter.test";

runBasicTests({
  adapter: MySqlAdapter(),
  db: {
    async connect() {
      // Clean up leftover test data from previous runs
      await mysql`DELETE FROM verification_tokens`;
      await mysql`DELETE FROM sessions`;
      await mysql`DELETE FROM accounts`;
      await mysql`
        DELETE FROM users
        WHERE email LIKE '%murray.com'
          OR email LIKE '%example.com'
      `;
    },
    async user(id: string) {
      const rows = await mysql`
        SELECT id, email, name, image, email_verified
        FROM users WHERE id = ${parseInt(id)}
      `;
      if (!rows[0]) return null;
      const row = rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        email: row.email as string,
        name: (row.name as string) ?? null,
        image: (row.image as string) ?? null,
        emailVerified: row.email_verified
          ? new Date(row.email_verified as string | number | Date)
          : null,
      };
    },
    async session(sessionToken: string) {
      const rows = await mysql`
        SELECT id, session_token, user_id, expires
        FROM sessions WHERE session_token = ${sessionToken}
      `;
      if (!rows[0]) return null;
      const row = rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        sessionToken: row.session_token as string,
        userId: String(row.user_id),
        expires: new Date(row.expires as string | number | Date),
      };
    },
    async account({
      provider,
      providerAccountId,
    }: {
      provider: string;
      providerAccountId: string;
    }) {
      const rows = await mysql`
        SELECT * FROM accounts
        WHERE provider = ${provider}
          AND provider_account_id = ${providerAccountId}
      `;
      if (!rows[0]) return null;
      const row = rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        userId: String(row.user_id),
        type: row.type as string,
        provider: row.provider as string,
        providerAccountId: row.provider_account_id as string,
        refresh_token: (row.refresh_token as string) ?? null,
        access_token: (row.access_token as string) ?? null,
        expires_at: (row.expires_at as number) ?? null,
        id_token: (row.id_token as string) ?? null,
        token_type: (row.token_type as string) ?? null,
        scope: (row.scope as string) ?? null,
        session_state: (row.session_state as string) ?? null,
      };
    },
    async verificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }) {
      const rows = await mysql`
        SELECT identifier, token, expires
        FROM verification_tokens
        WHERE identifier = ${identifier} AND token = ${token}
      `;
      if (!rows[0]) return null;
      const row = rows[0] as Record<string, unknown>;
      return {
        identifier: row.identifier as string,
        token: row.token as string,
        expires: new Date(row.expires as string | number | Date),
      };
    },
  },
});
