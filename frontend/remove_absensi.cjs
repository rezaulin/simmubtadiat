const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Regex to remove the absensi sidebar link
  // It looks for <a href="/absensi.html"...</a>
  const regexDesktop = /<a\s+href="\/absensi\.html"[^>]*>[\s\S]*?<\/a>/g;
  
  const initialLength = content.length;
  content = content.replace(regexDesktop, '');
  
  if (content.length !== initialLength) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Updated', file);
  }
}
