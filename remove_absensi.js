const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend');

function processDirectory(dirPath) {
    fs.readdir(dirPath, (err, files) => {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        files.forEach(function (file) {
            const fullPath = path.join(dirPath, file);
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    console.log(err);
                    return;
                }
                if (stats.isDirectory()) {
                    processDirectory(fullPath);
                } else if (stats.isFile() && fullPath.endsWith('.html')) {
                    let content = fs.readFileSync(fullPath, 'utf8');
                    // Find the Absensi link block and remove it
                    // Format varies, but generally looks like:
                    // <a href="/absensi.html" data-nav class="flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 rounded-xl transition-colors">
                    //   <i data-lucide="clipboard-list" class="w-5 h-5"></i>
                    //   <span class="font-medium">Absensi</span>
                    // </a>
                    // or in mobile nav:
                    // <a href="/absensi.html" data-nav class="flex flex-col items-center gap-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    //   <i data-lucide="clipboard-list" class="w-6 h-6"></i>
                    //   <span class="text-[10px] font-semibold">Absensi</span>
                    // </a>

                    let updated = content;
                    
                    // A simple regex to remove the anchor tag that has href="/absensi.html" (except manual absensi)
                    // The regex needs to capture the whole <a>...</a> block
                    updated = updated.replace(/<a[^>]*href="\/absensi\.html"[^>]*>[\s\S]*?<\/a>/g, '');

                    if (content !== updated) {
                        fs.writeFileSync(fullPath, updated, 'utf8');
                        console.log(`Updated ${fullPath}`);
                    }
                }
            });
        });
    });
}

processDirectory(directoryPath);
