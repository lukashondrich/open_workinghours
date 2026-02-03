const { remote } = require('webdriverio');

(async () => {
  const driver = await remote({
    hostname: '127.0.0.1', port: 4723,
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone',
      'appium:udid': '17155022-31BA-462E-8E97-585A01DE1ABB',
      'appium:bundleId': 'com.openworkinghours.mobileapp',
      'appium:noReset': true,
      'appium:newCommandTimeout': 120,
    }
  });

  // Dismiss notification alert if present
  try {
    const alertText = await driver.getAlertText();
    console.log('Found alert:', alertText.substring(0, 50));
    await driver.acceptAlert();
    console.log('Dismissed alert');
    await driver.pause(500);
  } catch(e) { console.log('No initial alert'); }

  // Find login button
  const loginBtn = await driver.$('~login-button');
  const loginVisible = await loginBtn.isDisplayed();
  console.log('login-button visible:', loginVisible);

  if (!loginVisible) {
    console.log('No login button, dumping page...');
    const source = await driver.getPageSource();
    const names = source.match(/name="[^"]*"/g) || [];
    console.log('Elements:', names.slice(0,20).join(', '));
    await driver.deleteSession();
    return;
  }

  await loginBtn.click();
  console.log('Clicked login');
  await driver.pause(1000);

  // Enter email
  const emailInput = await driver.$('~email-input');
  await emailInput.waitForDisplayed({ timeout: 5000 });
  await emailInput.setValue('test@example.com');
  console.log('Entered email');

  // DISMISS KEYBOARD - tap somewhere neutral
  try {
    // Tap on the header area to dismiss keyboard
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: 200, y: 200 }).down().up().perform();
    console.log('Tapped to dismiss keyboard');
  } catch(e) { console.log('Keyboard dismiss failed:', e.message.substring(0, 50)); }
  await driver.pause(500);

  // Check if send-code-button is displayed
  const sendBtn = await driver.$('~send-code-button');
  const sendVisible = await sendBtn.isDisplayed();
  console.log('send-code-button visible:', sendVisible);

  // Get its location
  const loc = await sendBtn.getLocation();
  const size = await sendBtn.getSize();
  console.log('send-code-button location:', JSON.stringify(loc), 'size:', JSON.stringify(size));

  // Click it
  await sendBtn.click();
  console.log('Clicked send code');

  // Wait longer for alert
  await driver.pause(3000);

  // Try to get alert
  try {
    const alertText = await driver.getAlertText();
    console.log('Alert after send:', alertText.substring(0, 80));
    await driver.acceptAlert();
    console.log('Alert dismissed!');
  } catch(e) {
    console.log('No alert found after send:', e.message.substring(0, 80));
  }

  await driver.pause(500);

  // Check for code-input
  const codeInput = await driver.$('~code-input');
  try {
    await codeInput.waitForDisplayed({ timeout: 5000 });
    console.log('code-input FOUND!');
  } catch(e) {
    console.log('code-input NOT found');
    const source = await driver.getPageSource();
    const names = source.match(/name="[^"]*"/g) || [];
    console.log('Elements:', names.slice(0,20).join(', '));
  }

  await driver.deleteSession();
})().catch(e => console.error('Script failed:', e.message));
