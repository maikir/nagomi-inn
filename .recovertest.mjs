import { webkit, devices } from "playwright";
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto("http://localhost:3131", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

// Force the "autoplay was blocked" state: video sits paused at t=0
await page.evaluate(() => document.querySelectorAll("video").forEach((v) => { v.pause(); v.currentTime = 0; }));
await page.waitForTimeout(500);
console.log("forced-blocked state:", JSON.stringify(await page.$$eval("video", (els) => els.map((v) => ({ paused: v.paused, t: +v.currentTime.toFixed(1) })))));

// The user's first real interaction: a touch
await page.touchscreen.tap(200, 500);
await page.waitForTimeout(1500);
console.log("after tap:", JSON.stringify(await page.$$eval("video", (els) => els.map((v) => ({ paused: v.paused, t: +v.currentTime.toFixed(1) })))));

// Also verify a scroll alone recovers it
await page.evaluate(() => document.querySelectorAll("video").forEach((v) => v.pause()));
await page.mouse.wheel(0, 80);
await page.waitForTimeout(1200);
console.log("after scroll:", JSON.stringify(await page.$$eval("video", (els) => els.map((v) => ({ paused: v.paused, t: +v.currentTime.toFixed(1) })))));
await browser.close();
