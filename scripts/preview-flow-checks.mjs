import assert from 'node:assert/strict';

/* global document, getComputedStyle, innerWidth */

// Exercise the authored homepage demonstration through the real React UI.
export async function checkPreviewFlow(browser, baseUrl, pageErrors, locale = 'en') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    const flowTitle = locale === 'ko' ? '데이터 연결 살펴보기' : 'Follow a field';
    await page.goto(locale === 'ko' ? `${baseUrl}/ko/` : baseUrl, { waitUntil: 'networkidle' });
    const walkthrough = page.locator('#walkthrough');
    const flow = walkthrough.getByRole('region', { name: flowTitle });
    const table = walkthrough.getByRole('table');
    const source = walkthrough.getByRole('table', { name: 'data.xlsx', exact: true });
    const template = walkthrough.getByRole('table', { name: 'template.xlsx', exact: true });
    const result = walkthrough.getByRole('table', { name: 'result.xlsx', exact: true });
    assert.equal(await table.count(), 3);
    const positions = await Promise.all(
      [source, template, result].map((sheet) => sheet.boundingBox()),
    );
    assert.ok(positions.every(Boolean));
    assert.ok(Math.abs(positions[0].y - positions[2].y) < 2, 'all three sheets align side by side');
    assert.ok(positions[0].x < positions[1].x && positions[1].x < positions[2].x);
    const tier = await template.getByRole('button', { name: 'Tier', exact: true }).boundingBox();
    assert.ok(
      tier.x + tier.width <= positions[1].x + positions[1].width,
      'Tier fits in the template preview',
    );
    const linkedCells = table.locator('td[class*="linkedCell"]');

    await source.getByRole('button', { name: 'Account', exact: true }).hover();
    assert.equal(await linkedCells.count(), 8, 'hover links the field in all three sheets at once');
    assert.equal(await template.locator('mark').textContent(), '[Account]');
    await source.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('heading', { name: flowTitle, exact: true }).hover();
    assert.equal(await linkedCells.count(), 8, 'selection persists after leaving the cell');
    assert.deepEqual(await table.locator('mark').allTextContents(), ['[Account]']);

    await flow.getByRole('button', { name: 'Renewal', exact: true }).click();
    assert.equal(
      await linkedCells.count(),
      13,
      'Renewal links source, template references and derived results',
    );
    assert.deepEqual(await table.locator('mark').allTextContents(), ['[Renewal]', '[Renewal]']);
    assert.equal(
      await table
        .getByRole('button', { name: '{{ [Account] }}', exact: true })
        .locator('mark')
        .count(),
      0,
    );
    assert.match(await result.innerText(), /Priority/);
    assert.match(await result.innerText(), /Standard/);
    assert.equal(
      await result.locator('td[class*="linkedCell"]').count(),
      6,
      'result highlights Renewal and derived Tier',
    );
    await page.keyboard.press('Escape');
    assert.equal(await linkedCells.count(), 0, 'Escape clears the selection');

    // Keyboard selection and reduced-motion rendering remain usable.
    const owner = flow.getByRole('button', { name: 'Owner', exact: true });
    await owner.focus();
    await page.keyboard.press('Enter');
    assert.equal(await owner.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Enter');
    assert.equal(await linkedCells.count(), 0, 'second activation unpins');
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await flow.getByRole('button', { name: 'Renewal', exact: true }).click();
    assert.equal(
      await template
        .locator('mark')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      'none',
    );
    await flow
      .getByRole('button', { name: locale === 'ko' ? '해제' : 'Clear', exact: true })
      .click();
    assert.equal(await linkedCells.count(), 0);

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const mobile = await mobileContext.newPage();
      mobile.on('pageerror', (error) => pageErrors.push(String(error)));
      await mobile.goto(`${baseUrl}/ko/`, { waitUntil: 'networkidle' });
      const mobileFlow = mobile.getByRole('region', { name: '데이터 연결 살펴보기' });
      const renewal = mobileFlow.getByRole('button', { name: 'Renewal', exact: true });
      await renewal.tap();
      assert.equal(await renewal.getAttribute('aria-pressed'), 'true');
      assert.equal(await mobile.locator('#walkthrough').getByRole('table').count(), 3);
      assert.equal(
        await mobile
          .getByRole('table', { name: 'result.xlsx', exact: true })
          .locator('td[class*="linkedCell"]')
          .count(),
        6,
      );
      assert.equal(
        await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        'mobile page should not overflow horizontally',
      );
      await renewal.tap();
      assert.equal(await renewal.getAttribute('aria-pressed'), 'false');
    } finally {
      await mobileContext.close();
    }
    console.log(
      'PASS homepage field hover, pin, precise references, derived results, keyboard, reduced motion, and mobile tap',
    );
  } finally {
    await context.close();
  }
}
