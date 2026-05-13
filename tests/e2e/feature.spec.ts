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
