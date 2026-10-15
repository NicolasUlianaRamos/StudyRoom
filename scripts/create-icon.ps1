param([switch]$Mac)
Add-Type -AssemblyName System.Drawing
$dest = Join-Path (Get-Location) 'build'
[System.IO.Directory]::CreateDirectory($dest) | Out-Null
$size = if ($Mac) { 1024 } else { 256 }
$bitmap = [System.Drawing.Bitmap]::new($size,$size)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.ScaleTransform(($size / 256), ($size / 256))
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(234,240,223))
$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$path.AddBezier(64,168,40,97,105,79,195,52)
$path.AddBezier(195,52,211,152,152,207,83,185)
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(63,96,70),13)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawPath($pen,$path)
$g.DrawBezier($pen,61,204,92,151,118,143,156,115)
$iconName = if ($Mac) { 'icon-mac.png' } else { 'icon.png' }
$bitmap.Save((Join-Path $dest $iconName),[System.Drawing.Imaging.ImageFormat]::Png)
if (-not $Mac) {
$png = [System.IO.File]::ReadAllBytes((Join-Path $dest 'icon.png'))
$stream = [System.IO.File]::Create((Join-Path $dest 'icon.ico'))
$writer = [System.IO.BinaryWriter]::new($stream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$png.Length)
$writer.Write([UInt32]22)
$writer.Write($png)
$writer.Dispose()
}
$path.Dispose()
$pen.Dispose()
$g.Dispose()
$bitmap.Dispose()
