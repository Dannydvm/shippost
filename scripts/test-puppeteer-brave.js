#!/usr/bin/env node
/**
 * Test Puppeteer connection to Brave Browser
 *
 * Brave is Chromium-based, so it works the same as Chrome.
 * Uses the Default profile with all your FB sessions.
 *
 * Steps:
 * 1. Quit Brave completely (Cmd+Q)
 * 2. Run this script - it will launch Brave with debug port
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');

const DEBUG_PORT = 9223; // Use different port from Chrome
const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const USER_DATA_DIR = path.join(os.homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser');

async function checkBraveDebugPort() {
  try {
    const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

async function test() {
  console.log('🦁 Testing Puppeteer connection to Brave...\n');

  // Check if Brave is already running with debug port
  const alreadyRunning = await checkBraveDebugPort();

  if (!alreadyRunning) {
    // Check if Brave is running without debug port
    try {
      const result = execSync('pgrep -f "Brave Browser"', { encoding: 'utf8' });
      if (result.trim()) {
        console.log('⚠️  Brave is running but without debug port.');
        console.log('   Quitting Brave and relaunching with debug port...\n');
        execSync('osascript -e \'tell application "Brave Browser" to quit\'');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch {
      // No Brave running, that's fine
    }

    console.log('Launching Brave with remote debugging...');
    console.log(`  Port: ${DEBUG_PORT}`);
    console.log(`  User data: ${USER_DATA_DIR}\n`);

    spawn(BRAVE_PATH, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`
    ], {
      detached: true,
      stdio: 'ignore'
    }).unref();

    // Wait for Brave to start
    console.log('Waiting for Brave to start...');
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await checkBraveDebugPort()) {
        console.log('✅ Brave started!\n');
        break;
      }
    }
  } else {
    console.log('✅ Brave already running with debug port!\n');
  }

  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
      defaultViewport: null
    });

    console.log('✅ Connected to Brave!\n');

    // Get existing pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} existing tab(s)\n`);

    // Create new tab or use existing
    const page = await browser.newPage();

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

      return { hasLoginForm, hasComposer, pageTitle };
    });

    if (state.hasLoginForm) {
      console.log('❌ Not logged in to Facebook');
      console.log('   Page title:', state.pageTitle);
      console.log('\n   You may need to log in to FB in Brave first.');
    } else {
      console.log('✅ LOGGED IN to Facebook!');
      console.log('   Page title:', state.pageTitle);
      console.log('\n   Your Brave profile and cookies are working!');
    }

    // Take screenshot for verification
    await page.screenshot({ path: '/tmp/brave-fb-test.png' });
    console.log('\n📸 Screenshot saved to /tmp/brave-fb-test.png');

    // Disconnect (leave Brave running)
    await browser.disconnect();
    console.log('\n✅ Disconnected (Brave still running)');
    console.log('\n🎉 Puppeteer + Brave test complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) await browser.disconnect();
    process.exit(1);
  }
}

test();
