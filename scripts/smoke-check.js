// Checks a deployed site, reading only: it never signs in and never writes.
//
// Usage: node scripts/smoke-check.js dev
//        node scripts/smoke-check.js pilot
//
// It checks that every page loads with the "Need help now" button, that
// the site talks to the right project, that the model check is off on the
// pilot, that the site is running the code in this folder, and that
// scripts are served with no-cache (so a safety fix reaches everyone at
// once).

const fs = require('fs');
const path = require('path');
const { readConfig } = require('./deploy-checks.js');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// Tries up to 3 times, 2 seconds apart, so one dropped connection doesn't
// count as the site being down. A real outage still fails.
async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      return { status: response.status, text: await response.text(), cacheControl: response.headers.get('cache-control') || '' };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`Could not reach ${url} after 3 tries (${lastError.message}).`);
}

async function main() {
  const target = process.argv[2];
  const projectId = JSON.parse(fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8')).projects[target];
  if (!projectId) throw new Error(`Unknown target "${target}". Use dev or pilot.`);
  const base = `https://${projectId}.web.app/`;
  const problems = [];
  const ok = [];

  // Every page loads, with "Need help now" (NFR 5).
  const pages = fs.readdirSync(PUBLIC).filter((file) => file.endsWith('.html'));
  for (const page of pages) {
    const { status, text } = await fetchText(base + page);
    if (status !== 200) problems.push(`${page} answered ${status}`);
    else if (!text.includes('js/crisis-card.js')) problems.push(`${page} has no "Need help now" script`);
  }
  if (!problems.length) ok.push(`all ${pages.length} pages load with "Need help now"`);

  // The site talks to the right project.
  const config = readConfig((await fetchText(base + 'js/firebase-config.js')).text);
  if (config.projectId !== projectId) problems.push(`the site's config is for "${config.projectId}", not "${projectId}"`);
  else ok.push(`the site talks to ${projectId}`);
  if (target === 'pilot' && config.modelCheckEnabled) problems.push('the model check is switched on in the pilot');

  // The site runs the code in this folder.
  for (const file of ['js/auth.js', 'js/screening.js', 'privacy.html']) {
    const live = (await fetchText(base + file)).text.replace(/\r\n/g, '\n');
    const local = fs.readFileSync(path.join(PUBLIC, file), 'utf8').replace(/\r\n/g, '\n');
    if (live !== local) problems.push(`the live ${file} is not the same as this folder's`);
  }
  if (!problems.some((problem) => problem.startsWith('the live'))) ok.push('the live site matches this folder');

  // Scripts are not cached, so safety fixes reach everyone at once.
  const script = await fetchText(base + 'js/screening.js');
  if (!/no-cache/.test(script.cacheControl)) problems.push(`scripts are served with "${script.cacheControl}", not no-cache`);
  else ok.push('scripts are served with no-cache');

  ok.forEach((line) => console.log('OK   ' + line));
  problems.forEach((line) => console.log('FAIL ' + line));
  if (problems.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
