import { webkit as chromium, devices } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const out = process.env.SCRATCH;
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
await page.goto("http://localhost:3131", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const state = await page.$$eval("video", (els) =>
  els.map((v) => ({
    src: v.getAttribute("src"),
    paused: v.paused,
    currentTime: +v.currentTime.toFixed(2),
    readyState: v.readyState,
    muted: v.muted,
    autoplay: v.autoplay,
    error: v.error ? v.error.code : null,
    opacity: getComputedStyle(v).opacity,
  })),
);
console.log("mobile webkit:", JSON.stringify(state, null, 1));
await page.waitForTimeout(2000);
const advancing = await page.$$eval("video", (els) => els.map((v) => +v.currentTime.toFixed(2)));
console.log("currentTime after 2s more:", advancing);
await page.screenshot({ path: out + "/S2-mobile-webkit.png" });
await browser.close();
