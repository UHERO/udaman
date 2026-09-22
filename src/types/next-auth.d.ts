import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
    universe?: string;
    createdAt?: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      universe: string;
      createdAt: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    universe?: string;
    createdAt?: string;
    /**
     * Route resources this role may read, resolved from role_permissions at
     * token issue/refresh. Lets the proxy gate routes on permissions without
     * a DB round trip; stale until the token rotates.
     */
    readable?: string[];
  }
}
