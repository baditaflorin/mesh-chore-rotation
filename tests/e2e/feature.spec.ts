import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("adding people + chores on A produces identical deterministic assignments on B", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    for (const p of ["alice", "bob", "carol"]) {
      await a.getByPlaceholder("add person").fill(p);
      await a
        .locator(".rot-col")
        .filter({ hasText: "people" })
        .getByRole("button", { name: "+", exact: true })
        .click();
    }
    for (const c of ["dishes", "trash", "vacuum"]) {
      await a.getByPlaceholder("add chore").fill(c);
      await a
        .locator(".rot-col")
        .filter({ hasText: "chores" })
        .getByRole("button", { name: "+", exact: true })
        .click();
    }

    await expect(b.locator(".rot-assign")).toHaveCount(3);

    const aRows = await a.locator(".rot-assign").allInnerTexts();
    const bRows = await b.locator(".rot-assign").allInnerTexts();
    expect(bRows).toEqual(aRows);
  } finally {
    await cleanup();
  }
});

test("weekly rotation rotates AND stays peer-identical on a navigated week", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Seed the shared roster from A; it syncs to B over the mesh.
    for (const p of ["alice", "bob", "carol"]) {
      await a.getByPlaceholder("add person").fill(p);
      await a
        .locator(".rot-col")
        .filter({ hasText: "people" })
        .getByRole("button", { name: "+", exact: true })
        .click();
    }
    for (const c of ["dishes", "trash", "vacuum", "laundry", "floors"]) {
      await a.getByPlaceholder("add chore").fill(c);
      await a
        .locator(".rot-col")
        .filter({ hasText: "chores" })
        .getByRole("button", { name: "+", exact: true })
        .click();
    }
    await expect(b.locator(".rot-assign")).toHaveCount(5);

    const thisWeek = await a.locator(".rot-assign").allInnerTexts();

    // ROTATION: advance a few weeks on A; the deterministic shuffle must
    // produce a *different* assignment for at least one upcoming week,
    // otherwise "weekly rotation" is a lie (the seed would ignore the week).
    let rotated = false;
    for (let i = 0; i < 6 && !rotated; i++) {
      await a.getByRole("button", { name: "next week" }).click();
      const wk = await a.locator(".rot-assign").allInnerTexts();
      if (JSON.stringify(wk) !== JSON.stringify(thisWeek)) rotated = true;
    }
    expect(rotated).toBe(true);

    // MESH-SYNCED + DETERMINISTIC on a non-current week: navigate B to the
    // very same future week A is now showing, and assert the OPPOSITE peer
    // computes byte-identical assignments from the shared roster + week seed.
    const aWeekLabel = await a.locator(".rot-week-label strong").innerText();
    for (let i = 0; i < 12; i++) {
      const bLabel = await b.locator(".rot-week-label strong").innerText();
      if (bLabel === aWeekLabel) break;
      await b.getByRole("button", { name: "next week" }).click();
    }
    await expect(b.locator(".rot-week-label strong")).toHaveText(aWeekLabel);

    const aFuture = await a.locator(".rot-assign").allInnerTexts();
    const bFuture = await b.locator(".rot-assign").allInnerTexts();
    expect(bFuture).toEqual(aFuture);
  } finally {
    await cleanup();
  }
});

test("the shuffle is actually FAIR: chore load is balanced across people over weeks", async ({
  browser,
  baseURL,
}) => {
  // The headline is a "deterministic FAIR shuffle". With 5 chores and 3
  // people the chores don't divide evenly, so a naive fixed-index mapping
  // overloads the same people every week. Walk a full set of weeks and
  // assert nobody does more than one chore beyond anyone else.
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    for (const p of ["alice", "bob", "carol"]) {
      await a.getByPlaceholder("add person").fill(p);
      await a
        .locator(".rot-col")
        .filter({ hasText: "people" })
        .getByRole("button", { name: "+", exact: true })
        .click();
    }
    for (const c of ["dishes", "trash", "vacuum", "laundry", "floors"]) {
      await a.getByPlaceholder("add chore").fill(c);
      await a
        .locator(".rot-col")
        .filter({ hasText: "chores" })
        .getByRole("button", { name: "+", exact: true })
        .click();
    }
    await expect(b.locator(".rot-assign")).toHaveCount(5);

    const counts: Record<string, number> = { alice: 0, bob: 0, carol: 0 };
    // 12 weeks = four full 3-person rotation cycles. Tally on peer B (the
    // roster was entered on A) to also prove the fair assignment is what the
    // OTHER peer renders from the synced roster + week seed.
    for (let week = 0; week < 12; week++) {
      const people = await b.locator(".rot-assign .rot-person").allInnerTexts();
      for (const name of people) counts[name.trim()] = (counts[name.trim()] ?? 0) + 1;
      await b.getByRole("button", { name: "next week" }).click();
    }

    const loads = Object.values(counts);
    const spread = Math.max(...loads) - Math.min(...loads);
    expect(spread, `chore load per person: ${JSON.stringify(counts)}`).toBeLessThanOrEqual(1);
  } finally {
    await cleanup();
  }
});
