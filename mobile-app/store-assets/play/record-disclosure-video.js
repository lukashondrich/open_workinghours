/* Drive the disclosure flow while screen-recording (emulator or phone).
 * Demo review account (prod bypass) — no real mailbox needed.
 * NO adb permission pre-grants: the OS dialogs must appear ON CAMERA. */
process.chdir('/Users/user01/open_workinghours/mobile-app/e2e');
const { execSync, spawn } = require('child_process');
const { createDriver } = require('/Users/user01/open_workinghours/mobile-app/e2e/helpers/driver');
const { byTestId, byText, byAlertButtonText } = require('/Users/user01/open_workinghours/mobile-app/e2e/helpers/selectors');

const DEV = process.env.ANDROID_DEVICE || 'emulator-5554';
const PKG = 'com.openworkinghours.mobileapp';
const sh = (c) => execSync(`adb -s ${DEV} shell ${c}`, { encoding: 'utf8' });

const tap = async (driver, testId, timeout = 15000) => {
  const el = await byTestId(driver, testId);
  await el.waitForExist({ timeout });
  await el.click();
};
const exists = async (driver, testId) => {
  try { return await (await byTestId(driver, testId)).isExisting(); } catch { return false; }
};
const tapPermissionAllow = async (driver) => {
  for (const id of [
    'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
    'com.android.permissioncontroller:id/permission_allow_button',
  ]) {
    try {
      const b = await driver.$(`android=new UiSelector().resourceId("${id}")`);
      if (await b.isExisting()) { await b.click(); return true; }
    } catch { /* next */ }
  }
  return false;
};

(async () => {
  const driver = await createDriver('android');
  let rec = null;
  try {
    await driver.pause(1500);
    sh('settings put system show_touches 1');

    // Unrecorded warm-up launch: absorb the slow cold start (post-install /
    // post-GMS-clear inits can take 30s+), then restart warm for the take
    await driver.activateApp(PKG);
    for (let i = 0; i < 60; i++) {
      if (await exists(driver, 'email-signin-button')) break;
      await driver.pause(1000);
    }
    sh(`am force-stop ${PKG}`);
    await driver.pause(1200);

    rec = spawn('adb', ['-s', DEV, 'shell', 'screenrecord', '--time-limit', '178',
      '--bit-rate', '8000000', '/sdcard/owh-auto.mp4'], { stdio: 'ignore', detached: true });
    await driver.pause(1500);

    await driver.activateApp(PKG);
    await driver.pause(4000); // warm start

    await tap(driver, 'email-signin-button', 30000);
    await driver.pause(1200);
    const email = await byTestId(driver, 'email-input');
    await email.waitForExist({ timeout: 10000 });
    await email.setValue('demo@openworkinghours.org');
    await driver.pause(600);
    await tap(driver, 'send-code-button');
    await driver.pause(2500);
    try { const ok = await byAlertButtonText(driver, 'OK'); if (await ok.isExisting()) await ok.click(); } catch {}
    await driver.pause(800);
    const code = await byTestId(driver, 'code-input');
    await code.waitForExist({ timeout: 10000 });
    await code.setValue('123456');
    await driver.pause(600);
    await tap(driver, 'login-button');
    await driver.pause(5000);

    await tap(driver, 'add-workplace-button', 20000);
    await driver.pause(2500);

    if (await exists(driver, 'setup-foreground-primer-enable')) {
      await tap(driver, 'setup-foreground-primer-enable');
      await driver.pause(2500);
      await tapPermissionAllow(driver);
      await driver.pause(4000);
    }

    // Defensive: dismiss the app's "Location Unavailable" alert if the GPS
    // fix was slow (modal otherwise eats all subsequent input)
    try {
      const ok = await byAlertButtonText(driver, 'OK');
      if (await ok.isExisting()) { await ok.click(); await driver.pause(1000); }
    } catch { /* no alert */ }

    if (await exists(driver, 'setup-search-input')) {
      const s = await byTestId(driver, 'setup-search-input');
      await s.click();
      await driver.pause(500);
      await s.setValue('Charité Berlin');
      await driver.pause(1000);
      // verify the text actually committed; retype if not
      try {
        const txt = await s.getText();
        if (!txt || txt.length < 3) { await s.setValue('Charité Berlin'); }
      } catch { /* ignore */ }
      // wait up to 8s for geocoding results
      let gotResult = false;
      for (let i = 0; i < 8; i++) {
        if (await exists(driver, 'setup-search-result-0')) { gotResult = true; break; }
        await driver.pause(1000);
      }
      if (gotResult) {
        await tap(driver, 'setup-search-result-0');
        await driver.pause(2000);
      } else {
        // fallback: tap the map OFF-CENTER — the "Tap map to place pin"
        // hint pill floats at dead center and eats centered taps
        const { width, height } = await driver.getWindowSize();
        await driver.action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: Math.round(width * 0.5), y: Math.round(height * 0.42) }).down().pause(80).up().perform();
        await driver.pause(2000);
      }
      await tap(driver, 'setup-continue-step1');
      await driver.pause(1500);
    }
    await tap(driver, 'setup-continue-step2', 15000);
    await driver.pause(1500);

    const name = await byTestId(driver, 'setup-name-input');
    await name.waitForExist({ timeout: 10000 });
    await name.setValue('Klinikum');
    await driver.pause(800);
    await tap(driver, 'setup-save-button', 10000);
    await driver.pause(2500);

    if (await exists(driver, 'setup-background-primer-enable')) {
      await tap(driver, 'setup-background-primer-enable');
      await driver.pause(3000);
      for (const label of ['Immer zulassen', 'Allow all the time']) {
        try {
          const opt = await byText(driver, label);
          if (await opt.isExisting()) { await opt.click(); break; }
        } catch { /* next */ }
      }
      await driver.pause(2500);
      await driver.back();
      await driver.pause(3000);
    }

    if (await exists(driver, 'setup-notification-primer-enable')) {
      await tap(driver, 'setup-notification-primer-enable');
      await driver.pause(2000);
      await tapPermissionAllow(driver);
      await driver.pause(2000);
    }

    // Wait for the post-save navigation to Status (the save triggers an
    // immediate auto-check-in attempt and can spin for a while), then hold
    // so the finale — saved workplace on the Status screen — is on tape
    for (let i = 0; i < 40; i++) {
      if (await exists(driver, 'tab-status')) break;
      await driver.pause(1000);
    }
    await driver.pause(6000);
    console.log('FLOW COMPLETE');
  } catch (e) {
    console.error('FLOW ERROR:', e.message.split('\n')[0]);
  } finally {
    try { sh('killall -2 screenrecord'); } catch {}
    await new Promise(r => setTimeout(r, 2500));
    try { rec && rec.kill(); } catch {}
    try { sh('settings put system show_touches 0'); } catch {}
    try { await driver.deleteSession(); } catch {}
  }
})();
