const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const username = process.env.ODOO_USERNAME;
  const password = process.env.ODOO_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing ODOO_USERNAME or ODOO_PASSWORD in GitHub Secrets');
  }

  // ── انتظر حتى الساعة 4:12 مساءً بتوقيت الرياض بالضبط ──
  const targetHour = 16;
  const targetMinute = 12;

  const now = new Date();
  const riyadhHour = (now.getUTCHours() + 3) % 24;
  const riyadhMinute = now.getUTCMinutes();

  const waitMs = ((targetHour - riyadhHour) * 60 + (targetMinute - riyadhMinute)) * 60 * 1000;

  if (waitMs > 0 && waitMs < 90 * 60 * 1000) {
    console.log(`⏳ Waiting ${(waitMs / 60000).toFixed(1)} minutes until ${targetHour}:${String(targetMinute).padStart(2,'0')} Riyadh...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  console.log('🚀 Starting at exact time!');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  try {
    console.log('🔗 Navigating to login page...');
    await page.goto('https://admin.maqam-group.com/ar/web/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.screenshot({ path: 'screenshot_01_login_page.png', fullPage: true });

    await page.locator('#login').clear();
    await page.locator('#login').pressSequentially(username, { delay: 50 });
    await page.locator('#password').clear();
    await page.locator('#password').pressSequentially(password, { delay: 50 });
    await page.waitForTimeout(500);

    console.log('✅ Credentials filled. Clicking submit...');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
      console.warn('⚠️ networkidle timed out — continuing anyway');
    });

    console.log('📍 URL after submit:', page.url());
    await page.screenshot({ path: 'screenshot_02_after_login.png', fullPage: true });

    const loginError = await page.locator('.o_login_error, .alert-danger, [name="error"]').first().isVisible().catch(() => false);
    if (loginError) {
      const errText = await page.locator('.o_login_error, .alert-danger, [name="error"]').first().textContent().catch(() => '');
      console.error('❌ Login error:', errText.trim());
      throw new Error('Login failed — check credentials');
    }

    console.log('⏳ Waiting for dashboard...');
    await page.locator('.o_main_navbar, .o_home_menu, nav.navbar, #wrapwrap').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Dashboard loaded');
    await page.screenshot({ path: 'screenshot_03_dashboard.png', fullPage: true });

    console.log('🔍 Clicking Attendance button in systray...');
    const attendanceBtn = page.locator('.o_menu_systray i[aria-label="Attendance"]').locator('..');
    await attendanceBtn.waitFor({ state: 'visible', timeout: 15000 });
    await attendanceBtn.click({ force: true });
    console.log('✅ Clicked Attendance systray button');

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshot_04_dropdown.png', fullPage: true });

    console.log('🔍 Looking for Check-Out button...');
    const checkoutSelectors = [
      'button.btn-warning:has-text("تسجيل الخروج")',
      'button.btn-warning:has-text("Check Out")',
      'button:has-text("تسجيل الخروج")',
      'button:has-text("Check Out")',
      '.o-dropdown--menu button.btn-warning',
      '.dropdown-menu button.btn-warning',
      'button.btn-warning',
    ];

    let checkedOut = false;
    for (const sel of checkoutSelectors) {
      const el = page.locator(sel).first();
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        console.log(`✅ Found Check-Out button: ${sel}`);
        await el.click({ force: true });
        checkedOut = true;
        break;
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshot_05_final.png', fullPage: true });

    if (checkedOut) {
      console.log('🎉 Check-out successful!');
    } else {
      console.warn('⚠️ Check-out button not found');
      fs.writeFileSync('page_checkout_debug.html', await page.content());
    }

  } catch (err) {
    console.error('💥 Error:', err.message);
    await page.screenshot({ path: 'screenshot_error.png', fullPage: true }).catch(() => {});
    fs.writeFileSync('page_error.html', await page.content().catch(() => ''));
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log('✅ Done.');
})();
