import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4273';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(baseUrl);
  await page.waitForTimeout(700);

  const runtimeMode = await page.evaluate(() => document.documentElement.dataset.runtimeMode ?? null);
  const pageText = await page.locator('body').innerText();
  const normalizedPageText = pageText.toLowerCase();

  const result = {
    runtimeMode,
    showsDesktopGate:
      normalizedPageText.includes('desktop runtime required') &&
      normalizedPageText.includes('preview only'),
    explainsDesktopOnlyFlow:
      normalizedPageText.includes('open the tauri desktop app') &&
      normalizedPageText.includes('requires desktop'),
  };

  console.log(JSON.stringify({ result, pageText }, null, 2));
  await browser.close();

  if (
    result.runtimeMode !== 'browser-unsupported' ||
    !result.showsDesktopGate ||
    !result.explainsDesktopOnlyFlow
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
