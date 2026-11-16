param(
    [Parameter(Mandatory)][string]$ProfileDirectory,
    [string]$OutputPath = (Join-Path $PSScriptRoot 'portrait-profiles.json')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$profiles = @{}
foreach ($file in (Get-ChildItem -LiteralPath $ProfileDirectory -File | Sort-Object Name)) {
    if ($file.Name -notmatch '^(\d{5})_(normal|gacksung)_profile\.png$') { continue }
    $id = $Matches[1]
    $bitmap = [Drawing.Bitmap]::new($file.FullName)
    try {
        if ($bitmap.Width -ne 256 -or $bitmap.Height -ne 256) {
            throw "Expected a 256×256 profile image: $($file.Name)"
        }

        # These grids cover the central face crop as it appears inside the in-game portrait frame.
        $grids = [System.Collections.Generic.List[string]]::new()
        foreach ($centerX in @(116, 122, 128)) {
            foreach ($centerY in @(96, 104, 112)) {
                foreach ($step in @(18, 19, 20)) {
                    $bytes = [System.Collections.Generic.List[byte]]::new(90)
                    for ($row = -2; $row -le 2; $row += 1) {
                        for ($column = -2.5; $column -le 2.5; $column += 1) {
                            $x = [int][Math]::Round($centerX + $column * $step)
                            $y = $centerY + $row * $step
                            $color = $bitmap.GetPixel($x, $y)
                            $bytes.Add($color.R)
                            $bytes.Add($color.G)
                            $bytes.Add($color.B)
                        }
                    }
                    $grids.Add([Convert]::ToBase64String($bytes.ToArray()))
                }
            }
        }
        if (!$profiles.ContainsKey($id)) { $profiles[$id] = [ordered]@{} }
        $profiles[$id].Add($file.Name, ($grids -join ''))
    } finally {
        $bitmap.Dispose()
    }
}
if (!$profiles.Count) { throw 'No matching profile PNG files found.' }

$identities = [ordered]@{}
foreach ($id in ($profiles.Keys | Sort-Object)) { $identities.Add($id, $profiles[$id]) }
$data = [ordered]@{
    source = 'https://drive.google.com/drive/folders/1CW9wiMc5-KbTtFFSC2RNCWxQ3el6tN--'
    identities = $identities
}
$json = $data | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath), $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
