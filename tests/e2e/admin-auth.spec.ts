import { expect, test } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { signInAs } from "./session";

test.describe("admin access", () => {
  test("signed-out visitors are sent to sign-in and see no admin content", async ({ page }) => {
    await page.goto("/admin/upload");
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);
    await expect(page.getByRole("heading", { name: "Administrator sign-in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  });

  test("a signed-in account that isn't on the allowlist cannot open admin", async ({
    page,
    context,
  }) => {
    await signInAs(context, "listener@example.test");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
  });

  test("a forged session cookie is ignored", async ({ page, context }) => {
    await context.addCookies([
      { name: "authjs.session-token", value: "forged", domain: "localhost", path: "/" },
    ]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("an allowlisted admin gets the workspace", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText(E2E_ADMIN_EMAIL)).toBeVisible();
  });

  test("the sign-in page explains a rejected account", async ({ page }) => {
    await page.goto("/sign-in?error=AccessDenied");
    await expect(page.getByText("isn't on the administrator list")).toBeVisible();
  });
});
