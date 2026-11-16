/** App URLs for ops messages (no `/udaman` prefix, see loader-lag-mailer). */
export const OPS_BASE_URL =
  process.env.UDAMAN_BASE_URL ??
  process.env.AUTH_URL ??
  "https://udaman.uhero.hawaii.edu";

const u = (universe: string) => `${OPS_BASE_URL}/${universe.toLowerCase()}`;

export const issueUrl = (universe: string, id: number) =>
  `${u(universe)}/investigations/issues/${id}`;
export const proposalsUrl = (universe: string) =>
  `${u(universe)}/investigations/proposals`;
export const seriesUrl = (universe: string, id: number) =>
  `${u(universe)}/series/${id}`;
export const agentAdminUrl = () => `${OPS_BASE_URL}/admin/agent`;
