#!/usr/bin/env node
/**
 * Setup Facebook session in ShipPost Chrome profile
 *
 * This script opens Chrome with the ShipPost profile.
 * Log into Facebook once, and the session will be saved for automation.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const os = require('os');
const path = require('path');
const readline = require('readline');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHIPPOST_PROFILE = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/ShipPost');

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function setup() {
  console.log('🔐 ShipPost Facebook Session Setup\n');
  console.log('This will open Chrome. Please log into Facebook.');
  console.log('Your session will be saved for ShipPost automation.\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      userDataDir: SHIPPOST_PROFILE,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized'
      ],
      defaultViewport: null
    });

    const page = (await browser.pages())[0] || await browser.newPage();

    // Go to Facebook
    console.log('Opening Facebook...');
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });

    // Check if already logged in
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="email"]');
    });

    if (isLoggedIn) {
      console.log('\n✅ Already logged in to Facebook!');
      console.log('   Session is ready for ShipPost.\n');
    } else {
      console.log('\n📝 Please log into Facebook in the browser window.');
      console.log('   After logging in successfully, press Enter here...\n');
      await prompt('Press Enter when logged in: ');

      // Verify login
      await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });
      const nowLoggedIn = await page.evaluate(() => {
        return !document.querySelector('input[name="email"]');
      });

      if (nowLoggedIn) {
        console.log('\n✅ Facebook session saved!');
      } else {
        console.log('\n⚠️  Still not logged in. Please try again.');
      }
    }

    // Also set up FB Groups access - open a group to ensure cookies are set
    console.log('\n📘 Opening FB Groups to ensure group access...');
    await page.goto('https://www.facebook.com/groups/feed/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n✅ Setup complete! ShipPost can now post to FB.');
    console.log('   Run `node scripts/test-puppeteer-shippost.js` to verify.\n');

    await browser.close();

  } catch (error) {
    console.error('Error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

setup();
