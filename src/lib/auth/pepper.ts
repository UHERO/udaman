/** Devise pepper — appended to passwords before bcrypt hashing.
 *  Must match the Rails app's `config.devise.pepper` so both apps
 *  can verify the same password hashes in the shared database. */
export const DEVISE_PEPPER = process.env.DEVISE_PEPPER ?? "";
