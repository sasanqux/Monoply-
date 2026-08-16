import { spawn } from 'child_process';
import http from 'http';

// 获取 DOM
function getDOM() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9999/', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 用 Chrome headless + remote debugging 来交互
const chrome = spawn('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  '--no-sandbox',
  'http://localhost:9999/'
]);

setTimeout(async () => {
  try {
    const dom = await getDOM();
    // 找 app 里的内容
    const appMatch = dom.match(/id="app"[^>]*>(.*)/s);
    if (appMatch) {
      const content = appMatch[1];
      console.log('APP CONTENT (first 1000 chars):');
      console.log(content.substring(0, 1000));
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
  chrome.kill();
  process.exit(0);
}, 5000);
