const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Starting browser in CI mode...");

    // =========================
    // GET LOGIN CREDENTIALS
    // =========================

    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    if (!username || !password) {
      throw new Error(
        "Missing USERNAME or PASSWORD in GitHub Secrets"
      );
    }

    // =========================
    // LOGIN
    // =========================

    console.log("Opening login page...");

    await page.goto(
      'https://admin.maqam-group.com/web/login',
      {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      }
    );

    console.log("Filling login credentials...");

    await page.fill('#login', username);
    await page.fill('#password', password);

    console.log("Clicking submit button...");

    await page.click('button[type="submit"]');

    await page.waitForURL('**/web**', {
      timeout: 60000
    });

    console.log("Login successful.");

    await page
      .waitForLoadState('networkidle', {
        timeout: 60000
      })
      .catch(() => {
        console.log(
          "Network didn't fully idle, continuing anyway..."
        );
      });

    // =========================
    // FIND ATTENDANCE BUTTON
    // =========================

    console.log("Waiting for attendance button...");

    const attendanceButton =
      page.locator('button.tt_punch');

    await attendanceButton.waitFor({
      state: 'visible',
      timeout: 30000
    });

    const buttonText = (
      await attendanceButton.innerText()
    )
      .trim()
      .toLowerCase();

    console.log(
      "Attendance button found:",
      buttonText
    );

    // =========================
    // DETECT BUTTON STATE
    // Arabic + English
    // =========================

    const isCheckIn =
      buttonText.includes('check in') ||
      buttonText.includes('تسجيل الحضور');

    const isCheckOut =
      buttonText.includes('check out') ||
      buttonText.includes('تسجيل الانصراف');

    // =========================
    // CHECK IN
    // =========================

    if (isCheckIn) {
      console.log("Check-in button detected.");

      console.log("Clicking Check in...");

      await attendanceButton.click();

      await page.waitForTimeout(3000);

      console.log(
        "Check-in completed successfully! ✅"
      );
    }

    // Already checked in
    else if (isCheckOut) {
      console.log(
        "Already checked in — nothing to do. ✅"
      );
    }

    // Unknown state
    else {
      throw new Error(
        `Unknown attendance button state: "${buttonText}"`
      );
    }

    // =========================
    // CLOSE
    // =========================

    await browser.close();

    process.exit(0);

  } catch (error) {

    // =========================
    // ERROR HANDLING
    // =========================

    console.error(
      "ERROR:",
      error.message
    );

    console.error(
      "Stack:",
      error.stack
    );

    try {
      await page.screenshot({
        path: 'screenshot_checkin_error.png',
        fullPage: true
      });

      const html = await page.content();

      fs.writeFileSync(
        'page_checkin_error.html',
        html
      );

      console.log(
        "Saved debug screenshot and HTML."
      );

    } catch (debugError) {

      console.error(
        "Could not save debug files:",
        debugError.message
      );
    }

    await browser.close();

    process.exit(1);
  }
})();
