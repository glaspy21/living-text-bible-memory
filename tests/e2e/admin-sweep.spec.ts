import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { signInAs } from "./session";

/**
 * Every admin API route and page, found on disk, so a route added later is covered without
 * anyone remembering to add it here: signed-out is turned away (401 / sign-in), and so is a
 * signed-in account that isn't on the allowlist (403 / sign-in). Admin authorization is enforced
 * on the server for every route, never by the UI.
 */
test.skip(({ isMobile }) => isMobile, "access rules do not depend on the viewport");

const ROOT = path.join(process.cwd(), "src/app");

function walk(dir: string, file: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full, file) : name === file ? [full] : [];
  });
}

/** "src/app/api/admin/recordings/[id]/timing/route.ts" → "/api/admin/recordings/x/timing". */
const urlOf = (file: string, leaf: string) =>
  "/" +
  path
    .relative(ROOT, file)
    .replace(new RegExp(`/?${leaf.replace(".", "\\.")}$`), "")
    .split(path.sep)
    .join("/")
    .replace(/\[[^\]]+\]/g, "x");

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const apiRoutes = walk(path.join(ROOT, "api/admin"), "route.ts").flatMap((file) => {
  const source = readFileSync(file, "utf8");
  return METHODS.filter((m) =>
    new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(source),
  ).map((method) => ({ method, url: urlOf(file, "route.ts") }));
});
const adminPages = walk(path.join(ROOT, "admin"), "page.tsx").map((file) =>
  urlOf(file, "page.tsx"),
);

test("the sweep finds the routes it should", () => {
  // If discovery breaks, the checks below would pass by testing nothing.
  expect(apiRoutes.length).toBeGreaterThanOrEqual(12);
  expect(apiRoutes).toContainEqual({ method: "POST", url: "/api/admin/recordings/x/status" });
  expect(adminPages).toEqual(expect.arrayContaining(["/admin", "/admin/timing", "/admin/publish"]));
});

test.describe("admin API routes", () => {
  for (const { method, url } of apiRoutes) {
    test(`${method} ${url}: 401 signed out`, async ({ playwright, baseURL }) => {
      const stranger = await playwright.request.newContext({ baseURL });
      const response = await stranger.fetch(url, {
        method,
        data: method === "GET" ? undefined : {},
      });
      expect(response.status()).toBe(401);
      await stranger.dispose();
    });

    test(`${method} ${url}: 403 for an account not on the allowlist`, async ({ context }) => {
      await signInAs(context, "listener@example.test");
      const response = await context.request.fetch(url, {
        method,
        data: method === "GET" ? undefined : {},
      });
      expect(response.status()).toBe(403);
    });
  }
});

test.describe("admin pages", () => {
  for (const url of adminPages) {
    test(`${url}: signed-out and non-admin visitors see no admin content`, async ({
      page,
      context,
    }) => {
      await page.goto(url);
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);

      await signInAs(context, "listener@example.test");
      await page.goto(url);
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
    });
  }
});
