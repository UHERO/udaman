import { exec } from "child_process";
import { promisify } from "util";

import type { Job } from "bullmq";

import { createLogger } from "@/core/observability/logger";

import type { AdminActionJobData } from "../queues";

const log = createLogger("worker.admin-action");
const execAsync = promisify(exec);

const COMMANDS: Record<AdminActionJobData["action"], string> = {
  clear_cache: 'ssh uhero@uhero12.colo.hawaii.edu "bin/clear_api_cache.sh /v1"',
  restart_rest: "sudo systemctl restart rest-api.service",
  restart_dvw: "sudo systemctl restart dvw-api.service",
  sync_nas: 'ssh uhero@uhero13.colo.hawaii.edu "/home/uhero/filesync.sh"',
};

export async function processAdminAction(
  job: Job<AdminActionJobData>,
): Promise<string> {
  const { action } = job.data;
  const command = COMMANDS[action];
  if (!command) throw new Error(`Unknown admin action: ${action}`);

  log.info({ action }, `Running admin action: ${action}`);
  job.log(`Running: ${action}`);

  const { stdout, stderr } = await execAsync(command);
  if (stdout) job.log(`stdout: ${stdout}`);
  if (stderr) job.log(`stderr: ${stderr}`);

  log.info({ action }, `Admin action complete: ${action}`);
  return `Executed ${action}`;
}
