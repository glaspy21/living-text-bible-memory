import { expect, test, type Page } from "@playwright/test";
import { streamed } from "./helpers";
import { addToneRecording } from "./audio-fixture";
import { TestDb } from "./db";

const PASSAGE = "?p=john+1%3A3-6"; // four cards: 3, 4, 5, 6
const card = (page: Page) => page.getByRole("main").getByTestId("card");
const count = (page: Page) => page.getByRole("main").getByTestId("card-count");
const next = (page: Page) => page.getByRole("button", { name: "Next card" });
const prev = (page: Page) => page.getByRole("button", { name: "Previous card" });
const shuffle = (page: Page) => page.getByRole("button", { name: "Shuffle" });
const restart = (page: Page) => page.getByRole("button", { name: "Restart" });

async function openCards(page: Page, query = PASSAGE) {
  await page.goto(`/memorize/flashcards${query}`);
  await streamed(page);
  await expect(card(page)).toBeVisible();
  await expect(page.getByRole("main").getByTestId("card")).toHaveCount(1);
  // Let the card's first paint settle so clicks land (the page has hydrated by then).
  await expect(count(page)).toHaveText("CARD 1 OF 4");
}

/** The chapter:verse shown on the front of the current card. */
const reference = (page: Page) =>
  card(page)
    .locator(".fc-face")
    .first()
    .evaluate((el) => el.textContent ?? "")
    .then((text) => /(\d+:\d+)/.exec(text)?.[1] ?? "");

test.describe("flashcards", () => {
  test("without a passage it goes to choosing verses, which returns here", async ({ page }) => {
    await page.goto("/memorize/flashcards");
    await expect(page).toHaveURL(/\/memorize\/range\?from=flashcards/);
    await streamed(page);
    await expect(page.getByRole("main").getByTestId("range-picker")).toBeVisible();
  });

  test("the front shows the book, chapter and verse and invites a tap", async ({ page }) => {
    await openCards(page);
    const front = card(page).locator(".fc-face").first();
    await expect(front).toContainText("JOHN");
    await expect(front).toContainText("1:3");
    await expect(front).toContainText("Tap to reveal");
    await expect(card(page)).toHaveAttribute("data-flipped", "false");
  });

  test("a card reached with the arrows still turns over when tapped", async ({ page }) => {
    await openCards(page);
    await next(page).click();
    await prev(page).click();
    await card(page).click();
    await expect(card(page)).toHaveAttribute("data-flipped", "true");
    // The slide-in must not leave a transform behind that stops the card from turning.
    await page.waitForTimeout(1000);
    const turned = await card(page).evaluate((el) => getComputedStyle(el).transform);
    expect(turned).not.toBe("none");
  });

  test("tapping turns the card over to the verse, and again to turn it back", async ({ page }) => {
    await openCards(page);
    await card(page).click();
    await expect(card(page)).toHaveAttribute("data-flipped", "true");
    await expect(page.getByTestId("card-text")).toHaveText(
      "All things were made through him. Without him, nothing was made that has been made.",
    );
    await card(page).click();
    await expect(card(page)).toHaveAttribute("data-flipped", "false");
  });

  test("the keyboard flips with Enter or Space and moves with the arrow keys", async ({ page }) => {
    await openCards(page);
    await card(page).focus();
    await page.keyboard.press("Enter");
    await expect(card(page)).toHaveAttribute("data-flipped", "true");
    await page.keyboard.press("Space");
    await expect(card(page)).toHaveAttribute("data-flipped", "false");
    await page.keyboard.press("ArrowRight");
    await expect(count(page)).toHaveText("CARD 2 OF 4");
    await page.keyboard.press("ArrowLeft");
    await expect(count(page)).toHaveText("CARD 1 OF 4");
  });

  test("next and back move through the cards and wrap around", async ({ page }) => {
    await openCards(page);
    await next(page).click();
    await expect(count(page)).toHaveText("CARD 2 OF 4");
    expect(await reference(page)).toBe("1:4");
    await prev(page).click();
    await prev(page).click(); // wraps to the last card
    await expect(count(page)).toHaveText("CARD 4 OF 4");
    expect(await reference(page)).toBe("1:6");
    await next(page).click(); // and forwards again
    await expect(count(page)).toHaveText("CARD 1 OF 4");
  });

  test("moving to another card shows its front again", async ({ page }) => {
    await openCards(page);
    await card(page).click();
    await expect(card(page)).toHaveAttribute("data-flipped", "true");
    await next(page).click();
    await expect(card(page)).toHaveAttribute("data-flipped", "false");
  });

  test("Shuffle stays fully filled while on, even with the cursor away", async ({ page }) => {
    await openCards(page);
    const clip = () =>
      shuffle(page)
        .locator(".wipe-fill")
        .evaluate((el) => getComputedStyle(el).clipPath);
    await expect.poll(clip).toContain("100%");
    await shuffle(page).click();
    await page.mouse.move(0, 0);
    await expect.poll(clip).not.toContain("100%");
    await shuffle(page).click();
    await page.mouse.move(0, 0);
    await expect.poll(clip).toContain("100%");
  });

  test("Shuffle is a switch that starts off, with Restart to its left", async ({ page }) => {
    await openCards(page);
    await expect(shuffle(page)).toHaveAttribute("aria-pressed", "false");
    await shuffle(page).click();
    await expect(shuffle(page)).toHaveAttribute("aria-pressed", "true");
    await shuffle(page).click();
    await expect(shuffle(page)).toHaveAttribute("aria-pressed", "false");

    const shuffleBox = (await shuffle(page).boundingBox())!;
    const restartBox = (await restart(page).boundingBox())!;
    // Side by side on one line, Restart to the left, the pair centred under the card.
    expect(Math.abs(restartBox.y - shuffleBox.y)).toBeLessThan(2);
    expect(shuffleBox.x).toBeGreaterThan(restartBox.x + restartBox.width);
    const pairCentre = (restartBox.x + shuffleBox.x + shuffleBox.width) / 2;
    // The wrapper never moves (the card inside slides in after each click).
    const cardBox = (await card(page).locator("xpath=..").boundingBox())!;
    expect(Math.abs(pairCentre - (cardBox.x + cardBox.width / 2))).toBeLessThan(3);
  });

  test("with Shuffle off the cards go in sequence, wrapping around", async ({ page }) => {
    await openCards(page);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(await reference(page));
      await next(page).click();
    }
    expect(seen).toEqual(["1:3", "1:4", "1:5", "1:6", "1:3"]);
  });

  test("turning Shuffle on keeps the current card, then visits every card once at random", async ({
    page,
  }) => {
    await openCards(page);
    await next(page).click();
    await next(page).click();
    expect(await reference(page)).toBe("1:5");

    await shuffle(page).click();
    await expect(shuffle(page)).toHaveAttribute("aria-pressed", "true");
    expect(await reference(page)).toBe("1:5"); // stays on the card you were looking at
    await expect(count(page)).toHaveText("CARD 1 OF 4");

    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(await reference(page));
      await next(page).click();
    }
    expect(seen[0]).toBe("1:5");
    expect([...seen].sort()).toEqual(["1:3", "1:4", "1:5", "1:6"]);
    // After the last card of the pass it comes back round to the first.
    expect(await reference(page)).toBe("1:5");
  });

  test("the shuffled order is really random from one switch-on to the next", async ({ page }) => {
    await openCards(page);
    const orders = new Set<string>();
    for (let round = 0; round < 8; round++) {
      await shuffle(page).click(); // on, from the card we are on
      const seen: string[] = [];
      for (let i = 0; i < 4; i++) {
        seen.push(await reference(page));
        await next(page).click();
      }
      orders.add(seen.slice(1).join(" "));
      await shuffle(page).click(); // off
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  test("turning Shuffle off keeps the current card and carries on in sequence", async ({
    page,
  }) => {
    await openCards(page);
    await shuffle(page).click();
    await next(page).click();
    const current = await reference(page);
    await shuffle(page).click();
    await expect(shuffle(page)).toHaveAttribute("aria-pressed", "false");
    expect(await reference(page)).toBe(current);

    const verse = Number(current.split(":")[1]);
    await next(page).click();
    const following = verse === 6 ? 3 : verse + 1;
    expect(await reference(page)).toBe(`1:${following}`);
  });

  test("Restart goes back to card 1, in sequence or shuffled", async ({ page }) => {
    await openCards(page);
    await next(page).click();
    await next(page).click();
    await card(page).click();
    await restart(page).click();
    await expect(count(page)).toHaveText("CARD 1 OF 4");
    expect(await reference(page)).toBe("1:3");
    await expect(card(page)).toHaveAttribute("data-flipped", "false");

    await shuffle(page).click();
    await next(page).click();
    await next(page).click();
    await restart(page).click();
    await expect(count(page)).toHaveText("CARD 1 OF 4");
    await expect(shuffle(page)).toHaveAttribute("aria-pressed", "true"); // still shuffling
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(await reference(page));
      await next(page).click();
    }
    expect([...seen].sort()).toEqual(["1:3", "1:4", "1:5", "1:6"]);
  });

  test("Switch to Steps carries the passage", async ({ page }) => {
    await openCards(page);
    await expect(page.getByRole("link", { name: /Switch to Steps/ })).toHaveAttribute(
      "href",
      "/memorize/steps?p=john+1%3A3-6",
    );
  });

  test("shows the translation's notice and never starts audio by itself", async ({ page }) => {
    await openCards(page);
    await expect(page.getByRole("main").getByTestId("scripture-attribution")).toContainText(
      "public domain",
    );
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("a passage across chapters makes a card for every verse", async ({ page }) => {
    await page.goto("/memorize/flashcards?p=john+1%3A50-2%3A2");
    await streamed(page);
    await expect(count(page)).toHaveText("CARD 1 OF 4");
    expect(await reference(page)).toBe("1:50");
    await next(page).click();
    await next(page).click();
    expect(await reference(page)).toBe("2:1");
  });

  test("Continue on Home returns to the flashcards", async ({ page }) => {
    await openCards(page);
    await page.goto("/");
    await streamed(page);
    const cont = page.getByRole("link", { name: /^Continue/ });
    await expect(cont).toContainText("John 1:3–6 · Flashcards");
    await expect(cont).toHaveAttribute("href", "/memorize/flashcards?p=john+1%3A3-6");
  });
});

test.describe("flashcards with music", () => {
  test.skip(({ isMobile }) => isMobile, "playback tests run once, on desktop");
  test.describe.configure({ mode: "serial" });
  const db = new TestDb();
  test.beforeAll(async ({ browser, baseURL }) => {
    await addToneRecording(browser, baseURL, db, { bookId: 35, chapter: 1 }); // Habakkuk
  });
  test.afterAll(() => db.cleanup());

  const play = (page: Page) => page.getByRole("button", { name: "Play", exact: true });
  const pause = (page: Page) => page.getByRole("button", { name: "Pause", exact: true });

  async function openHabakkuk(page: Page) {
    await page.goto("/memorize/flashcards?p=habakkuk+1%3A1-3");
    await streamed(page);
    await expect(page.getByRole("button", { name: "Genre" })).toBeEnabled();
    await expect(count(page)).toHaveText("CARD 1 OF 3");
  }

  test("flip, next, back, shuffle and restart never start the music; only Play does", async ({
    page,
  }) => {
    await openHabakkuk(page);
    await card(page).click();
    await next(page).click();
    await prev(page).click();
    await shuffle(page).click();
    await restart(page).click();
    await page.waitForTimeout(1500);
    await expect(play(page)).toBeVisible();
    await expect(pause(page)).toHaveCount(0);

    await play(page).click();
    await expect(pause(page)).toBeVisible();
  });

  test("once playing, the music follows you to the next card without stopping", async ({
    page,
  }) => {
    await openHabakkuk(page);
    await play(page).click();
    await expect(pause(page)).toBeVisible();
    await next(page).click();
    await expect(count(page)).toHaveText("CARD 2 OF 3");
    await expect(pause(page)).toBeVisible();
    await card(page).click(); // flipping does not touch the music
    await expect(pause(page)).toBeVisible();
  });
});
