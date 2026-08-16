import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

await page.goto('http://localhost:9999/', { waitUntil: 'networkidle0' });
await page.screenshot({ path: 'C:/Users/zhm/Desktop/TOD/projects/monopoly/test-1-setup.png' });

// 点击"开始游戏"按钮
const buttons = await page.$$('button');
for (const btn of buttons) {
  const text = await page.evaluate(el => el.textContent, btn);
  if (text.includes('开始游戏')) {
    await btn.click();
    break;
  }
}

// 等待走格动画
await new Promise(r => setTimeout(r, 8000));
await page.screenshot({ path: 'C:/Users/zhm/Desktop/TOD/projects/monopoly/test-2-game.png' });

// 检查底部导航栏
const navHtml = await page.evaluate(() => {
  const bags = document.querySelector('.bags');
  return bags ? bags.innerHTML.substring(0, 500) : 'NO .bags FOUND';
});
console.log('BagsBar HTML:', navHtml);

await browser.close();
console.log('Done!');
