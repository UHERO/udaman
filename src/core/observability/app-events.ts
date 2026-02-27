import { appEventLog } from "./logger";

export function logPageView(pathname: string, userId?: number) {
  appEventLog.info({ event: "page_view", pathname, userId });
}

export function logControllerCall(
  controller: string,
  fn: string,
  params?: Record<string, unknown>,
) {
  appEventLog.info({ event: "controller_call", controller, fn, params });
}
