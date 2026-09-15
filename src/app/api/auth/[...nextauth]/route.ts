import type { NextRequest } from "next/server";

import { withClientIp } from "@/lib/auth/client-ip";
import { handlers } from "@/lib/auth/index";

// Wrap each auth request so the sign-in event can read the client address —
// Auth.js hands its callbacks no request object of their own.
export const GET = (req: NextRequest) =>
  withClientIp(req, () => handlers.GET(req));

export const POST = (req: NextRequest) =>
  withClientIp(req, () => handlers.POST(req));
