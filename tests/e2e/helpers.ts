import type { Page } from "@playwright/test";

export const DEMO_USERS = {
  superAdmin: { email: "superadmin@fonc2s.local", password: "Password123!" },
  frontOffice: { email: "frontdesk@fonc2s.local", password: "Password123!" },
  instructor: { email: "instructor@fonc2s.local", password: "Password123!" },
} as const;

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}
