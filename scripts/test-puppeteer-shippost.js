#!/usr/bin/env node
/**
 * Test Puppeteer with Chrome using danny@dannyveiga.com profile
 *
 * Approach: Launch Chrome manually with debug port, then connect Puppeteer.
 * This works better with existing profiles.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_DATA_DIR = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
const DEBUG_PORT = 9222;

async function waitForDebugPort(maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function test() {
  console.log('🚀 Testing Puppeteer with Chrome (danny@dannyveiga.com)...\n');

  // Check if Chrome debug port is available
  let debugPortReady = await waitForDebugPort(1000);

  if (!debugPortReady) {
    // Kill any existing Chrome first
    console.log('Killing any existing Chrome processes...');
    try {
      execSync('pkill -9 -f "Google Chrome"', { encoding: 'utf8' });
      await new Promise(r => setTimeout(r, 2000));
    } catch {}

    // Launch Chrome with debug port
    console.log('Launching Chrome with debug port...');
    console.log(`  Profile: Default (danny@dannyveiga.com)`);
    console.log(`  Debug port: ${DEBUG_PORT}\n`);

    const chrome = spawn(CHROME_PATH, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${CHROME_DATA_DIR}`,
      '--profile-directory=Default',
      '--no-first-run'
    ], {
      detached: true,
      stdio: 'ignore'
    });
    chrome.unref();

    // Wait for debug port
    console.log('Waiting for Chrome to start...');
    debugPortReady = await waitForDebugPort(15000);

    if (!debugPortReady) {
      console.error('❌ Chrome failed to start with debug port.');
      console.log('\nTry running Chrome manually:');
      console.log(`  "${CHROME_PATH}" --remote-debugging-port=${DEBUG_PORT}`);
      process.exit(1);
    }
  }

  console.log('✅ Chrome debug port ready!\n');

  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
      defaultViewport: null
    });

    console.log('✅ Puppeteer connected!\n');

    // Get existing pages or create new
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Navigate to Facebook
    console.log('Navigating to Facebook...');
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2', timeout: 30000 });

    const url = page.url();
    console.log(`Current URL: ${url}\n`);

    // Check login state
    const state = await page.evaluate(() => {
      const hasLoginForm = !!document.querySelector('input[name="email"]');
      const hasComposer = !!document.querySelector('[aria-label="Create a post"]');
      const hasProfilePic = !!document.querySelector('[aria-label="Your profile"]');
      const pageTitle = document.title;

      return { hasLoginForm, hasComposer, hasProfilePic, pageTitle };
    });

    console.log('Page title:', state.pageTitle);

    if (state.hasLoginForm) {
      console.log('\n❌ Not logged in to Facebook');
      console.log('   Please log in to Facebook in this Chrome profile first.');
    } else if (state.hasComposer || state.hasProfilePic) {
      console.log('\n✅ LOGGED IN to Facebook!');
      console.log('   ShipPost is ready for FB automation!');
    } else {
      console.log('\n🤔 Unclear state - check the Chrome window');
    }

    // Disconnect but leave Chrome running
    await browser.disconnect();
    console.log('\n✅ Test complete! Chrome is still running.');
    console.log('   You can continue using Chrome normally.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (browser) await browser.disconnect();
    process.exit(1);
  }
}

test();
