export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * LAN-only mode: no OAuth login URL needed.
 * This function returns "/" since all users are always authenticated.
 */
export const getLoginUrl = () => "/";
