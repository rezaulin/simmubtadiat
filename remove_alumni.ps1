$oldStr = "mufatish: ['/index.html', '/santri.html', '/kelas.html', '/penilaian.html', '/absensi-manual.html', '/rapot.html', '/pengajar.html', '/dewan-harian.html', '/arsip.html', '/alumni.html', '/rekap.html', '/catatan.html']"
$newStr = "mufatish: ['/index.html', '/santri.html', '/kelas.html', '/penilaian.html', '/absensi-manual.html', '/rapot.html', '/pengajar.html', '/dewan-harian.html', '/arsip.html', '/rekap.html', '/catatan.html']"

Get-ChildItem -Path frontend -Recurse -Include *.html,*.js | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match [regex]::Escape($oldStr)) {
        $content = $content -replace [regex]::Escape($oldStr), $newStr
        Set-Content -Path $_.FullName -Value $content -NoNewline
        Write-Host "Updated $($_.FullName)"
    }
}
