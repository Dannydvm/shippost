#!/usr/bin/env node
/**
 * Test Puppeteer connection to existing Chrome profile
 *
 * Steps:
 * 1. Close any existing Chrome first
 * 2. Run: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 * 3. Then run this script
 *
 * OR just run this script - it will try to connect to existing debug port first
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');

const DEBUG_PORT = 9222;

async function test() {
  console.log('🔍 Testing Puppeteer connection to Chrome...\n');

  let browser;

  try {
    // Try connecting to existing Chrome with debug port
    console.log(`Attempting to connect to Chrome on port ${DEBUG_PORT}...`);

    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
      defaultViewport: null // Use Chrome's actual viewport
    });

    console.log('✅ Connected to Chrome!\n');

    // Get existing pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} existing tab(s)\n`);

    // Use existing tab or create new one
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Navigate to Facebook to check if logged in
    console.log('Navigating to Facebook...');
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2', timeout: 30000 });

    // Check if logged in by looking for profile elements
    const url = page.url();
    console.log(`Current URL: ${url}\n`);

    // Check for login state
    const isLoggedIn = await page.evaluate(() => {
      // Look for common logged-in indicators
      const profileLink = document.querySelector('[aria-label="Your profile"]');
      const composer = document.querySelector('[aria-label="Create a post"]');
      const fbLogo = document.querySelector('[aria-label="Facebook"]');
      const loginForm = document.querySelector('input[name="email"]');

      return {
        hasProfileLink: !!profileLink,
        hasComposer: !!composer,
        hasLogo: !!fbLogo,
        hasLoginForm: !!loginForm,
        bodyText: document.body?.innerText?.substring(0, 500) || ''
      };
    });

    if (isLoggedIn.hasLoginForm) {
      console.log('❌ Not logged in - showing login form');
      console.log('   Chrome profile cookies may not be loaded');
    } else if (isLoggedIn.hasProfileLink || isLoggedIn.hasComposer) {
      console.log('✅ LOGGED IN to Facebook!');
      console.log('   Your Chrome profile and cookies are working!');
    } else {
      console.log('🤔 Unclear login state');
      console.log('   Profile link:', isLoggedIn.hasProfileLink);
      console.log('   Composer:', isLoggedIn.hasComposer);
    }

    console.log('\n📋 Body preview:');
    console.log(isLoggedIn.bodyText.substring(0, 200) + '...\n');

    // Don't close - disconnect to leave Chrome running
    await browser.disconnect();
    console.log('✅ Disconnected (Chrome still running)\n');

    console.log('🎉 Test complete! Puppeteer can use your Chrome profile.');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n📝 To enable Chrome debugging:\n');
      console.log('1. Quit Chrome completely (Cmd+Q)');
      console.log('2. Open Terminal and run:');
      console.log(`   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${DEBUG_PORT}`);
      console.log('\n3. Then run this script again');
      console.log('\nOR run the launch script: node scripts/launch-chrome-debug.js');
    }

    process.exit(1);
  }
}

test();
