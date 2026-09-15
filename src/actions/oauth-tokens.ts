"use server";

/**
 * Admin actions for the MCP OAuth access tokens ("MCP Connections" tab on
 * /admin/users). Dev-only, mirroring the user-management actions: listing
 * shows who has a live Claude connection, and revoking ends it immediately
 * rather than at the 30-day expiry.
 */
import { revalidatePath } from "next/cache";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import OAuthAccessTokenCollection, {
  type ActiveTokenRow,
} from "@catalog/collections/oauth-access-token-collection";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

const log = createLogger("action.oauth-tokens");

async function requireDev(): Promise<number> {
  const role = await getCurrentUserRole();
  if (role !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");
  return getCurrentUserId();
}

export async function listMcpTokens(): Promise<ActiveTokenRow[]> {
  await requireDev();
  return OAuthAccessTokenCollection.listActive();
}

export async function revokeMcpToken(
  id: number,
): Promise<{ success: boolean; message: string }> {
  const currentUserId = await requireDev();
  log.info({ id, currentUserId }, "revokeMcpToken called");
  try {
    // Look the token up first so the audit log can name its owner.
    const tokens = await OAuthAccessTokenCollection.listActive();
    const target = tokens.find((t) => t.id === id);
    const revoked = await OAuthAccessTokenCollection.revokeById(id);
    if (!revoked) {
      return {
        success: false,
        message: "Token was already revoked or expired",
      };
    }
    revalidatePath("/admin/users");
    AppLogCollection.log({
      category: "user",
      name: "user.mcp_token_revoke",
      userId: currentUserId,
      subject: "users",
      subjectId: target?.userId,
      metadata: { tokenId: id, clientId: target?.clientId ?? null },
    });
    return {
      success: true,
      message: `Revoked MCP connection for ${target?.tokenEmail ?? `token ${id}`}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, id, currentUserId }, "revokeMcpToken failed");
    AppLogCollection.logError(err, {
      userId: currentUserId,
      name: "user.mcp_token_revoke",
    });
    return { success: false, message };
  }
}

export async function revokeMcpTokensForUser(
  userId: number,
): Promise<{ success: boolean; message: string }> {
  const currentUserId = await requireDev();
  log.info({ userId, currentUserId }, "revokeMcpTokensForUser called");
  try {
    await OAuthAccessTokenCollection.revokeByUser(userId);
    revalidatePath("/admin/users");
    AppLogCollection.log({
      category: "user",
      name: "user.mcp_token_revoke_all",
      userId: currentUserId,
      subject: "users",
      subjectId: userId,
    });
    return { success: true, message: "Revoked all MCP connections for user" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { err: message, userId, currentUserId },
      "revokeMcpTokensForUser failed",
    );
    AppLogCollection.logError(err, {
      userId: currentUserId,
      name: "user.mcp_token_revoke_all",
    });
    return { success: false, message };
  }
}
