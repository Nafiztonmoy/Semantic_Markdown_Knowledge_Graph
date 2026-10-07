import { test, expect } from "@playwright/test";

test.describe("NexusDocs Core User Journeys", () => {
  test("1. Homepage renders hero and launch button", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/NexusDocs/);
    await expect(page.getByText("Good knowledge")).toBeVisible();
    await expect(page.getByRole("button", { name: /Launch Acme Engineering Demo/i })).toBeVisible();
  });

  test("2. Demo login and workspace dashboard navigation", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();

    // Click demo admin autofill
    await page.getByRole("button", { name: /Admin \(Owner\)/i }).click();

    // Submit sign in
    await page.getByRole("button", { name: "Sign In" }).click();

    // Verify redirected to dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Acme Engineering" })).toBeVisible();
    await expect(page.getByText("Knowledge Graph Nodes")).toBeVisible();
  });

  test("3. Document library and document detail view", async ({ page }) => {
    // Login as admin
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin \(Owner\)/i }).click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(/.*dashboard/);

    // Navigate to Documents
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await page.waitForURL(/.*documents/);
    await expect(page.getByText("Document Library")).toBeVisible();
    await expect(page.getByText("System Architecture").first()).toBeVisible();

    // Open System Architecture document
    await page.getByText("System Architecture").first().click();
    await page.waitForURL(/.*documents\/.+/);

    // Verify CodeMirror editor and preview
    await expect(page.getByText("MARKDOWN SOURCE")).toBeVisible();
    await expect(page.getByText("RENDERED PREVIEW")).toBeVisible();
  });

  test("4. Hybrid search query and result retrieval", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin \(Owner\)/i }).click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(/.*dashboard/);

    // Navigate to Search
    await page.getByRole("link", { name: "Hybrid Search" }).click();
    await page.waitForURL(/.*search/);
    await expect(page.getByText("Hybrid Semantic Search")).toBeVisible();

    // Execute search query
    const input = page.getByPlaceholder(/Search across documents/i);
    await input.fill("pgvector indexing strategy");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    // Verify search items returned
    await expect(page.getByText(/Found \d+ result/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/RRF:/i).first()).toBeVisible();
  });

  test("5. Knowledge graph interactive canvas", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin \(Owner\)/i }).click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(/.*dashboard/);

    // Navigate to Knowledge Graph
    await page.getByRole("link", { name: "Knowledge Graph" }).click();
    await page.waitForURL(/.*graph/);
    await expect(page.getByText("Graph Controls")).toBeVisible();
    await expect(page.getByText("Wiki Links")).toBeVisible();
    await expect(page.getByText("Semantic Similarity")).toBeVisible();
  });

  test("6. Citation-First RAG assistant question and citations", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin \(Owner\)/i }).click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(/.*dashboard/);

    // Navigate to AI Assistant
    await page.getByRole("link", { name: "AI Assistant" }).click();
    await page.waitForURL(/.*ask/);
    await expect(page.getByRole("heading", { name: "AI Assistant", exact: true })).toBeVisible();

    // Click sample question
    const sampleBtn = page.getByRole("button", { name: /What database and vector indexing strategy/i });
    if (await sampleBtn.isVisible()) {
      await sampleBtn.click();
    } else {
      const qInput = page.getByPlaceholder(/Ask a question/i);
      await qInput.fill("What database and vector indexing strategy does NexusDocs use?");
      await page.keyboard.press("Enter");
    }

    // Verify citation response card appears
    await expect(page.getByRole("heading", { name: /Sources \(/ })).toBeVisible({ timeout: 15000 });
  });
});
