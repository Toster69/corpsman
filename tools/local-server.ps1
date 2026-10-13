# Простой локальный сервер для просмотра сайта без Python.
param([int]$Port = 8000, [string]$Root = (Split-Path -Parent $PSScriptRoot))

$types = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.md'='text/plain; charset=utf-8'; '.txt'='text/plain; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.gif'='image/gif'; '.svg'='image/svg+xml'; '.ico'='image/x-icon';
  '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'; '.wav'='audio/wav'; '.m4a'='audio/mp4';
  '.mp4'='video/mp4'; '.webm'='video/webm'; '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Host "  Не удалось занять порт $Port. Возможно, сервер уже запущен в другом окне."; exit 1 }
Write-Host "  Сервер работает: http://localhost:$Port/"

$rootFull = [System.IO.Path]::GetFullPath($Root)
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
    $path = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    if ($path.StartsWith($rootFull) -and (Test-Path $path -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "  200 /$rel"
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404: $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
      Write-Host "  404 /$rel" -ForegroundColor Yellow
    }
  } catch { } finally { $res.OutputStream.Close() }
}
