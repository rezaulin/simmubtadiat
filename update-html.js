const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/admin: \['\/index\.html', '\/santri\.html', '\/kelas\.html', '\/rapot\.html', '\/pengajar\.html', '\/dewan-harian\.html', '\/arsip\.html', '\/alumni\.html', '\/rekap\.html', '\/catatan\.html'\],/g, 
    "admin: ['/index.html', '/santri.html', '/pengajar.html'],");
  content = content.replace(/muroqib: \['\/index\.html', '\/santri\.html', '\/absensi-manual\.html', '\/catatan\.html'\],/g, 
    "muroqib: ['/index.html', '/santri.html', '/absensi-manual.html', '/catatan.html', '/dewan-harian.html', '/pengajar.html'],");
  content = content.replace(/keamanan: \['\/index\.html', '\/santri\.html', '\/kelas\.html', '\/arsip\.html', '\/alumni\.html', '\/rekap\.html', '\/catatan\.html'\],/g, 
    "keamanan: ['/index.html', '/santri.html', '/arsip.html', '/alumni.html', '/catatan.html'],");
  fs.writeFileSync(filePath, content, 'utf8');
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walk(fullPath);
      }
    } else if (fullPath.endsWith('.html')) {
      replaceInFile(fullPath);
      console.log('Updated', fullPath);
    }
  });
}

walk('frontend');
