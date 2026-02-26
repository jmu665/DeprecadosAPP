const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    let crashed = false;

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER_ERROR:', msg.text());
            crashed = true;
        }
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('--- BODY TEXT ---');
    console.log(bodyText);
    console.log('-----------------');

    if (bodyText.includes('Application Crashed')) {
        console.log('RESULT: HomePage is still crashing.');
    } else if (bodyText.includes('DEPRECADOS')) {
        console.log('RESULT: HomePage loaded successfully!');
    } else {
        console.log('RESULT: Unknown state.');
    }

    await browser.close();
})();
