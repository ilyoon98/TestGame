param([string]$ImagePath, [string]$Mode, [long]$WindowHandle, [uint32]$WindowOwner)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing, System.Runtime.WindowsRuntime
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}
function Await-Result($operation, [type]$resultType) {
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
    return $task.GetAwaiter().GetResult()
}
$bitmap = if ($WindowHandle) {
    Add-Type -Path $env:LIMBUS_FRAME_CAPTURE -ReferencedAssemblies System.Drawing
    $captureStatus = ''
    [GameWindowCapture]::Read([IntPtr]::new($WindowHandle), $WindowOwner, [ref]$captureStatus)
} else {
    [Drawing.Bitmap]::new($ImagePath)
}
if (!$bitmap) {
    @{ captureStatus = $captureStatus } | ConvertTo-Json -Compress
    return
}
$ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ko'))
if (!$ocr) { throw 'The Windows Korean OCR language pack is required.' }
function Read-Region($x, $y, $width, $height, $scale = 3) {
    $expanded = [Drawing.Bitmap]::new($width * $scale + 24, $height * $scale + 24)
    $graphics = [Drawing.Graphics]::FromImage($expanded)
    $graphics.Clear([Drawing.Color]::FromArgb(24, 24, 24))
    $graphics.InterpolationMode = 'HighQualityBicubic'
    $graphics.DrawImage($bitmap, [Drawing.Rectangle]::new(12, 12, $width*$scale, $height*$scale), [Drawing.Rectangle]::new($x,$y,$width,$height), [Drawing.GraphicsUnit]::Pixel)
    $mem = [IO.MemoryStream]::new()
    $expanded.Save($mem, [Drawing.Imaging.ImageFormat]::Png)
    $mem.Position = 0
    $random = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($mem)
    $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($random)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $software = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-Result ($ocr.RecognizeAsync($software)) ([Windows.Media.Ocr.OcrResult])
    $software.Dispose()
    $random.Dispose()
    $mem.Dispose()
    $graphics.Dispose()
    $expanded.Dispose()
    $result.Text
}

function Read-ScaledRegion($x, $y, $width, $height, $referenceWidth, $referenceHeight) {
    $scaleX = $bitmap.Width / $referenceWidth
    $scaleY = $bitmap.Height / $referenceHeight
    Read-Region ([int]($x * $scaleX)) ([int]($y * $scaleY)) ([int]($width * $scaleX)) ([int]($height * $scaleY))
}

function Read-Choices {
    175, 260, 346 | ForEach-Object { Read-ScaledRegion 622 $_ 355 33 1093 627 }
}

$wide = $bitmap.Width / $bitmap.Height -ge 1.65 -and $bitmap.Width / $bitmap.Height -le 1.98
$wideTop = 0
if ($wide -and !$WindowHandle -and $bitmap.GetPixel([int]($bitmap.Width / 2), 4).R -gt 235) {
    for ($row = 5; $row -lt 45; $row++) {
        if ($bitmap.GetPixel([int]($bitmap.Width / 2), $row).R -lt 50) {
            $wideTop = $row
            break
        }
    }
}
$wideScaleX = $bitmap.Width / 2560
$wideScaleY = ($bitmap.Height - $wideTop) / 1369
$wideOcrScale = [int][Math]::Max(2, [Math]::Ceiling(2 / $wideScaleX))

function Read-WideRegion($x, $y, $width, $height) {
    $left = [int]($x * $wideScaleX)
    $top = $wideTop + [int](($y - 23) * $wideScaleY)
    Read-Region $left $top ([int]($width * $wideScaleX)) ([int]($height * $wideScaleY)) $wideOcrScale
}

function Read-AffinityPixels {
    $colors = [System.Collections.Generic.List[byte]]::new()
    for ($y = 260; $y -lt 304; $y += 3) {
        for ($x = 1756; $x -lt 1949; $x += 3) {
            $color = $bitmap.GetPixel([int]($x * $wideScaleX), ($wideTop + [int](($y - 23) * $wideScaleY)))
            $colors.Add($color.R)
            $colors.Add($color.G)
            $colors.Add($color.B)
        }
    }
    [Convert]::ToBase64String($colors.ToArray())
}

function Read-TargetInk {
    for ($row = 0; $row -lt 25; $row++) {
        $y = $wideTop + [int]((753 + 4 * $row) * $wideScaleY)
        $ink = 0
        for ($column = 0; $column -lt 27; $column++) {
            $x = [int]((1516 + 4 * $column) * $wideScaleX)
            $c = $bitmap.GetPixel($x, $y)
            $goldInk = $c.R -ge 170 -and $c.G -ge 104 -and $c.R -ge $c.G -and $c.G -gt ($c.B + 12)
            $redInk = $c.R -gt 140 -and ($c.R - $c.G) -gt 96 -and $c.B -lt 75
            if ($goldInk -or $redInk) { $ink = $ink -bor (1 -shl $column) }
        }
        $ink
    }
}

function Read-EventChoices {
    if ($wide -and (Read-WideRegion 1400 194 295 103) -match '선\s*택\s*지') {
        391, 608, 823 | ForEach-Object { Read-WideRegion 1428 $_ 840 70 }
        return
    }
    Read-Choices
}

try {
    if ($Mode -eq 'choices') {
        @{ lines = @(Read-EventChoices) } | ConvertTo-Json -Compress
        return
    }
    $liveLayout = $Mode -in @('live-frame', 'screenshot')
    $frame = @{ width = $bitmap.Width; height = $bitmap.Height }
    if ($liveLayout -and $wide) {
        $prompt = (Read-WideRegion 1702 593 586 73) -replace '\s', ''
        $selecting = $prompt -match '판정을진행할인격을선택'
        if (!$selecting) {
            $checkStatus = (Read-WideRegion 1699 937 377 79) -replace '\s', ''
            if ($checkStatus -match '^판정(성공|실패)$') {
                @{ checkOutcome = $Matches[1] } | ConvertTo-Json -Compress
                return
            }
            $start = Read-WideRegion 2094 1194 343 104
        }
        if ($selecting -or $checkStatus -match '^예상확률' -or $start -match '판\s*정\s*시\s*작') {
            $frame.layout = 'wide'
            $frame.phase = if ($selecting) { 'select-identity' } else { 'start-check' }
            $frame.start = $start
            $frame.heading = Read-WideRegion 1738 324 325 81
            $frame.affinity = Read-WideRegion 1747 248 405 64
            $frame.affinityPixels = Read-AffinityPixels
            $frame.targetInk = @(Read-TargetInk)
            $frame.target = Read-WideRegion 1480 712 283 177
            if ([regex]::Matches($frame.target, '\d+').Count -ne 1) {
                $frame.target = Read-WideRegion 1478 727 274 154
            }
        }
    }
    if (!$frame.layout) {
        $frame.start = Read-ScaledRegion 686 321 130 48 850 392
        if ($liveLayout -and $frame.start -notmatch '판\s*정\s*시\s*작') {
            @{ lines = @(Read-EventChoices) } | ConvertTo-Json -Compress
            return
        }
        $frame.heading = Read-ScaledRegion 500 71 255 41 850 392
        if ($liveLayout) {
            $frame.affinity = Read-ScaledRegion 520 43 220 30 850 392
            $frame.target = Read-ScaledRegion 489 215 54 38 850 392
        }
    }
    $top = [int][Math]::Floor(341 * $bitmap.Height / 392)
    $bottom = [int][Math]::Floor(369 * $bitmap.Height / 392)
    if ($frame.layout -eq 'wide') {
        $top = [Math]::Min($top, $bitmap.Height - [int][Math]::Ceiling(224 * $wideScaleX))
        $bottom = [Math]::Max($bottom, $bitmap.Height - [int][Math]::Floor(59 * $wideScaleX))
    }
    $portraitRow = [Drawing.Rectangle]::new(0, $top, $bitmap.Width, $bottom - $top + 1)
    $bits = $bitmap.LockBits($portraitRow, [Drawing.Imaging.ImageLockMode]::ReadOnly, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $bytes = New-Object byte[] ($bits.Stride * $bits.Height)
        [Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $bytes, 0, $bytes.Length)
        $frame.top = $top
        $frame.stride = $bits.Stride
        $frame.pixels = [Convert]::ToBase64String($bytes)
        $frame | ConvertTo-Json -Compress
    } finally {
        $bitmap.UnlockBits($bits)
    }
} finally {
    $bitmap.Dispose()
}
