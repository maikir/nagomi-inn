import { chromium, devices } from "playwright";
// Chrome with autoplay HARD-BLOCKED — reproduces iOS Low Power Mode behavior
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=user-gesture-required"],
});
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto("http://localhost:3131", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const before = await page.$$eval("video", (els) => els.map((v) => ({ paused: v.paused, t: +v.currentTime.toFixed(2) })));
console.log("autoplay blocked, before gesture:", JSON.stringify(before));

// simulate the user's first tap anywhere
await page.touchscreen.tap(200, 400);
await page.waitForTimeout(2000);
const after = await page.$$eval("video", (els) => els.map((v) => ({ paused: v.paused, t: +v.currentTime.toFixed(2), opacity: getComputedStyle(v).opacity })));
console.log("after one tap:", JSON.stringify(after));
await browser.close();
