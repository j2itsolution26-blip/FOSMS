export const SESSION_COOKIE_NAME = "fo_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24; // renew if <1 day left

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 1000 * 60 * 15; // 15 minutes

export const LOGIN_RATE_LIMIT_WINDOW_MS = 1000 * 60; // 1 minute
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10; // per IP, across all emails
