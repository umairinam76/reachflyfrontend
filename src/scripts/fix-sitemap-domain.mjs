import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CANONICAL_ORIGIN = "https://www.reachflyai.com";
const REACHFLY_HOST = /https?:\/\/(?:www\.)?(?:reachfly\.ai|reachflyai\.com)(?=\/|<|\s|$)/gi;
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const explicitTarget = args.find((value) => !value.startsWith("--"));
const target = explicitTarget ? path.resolve(explicitTarget) : findDefaultSitemap();

if (!target || !fs.existsSync(target)) {
  console.error(`FAIL: sitemap not found${target ? `: ${target}` : ". Pass a sitemap.xml path explicitly."}`);
  process.exit(1);
}

if (!fs.statSync(target).isFile()) {
  console.error(`FAIL: sitemap target is not a file: ${target}`);
  process.exit(1);
}

const source = fs.readFileSync(target, "utf8");
if (!source.trim() || !/<urlset\b|<sitemapindex\b/i.test(source)) {
  console.error(`FAIL: target does not look like a sitemap XML file: ${target}`);
  process.exit(2);
}

const updated = source.replace(REACHFLY_HOST, CANONICAL_ORIGIN);
const issues = validate(updated);
if (issues.length) {
  issues.forEach((issue) => console.error(`FAIL: ${issue}`));
  process.exit(3);
}

if (updated === source) {
  console.log(`PASS: sitemap already uses ${CANONICAL_ORIGIN}`);
  console.log(`FILE: ${target}`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`FAIL: sitemap contains non-canonical ReachFly URLs. Run without --check to update ${target}`);
  process.exit(4);
}

writeAtomically(target, updated);
console.log(`PASS: canonicalized ReachFly sitemap URLs to ${CANONICAL_ORIGIN}`);
console.log(`FILE: ${target}`);

function findDefaultSitemap() {
  return [
    path.resolve("public/sitemap.xml"),
    path.resolve("apps/web/public/sitemap.xml"),
    path.resolve("web/public/sitemap.xml"),
  ].find((candidate) => fs.existsSync(candidate)) || null;
}

function validate(value) {
  const issues = [];
  if (/https?:\/\/(?:www\.)?reachfly\.ai(?=\/|<|\s|$)/i.test(value)) issues.push("a reachfly.ai URL remains");
  if (/http:\/\/(?:www\.)?reachflyai\.com(?=\/|<|\s|$)/i.test(value)) issues.push("an insecure ReachFly URL remains");
  if (/https:\/\/reachflyai\.com(?=\/|<|\s|$)/i.test(value)) issues.push("a non-www canonical ReachFly URL remains");
  return issues;
}

function writeAtomically(filePath, contents) {
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(temporary, contents, "utf8");
  try {
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}
