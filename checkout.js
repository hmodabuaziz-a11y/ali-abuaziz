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

    // =========================
    // WAIT FOR PAGE
    // =========================

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

    // =========================
    // READ BUTTON TEXT
    // =========================

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
    // DETECT CHECK-IN
    // =========================

    const isCheckIn =
      buttonText.includes('check in') ||
      buttonText.includes('تسجيل الحضور');

    // =========================
    // DETECT CHECK-OUT
    // =========================

    const isCheckOut =
      buttonText.includes('check out') ||
      buttonText.includes('تسجيل الخروج') ||
      buttonText.includes('تسجيل الانصراف');

    // =========================
    // CHECK OUT
    // =========================

    if (isCheckOut) {

      console.log(
        "Check-out button detected."
      );

      console.log(
        "Clicking Check out..."
      );

      await attendanceButton.click();

      // Wait for website to process
      await page.waitForTimeout(3000);

      console.log(
        "Check-out completed successfully! ✅"
      );

    }

    // =========================
    // ALREADY CHECKED OUT
    // =========================

    else if (isCheckIn) {

      console.log(
        "Already checked out — nothing to do. ✅"
      );

    }

    // =========================
    // UNKNOWN BUTTON
    // =========================

    else {

      throw new Error(
        `Unknown attendance button state: "${buttonText}"`
      );

    }

    // =========================
    // FINISH
    // =========================

    console.log("Closing browser...");

    await browser.close();

    console.log(
      "Checkout script finished successfully."
    );

    process.exit(0);

  } catch (error) {

    // =========================
    // ERROR
    // =========================

    console.error(
      "ERROR:",
      error.message
    );

    console.error(
      "Stack:",
      error.stack
    );

    // =========================
    // SAVE DEBUG FILES
    // =========================

    try {

      await page.screenshot({
        path: 'screenshot_checkout_error.png',
        fullPage: true
      });

      const html =
        await page.content();

      fs.writeFileSync(
        'page_checkout_error.html',
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

    // =========================
    // CLOSE AFTER ERROR
    // =========================

    await browser.close();

    process.exit(1);
  }
})();
