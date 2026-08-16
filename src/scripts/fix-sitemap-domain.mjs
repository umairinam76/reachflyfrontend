import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || path.resolve("apps/web/public/sitemap.xml");
if (!fs.existsSync(target)) {
  console.error(`Sitemap not found: ${target}`);
  process.exit(1);
}

const source = fs.readFileSync(target, "utf8");
const updated = source
  .replace(/https:\/\/www\.reachfly\.ai/gi, "https://www.reachflyai.com")
  .replace(/https:\/\/reachfly\.ai/gi, "https://www.reachflyai.com")
  .replace(/http:\/\/www\.reachfly\.ai/gi, "https://www.reachflyai.com")
  .replace(/http:\/\/reachfly\.ai/gi, "https://www.reachflyai.com");

if (updated === source) {
  console.log("PASS: sitemap contains no reachfly.ai URLs requiring replacement.");
} else {
  fs.writeFileSync(target, updated);
  console.log(`PASS: fixed sitemap production host in ${target}`);
}

if (/https?:\/\/(?:www\.)?reachfly\.ai(?=\/|<|$)/i.test(updated)) {
  console.error("FAIL: a reachfly.ai sitemap URL remains.");
  process.exit(2);
}
