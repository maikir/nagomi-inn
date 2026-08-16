import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 1440, height: 400 }, deviceScaleFactor: 3 });
await page.goto("http://localhost:3142", { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: process.env.SCRATCH + "/X2-nav-centered.png", clip: { x: 90, y: 8, width: 320, height: 72 } });
await browser.close();
console.log("ok");
