// Ensure all server-side date operations use Hawaii Standard Time.
export function register() {
  process.env.TZ = "Pacific/Honolulu";
}
