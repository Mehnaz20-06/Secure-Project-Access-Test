// @ts-check
const { test, expect } = require('@playwright/test');

// State is held in-memory on the server and shared across all tests, so we
// run this file serially and reset state at the start.
test.describe.configure({ mode: 'serial' });

async function resetServer(request, baseURL) {
  await request.post(`${baseURL}/api/__reset`);
}

async function login(page, email, password = '123456') {
  await page.goto('/');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#dashboard-view')).toBeVisible();
}

test.beforeEach(async ({ request, baseURL }) => {
  await resetServer(request, baseURL);
});

test.describe('Secure Project Access', () => {
  test('PM1 logs in and sees Company Projects (Part 1) and Eligible Projects (Part 2), with Share active', async ({ page }) => {
    await login(page, 'PM1@elchai.com');
    await expect(page.locator('#pm-dashboard')).toBeVisible();
    await expect(page.locator('#company-projects li')).toHaveCount(2);
    await expect(page.locator('#pm-eligible-projects li')).toHaveCount(1); // PM1 owns Project Apollo only
    await expect(page.locator('#share-btn')).toBeEnabled();
  });

  test('Teammate1 logs in and sees Invites (Part 1) and Eligible Projects (Part 2), with Share disabled', async ({ page }) => {
    await login(page, 'teammate1@elchai.com');
    await expect(page.locator('#teammate-dashboard')).toBeVisible();
    await expect(page.locator('#invites li')).toHaveText('No project invites yet.');
    await expect(page.locator('#teammate-eligible-projects li')).toHaveText('No eligible projects yet.');
    await expect(page.locator('#teammate-share-btn')).toBeDisabled();
  });

  test('NEGATIVE: PM2 is denied direct access to PM1-owned project (403 Access denied)', async ({ page }) => {
    await login(page, 'PM2@elchai.com');
    await page.fill('#direct-project-id', 'p1'); // Project Apollo, owned by PM1
    await page.click('#direct-access-btn');
    await expect(page.locator('#direct-access-result')).toHaveText(/403 — Access denied/);
  });

  test('NEGATIVE: Teammate is denied access to a project that has not been shared with them', async ({ page }) => {
    await login(page, 'teammate2@elchai.com');
    await page.fill('#direct-project-id', 'p1');
    await page.click('#direct-access-btn');
    await expect(page.locator('#direct-access-result')).toHaveText(/403 — Access denied/);
  });

  test('NEGATIVE: Teammate cannot call the share API directly, even if they know the endpoint', async ({ page, request, baseURL }) => {
    await login(page, 'teammate1@elchai.com');
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session');
    const res = await request.post(`${baseURL}/api/projects/p1/share`, {
      headers: { cookie: `session=${sessionCookie.value}` },
      data: { teammateEmail: 'teammate2@elchai.com' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/project managers/i);
  });

  test('NEGATIVE: PM2 cannot share a project they do not own', async ({ page, request, baseURL }) => {
    await login(page, 'PM2@elchai.com');
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session');
    const res = await request.post(`${baseURL}/api/projects/p1/share`, { // p1 is owned by PM1
      headers: { cookie: `session=${sessionCookie.value}` },
      data: { teammateEmail: 'teammate2@elchai.com' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/you can only share/i);
  });

  test('POSITIVE: PM1 shares their project with Teammate1, who then sees the invite and gains access', async ({ page, browser }) => {
    await login(page, 'PM1@elchai.com');
    await page.selectOption('#share-project-select', 'p1');
    await page.selectOption('#share-teammate-select', 'teammate1@elchai.com');
    await page.click('#share-btn');
    await expect(page.locator('#share-result')).toHaveText('Shared with teammate1@elchai.com.');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, 'teammate1@elchai.com');
    await expect(page2.locator('#invites li').first()).toContainText('PM1');
    await expect(page2.locator('#teammate-eligible-projects li').first()).toContainText('Project Apollo');

    await page2.fill('#direct-project-id', 'p1');
    await page2.click('#direct-access-btn');
    await expect(page2.locator('#direct-access-result')).toHaveText(/200 OK — access granted: Project Apollo/);

    await context2.close();
  });
});
