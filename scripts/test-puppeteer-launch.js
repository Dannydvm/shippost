#!/usr/bin/env node
/**
 * Test Puppeteer with Brave using launch (not connect)
 *
 * This approach:
 * 1. Launches Brave via Puppeteer with --user-data-dir
 * 2. Uses your existing Brave profile with all sessions
 *
 * NOTE: Brave must be CLOSED before running this script!
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const USER_DATA_DIR = path.join(os.homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser');

async function test() {
  console.log('🦁 Launching Brave with Puppeteer...\n');

  // Check if Brave is running
  try {
    const result = execSync('pgrep -f "Brave Browser"', { encoding: 'utf8' });
    if (result.trim()) {
      console.log('⚠️  Brave is currently running.');
      console.log('   Please quit Brave completely (Cmd+Q) and run this script again.');
      console.log('\n   Or run: osascript -e \'tell application "Brave Browser" to quit\'');
      process.exit(1);
    }
  } catch {
    // No Brave running - good!
    console.log('✅ Brave is not running\n');
  }

  let browser;
  try {
    console.log('Launching Brave...');
    console.log(`  Executable: ${BRAVE_PATH}`);
    console.log(`  User data: ${USER_DATA_DIR}\n`);

    browser = await puppeteer.launch({
      executablePath: BRAVE_PATH,
      headless: false, // Show the browser
      userDataDir: USER_DATA_DIR,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: null
    });

    console.log('✅ Brave launched!\n');

    // Get the first page
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Navigate to Facebook
    console.log('Navigating to Facebook...');
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2', timeout: 30000 });

    const url = page.url();
    console.log(`Current URL: ${url}\n`);

    // Check login state
    const state = await page.evaluate(() => {
      const hasLoginForm = !!document.querySelector('input[name="email"]');
      const hasComposer = !!document.querySelector('[aria-label="Create a post"]');
      const pageTitle = document.title;
      const bodyPreview = document.body?.innerText?.substring(0, 300) || '';

      return { hasLoginForm, hasComposer, pageTitle, bodyPreview };
    });

    console.log('Page title:', state.pageTitle);

    if (state.hasLoginForm) {
      console.log('\n❌ Not logged in to Facebook');
      console.log('   You need to log in to FB in Brave first.');
    } else {
      console.log('\n✅ LOGGED IN to Facebook!');
      console.log('   Your sessions are preserved!');
    }

    console.log('\n📋 Body preview:');
    console.log(state.bodyPreview.substring(0, 200) + '...');

    // Keep browser open for user to see
    console.log('\n⏳ Keeping browser open for 10 seconds...');
    await new Promise(r => setTimeout(r, 10000));

    // Close
    await browser.close();
    console.log('\n✅ Browser closed. Test complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

test();
