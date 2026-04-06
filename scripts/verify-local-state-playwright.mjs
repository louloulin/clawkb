import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(baseUrl);
  await page.waitForTimeout(600);
  const navButtons = page.locator('aside nav button');

  await navButtons.nth(3).click();
  await page.waitForTimeout(400);
  await page.getByRole('tab', { name: 'Import' }).click();
  await page.waitForTimeout(400);

  await navButtons.nth(2).click();
  await page.waitForTimeout(400);

  await page.getByRole('tab', { name: 'Draft' }).click();
  await page.waitForTimeout(400);
  const draftTitleInput = page.getByPlaceholder('Document title...');
  await draftTitleInput.fill('Persistent Draft');

  await page.reload();
  await page.waitForTimeout(700);

  await navButtons.nth(3).click();
  await page.waitForTimeout(400);

  await navButtons.nth(2).click();
  await page.waitForTimeout(400);
  const restoredDraftInput = page.getByPlaceholder('Document title...');
  if (!(await restoredDraftInput.isVisible())) {
    await page.getByRole('tab', { name: 'Draft' }).click();
    await page.waitForTimeout(400);
  }

  const restoredDraftTitle = await page.getByPlaceholder('Document title...').inputValue();

  const postReloadText = await page.locator('main').innerText();
  const localStorageSnapshot = await page.evaluate(() => ({
    lastKb: localStorage.getItem('clawkb-last-kb-path'),
    workspace: localStorage.getItem('clawkb-workspace'),
    draft: localStorage.getItem('clawkb-document-workspace'),
  }));
  const workspaceState = localStorageSnapshot.workspace ? JSON.parse(localStorageSnapshot.workspace) : null;
  const draftState = localStorageSnapshot.draft ? JSON.parse(localStorageSnapshot.draft) : null;

  const result = {
    kbRestored: postReloadText.includes('clawkb-demo'),
    workspaceRestored: workspaceState?.state?.activeExploreView === 'import',
    draftRestored: restoredDraftTitle === 'Persistent Draft' && draftState?.state?.activeTab === 'draft',
    localStateKeysPresent:
      localStorageSnapshot.lastKb !== null &&
      localStorageSnapshot.workspace !== null &&
      localStorageSnapshot.draft !== null,
  };

  console.log(JSON.stringify({ result, localStorageSnapshot }, null, 2));
  await browser.close();

  if (!result.kbRestored || !result.workspaceRestored || !result.draftRestored || !result.localStateKeysPresent) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
