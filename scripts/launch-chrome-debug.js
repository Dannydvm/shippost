#!/usr/bin/env node
/**
 * Launch Chrome with remote debugging enabled
 *
 * This uses your existing Chrome profile so you stay logged into FB, etc.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

const DEBUG_PORT = 9222;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Default Chrome user data location on macOS
const USER_DATA_DIR = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

async function checkExistingChrome() {
  try {
    // Check if Chrome is already running with debug port
    const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Chrome is already running with debug port!');
      console.log(`   Browser: ${data.Browser}`);
      return true;
    }
  } catch (e) {
    return false;
  }
}

async function launch() {
  console.log('🚀 Chrome Debug Launcher\n');

  // Check if already running
  if (await checkExistingChrome()) {
    console.log('\n   Ready to use with Puppeteer!');
    console.log('   Run: node scripts/test-puppeteer-chrome.js');
    return;
  }

  // Check if Chrome is running without debug port
  try {
    const result = execSync('pgrep -f "Google Chrome"', { encoding: 'utf8' });
    if (result.trim()) {
      console.log('⚠️  Chrome is running but without debug port.');
      console.log('   Please quit Chrome (Cmd+Q) and run this script again.');
      console.log('\n   Or manually launch with:');
      console.log(`   "${CHROME_PATH}" --remote-debugging-port=${DEBUG_PORT}`);
      process.exit(1);
    }
  } catch (e) {
    // pgrep returns error if no process found - that's fine
  }

  console.log('Launching Chrome with remote debugging...\n');
  console.log(`  Port: ${DEBUG_PORT}`);
  console.log(`  User data: ${USER_DATA_DIR}\n`);

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    // Don't need --user-data-dir if using default profile
    // Chrome will use default location automatically
  ], {
    detached: true,
    stdio: 'ignore'
  });

  chrome.unref();

  // Wait a bit for Chrome to start
  console.log('Waiting for Chrome to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verify it's running
  if (await checkExistingChrome()) {
    console.log('\n🎉 Chrome launched successfully!');
    console.log('\n   Test it with: node scripts/test-puppeteer-chrome.js');
  } else {
    console.log('\n❌ Chrome may not have started with debug port.');
    console.log('   Try quitting all Chrome instances and running again.');
  }
}

launch().catch(console.error);
