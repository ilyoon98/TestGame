[CmdletBinding()]
param(
    [string]$Workbook = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Skill.xlsx'),
    [string]$OutputPath = (Join-Path $PSScriptRoot 'crew-data.js'),
    [switch]$Watch
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$types = @{ '참격' = 'slash'; '관통' = 'pierce'; '타격' = 'blunt' }
$elements = @{ '증기' = 'steam'; '서리' = 'frost'; '전류' = 'current' }
$teams = @('Battle 전투팀', 'Omega 서포트 팀', 'Before 사전 준비 팀', 'Detective 추적팀',
    'Nadir 뒷정리 팀', 'Clear 암살팀', 'zenith 지원팀', 'Alfa 간부')
$effects = @{
    '합' = 'clashBonus'; '표식' = 'mark'; '자신 보호막' = 'guard'; '아군 회복' = 'heal'
    '마무리 피해' = 'finishDamage'; '일방 공격 피해' = 'followUpDamage'
}

function Read-PackageXml($Archive, [string]$EntryName) {
    $entry = $Archive.GetEntry($EntryName)
    if ($null -eq $entry) { throw "엑셀 내부에서 $EntryName 파일을 찾을 수 없습니다." }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return [xml]$reader.ReadToEnd() }
    finally { $reader.Dispose() }
}

function Read-SheetRows($Archive, [string]$EntryName, [string[]]$SharedStrings) {
    $sheet = Read-PackageXml $Archive $EntryName
    foreach ($row in $sheet.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")) {
        $cells = @{}
        foreach ($cell in $row.SelectNodes("./*[local-name()='c']")) {
            $column = $cell.GetAttribute('r') -replace '\d+$', ''
            $value = $cell.SelectSingleNode("./*[local-name()='v']")
            $raw = $value.InnerText
            switch ($cell.GetAttribute('t')) {
                's' { $raw = $SharedStrings[[int]$raw] }
                'inlineStr' { $raw = ($cell.SelectNodes(".//*[local-name()='t']") | ForEach-Object InnerText) -join '' }
                'e' { $raw = $null }
            }
            if (-not [string]::IsNullOrWhiteSpace($raw)) { $cells[$column] = $raw.Trim() }
        }
        if ($cells.Count) { [pscustomobject]@{ Number = [int]$row.GetAttribute('r'); Cells = $cells } }
    }
}

function Read-Number($Value, [string]$Location, [int]$Minimum = [int]::MinValue, [int]$Maximum = [int]::MaxValue) {
    $number = 0
    if (-not [int]::TryParse([string]$Value, [ref]$number) -or $number -lt $Minimum -or $number -gt $Maximum) {
        throw "$Location 값을 확인하세요. 허용 범위는 $Minimum ~ $Maximum 사이의 정수입니다."
    }
    return $number
}

function Read-Category($Lookup, $Value, [string]$Location) {
    if (-not $Value -or -not $Lookup.ContainsKey($Value)) { throw "$Location 값 '$Value'을 확인하세요." }
    return $Lookup[$Value]
}

function Read-ImageLink([string]$Value, [string]$Location) {
    if (-not $Value) { return }
    $url = $null
    if ([uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$url) -and
        $url.Scheme -eq 'https' -and $url.Host -and -not $url.UserInfo) { return $url.AbsoluteUri }
    if ($Value -match '^(assets|concept-art)/[^\\?#\x22<>|:]+$' -and
        $Value -notmatch '(?:^|/)\.{1,2}(?:/|$)' -and
        (Test-Path -LiteralPath (Join-Path $PSScriptRoot $Value) -PathType Leaf)) { return $Value }
    throw "$Location 값은 HTTPS 이미지 주소나 assets/, concept-art/ 아래의 이미지 경로여야 합니다."
}

function Read-RowValues($Row, $Columns) {
    $values = @{}
    foreach ($header in $Columns.Keys) { $values[$header] = $Row.Cells[$Columns[$header]] }
    return $values
}

function Read-Columns($Header, [string[]]$Required, [string]$SheetName) {
    $columns = @{}
    foreach ($column in $Header.Cells.Keys) { $columns.Add($Header.Cells[$column], $column) }
    foreach ($name in $Required) {
        if (-not $columns.ContainsKey($name)) { throw "$SheetName 시트에 '$name' 열이 필요합니다." }
    }
    return $columns
}

function Read-Table($Rows, [string[]]$Required, [string]$SheetName) {
    $columns = Read-Columns $Rows[0] $Required $SheetName
    $result = [ordered]@{}
    foreach ($row in ($Rows | Select-Object -Skip 1)) {
        $record = Read-RowValues $row $columns
        $id = Read-Number $record.ID "$SheetName $($row.Number)행 ID" 1
        if ($result.Contains([string]$id)) { throw "$SheetName 시트에 중복 ID $id 값이 있습니다." }
        $record['_location'] = "$SheetName $($row.Number)행"
        $result.Add([string]$id, $record)
    }
    return $result
}

function Read-Skills($Rows) {
    $columns = @{}
    foreach ($column in $Rows[0].Cells.Keys) { $columns.Add($Rows[0].Cells[$column], $column) }
    $fields = @('Name', 'Element', 'Physics', 'Coin Basic', 'Coin Count', 'Coin Value', 'Plus')
    $skillColumns = @(
        @('B','C','D','E','F','G','H'), @('I','J','K','L','M','N','O'), @('P','Q','R','S','T','U','V')
    )
    if ($columns.ID -ne 'A') { throw '스킬 시트 A1에 ID가 필요합니다.' }
    for ($slot = 0; $slot -lt 3; $slot++) {
        if ($columns["Skill $($slot + 1)"] -ne $skillColumns[$slot][0]) {
            throw "스킬 시트에서 Skill $($slot + 1) 블록을 찾을 수 없습니다."
        }
        for ($field = 0; $field -lt $fields.Count; $field++) {
            if ($Rows[1].Cells[$skillColumns[$slot][$field]] -ne $fields[$field]) {
                throw "스킬 시트 Skill $($slot + 1) 블록의 '$($fields[$field])' 열을 확인하세요."
            }
        }
    }
    $result = @{}
    foreach ($row in ($Rows | Select-Object -Skip 2)) {
        $id = [string](Read-Number $row.Cells.A "스킬 $($row.Number)행 ID" 1)
        if ($result.ContainsKey($id)) { throw "스킬 시트에 중복 ID $id 값이 있습니다." }
        $result[$id] = @(for ($slot = 0; $slot -lt 3; $slot++) {
            # Null cells must retain their column position, including an empty Plus.
            $name, $element, $type, $basic, $count, $coinValue, $plus = @($skillColumns[$slot].ForEach({ $row.Cells[$_] }))
            $location = "스킬 $($row.Number)행 Skill $($slot + 1)"
            if (-not $name) { throw "$location 이름이 비어 있습니다." }
            $skill = [ordered]@{
                name = $name; affinity = Read-Category $elements $element "$location Element"
                type = Read-Category $types $type "$location Physics"
                basePower = (Read-Number $basic "$location Coin Basic" 0) - $slot
                coinCount = Read-Number $count "$location Coin Count" 1
                coinPower = (Read-Number $coinValue "$location Coin Value") - $slot
            }
            if ($plus) {
                foreach ($part in ($plus -split '\s*[·,;\r\n]\s*')) {
                    if ($part -notmatch '^(.+?)\s*\+\s*(\d+)$' -or -not $effects.ContainsKey($Matches[1])) {
                        throw "$location Plus 값 '$part'을 확인하세요."
                    }
                    $fieldName = $effects[$Matches[1]]
                    if ($skill.Contains($fieldName)) { throw "$location Plus에 '$part' 효과가 중복됩니다." }
                    $skill[$fieldName] = Read-Number $Matches[2] "$location Plus" 0
                }
            }
            $skill
        })
    }
    return $result
}

function Read-Resistances($Lookup, $Resistance, $Weakness, [string]$Location) {
    $values = [ordered]@{}
    foreach ($label in ($Resistance -split '\s*[,/·]\s*')) {
        if ($label) { $values[(Read-Category $Lookup $label "$Location 내성")] = 0.75 }
    }
    foreach ($label in ($Weakness -split '\s*[,/·]\s*')) {
        if (-not $label) { continue }
        $key = Read-Category $Lookup $label "$Location 약점"
        if ($values.Contains($key)) { throw "$Location 값 '$label'이 내성과 약점에 모두 들어 있습니다." }
        $values[$key] = 1.25
    }
    return $values
}

function Read-CrewWorkbook([string]$Source) {
    $stream = [IO.File]::Open($Source, [IO.FileMode]::Open, [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
    try {
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read)
        try {
            $xml = Read-PackageXml $archive 'xl/workbook.xml'
            $relationships = Read-PackageXml $archive 'xl/_rels/workbook.xml.rels'
            $paths = @{}
            foreach ($rel in $relationships.DocumentElement.ChildNodes) {
                if ($rel.LocalName -ne 'Relationship' -or $rel.GetAttribute('TargetMode') -eq 'External') { continue }
                $part = [uri]::new([uri]'https://workbook.invalid/xl/workbook.xml', $rel.GetAttribute('Target'))
                $paths[$rel.GetAttribute('Id')] = $part.AbsolutePath.TrimStart('/')
            }
            $strings = @()
            if ($archive.GetEntry('xl/sharedStrings.xml')) {
                $strings = @((Read-PackageXml $archive 'xl/sharedStrings.xml').SelectNodes("//*[local-name()='si']") |
                    ForEach-Object { ($_.SelectNodes(".//*[local-name()='t']") | ForEach-Object InnerText) -join '' })
            }
            $rows = @{}
            foreach ($sheet in $xml.SelectNodes("//*[local-name()='sheets']/*[local-name()='sheet']")) {
                $name = $sheet.GetAttribute('name')
                if ($name -notin @('캐릭터', '스킬', '컨셉')) { continue }
                $id = ($sheet.Attributes | Where-Object LocalName -eq 'id').Value
                if (-not $paths[$id]) { throw "'$name' 시트 데이터를 찾을 수 없습니다." }
                $rows[$name] = @(Read-SheetRows $archive $paths[$id] $strings)
            }
        }
        finally { $archive.Dispose() }
    }
    finally { $stream.Dispose() }

    foreach ($name in @('캐릭터', '스킬', '컨셉')) {
        if (-not $rows[$name]) { throw "'$name' 시트가 비어 있거나 없습니다." }
    }
    $characters = Read-Table $rows['캐릭터'] @('ID', '대원', '소속', '코스트', '최대 체력', '캐릭터 레벨',
        '공격', '방어', '시작 정신력', '고유 합 위력', '유형 내성', '유형 약점', '속성 내성', '속성 약점', '활성 세트 3', '활성 세트 4') '캐릭터'
    $concepts = Read-Table $rows['컨셉'] @('ID', '원화 참고', '동물', '무기') '컨셉'
    $skills = Read-Skills $rows['스킬']
    foreach ($id in (@($skills.Keys) + @($concepts.Keys))) {
        if (-not $characters.Contains($id)) { throw "캐릭터 시트에 ID $id 항목이 없습니다." }
    }
    # The fixed 5v2 demo and recruit tiles refer to these existing IDs.
    foreach ($id in @('1001','1002','1008','1014','1015','1020')) {
        if (-not $characters.Contains($id)) { throw "고정 테스트 전투 또는 영입 칸에서 사용하는 ID $id 항목이 필요합니다." }
    }
    foreach ($id in $characters.Keys) {
        $character = $characters[$id]
        $concept = $concepts[$id]
        $location = $character['_location']
        if (-not $skills.ContainsKey($id) -or -not $concept) { throw "ID $id 의 스킬과 컨셉을 모두 입력하세요." }
        if (-not $character['대원'] -or $character['소속'] -notin $teams) { throw "$location 대원 이름 또는 소속을 확인하세요." }
        $setFields = @('affiliation', 'type')
        foreach ($tag in @($character['활성 세트 3'], $character['활성 세트 4'])) {
            if (-not $tag) { continue }
            $field = if ($tag -eq '속성' -or $elements.ContainsKey($tag)) { 'affinity' }
                elseif ($concept['동물'] -and $tag -in @('동물', $concept['동물'])) { 'animal' }
                elseif ($concept['무기'] -and $tag -in @('무기', $concept['무기'])) { 'weapon' }
                else { throw "$location 활성 세트 '$tag'을 확인하세요." }
            if ($field -in $setFields) { throw "$location 활성 세트 '$tag'이 중복됩니다." }
            $setFields += $field
        }
        $unit = [ordered]@{
            sheetId = [int]$id; name = $character['대원']; affiliation = $character['소속']
            cost = Read-Number $character['코스트'] "$location 코스트" 1 4
            maxHp = Read-Number $character['최대 체력'] "$location 최대 체력" 1
            level = Read-Number $character['캐릭터 레벨'] "$location 캐릭터 레벨" 0
            attack = Read-Number $character['공격'] "$location 공격" 0
            armor = Read-Number $character['방어'] "$location 방어" 0
            spirit = Read-Number $character['시작 정신력'] "$location 시작 정신력" -45 45
            clashPower = Read-Number $character['고유 합 위력'] "$location 고유 합 위력"
            typeResists = Read-Resistances $types $character['유형 내성'] $character['유형 약점'] "$location 유형"
            affinityResists = Read-Resistances $elements $character['속성 내성'] $character['속성 약점'] "$location 속성"
            animal = $concept['동물']; weapon = $concept['무기']; artReference = $concept['원화 참고']
            sets = $setFields; skills = $skills[$id]
        }
        $imageLink = Read-ImageLink $character['이미지 링크'] "$location 이미지 링크"
        if ($imageLink) { $unit['portraitSource'] = $imageLink }
        $unit
    }
}

function Get-WorkbookStamp {
    $item = Get-Item -LiteralPath $Workbook
    return "$($item.LastWriteTimeUtc.Ticks):$($item.Length)"
}

function Sync-Crew {
    $sourceStamp = Get-WorkbookStamp
    $crew = @(Read-CrewWorkbook $Workbook | Sort-Object { $_.sheetId })
    if ((Get-WorkbookStamp) -ne $sourceStamp) { throw [IO.IOException]::new('엑셀이 저장 중입니다. 저장이 끝난 뒤 다시 읽습니다.') }
    $json = ConvertTo-Json -InputObject $crew -Depth 8
    $content = "// sync-crew.ps1 generates this file from Skill.xlsx." + [Environment]::NewLine +
        "const workbookCrew = $json;" + [Environment]::NewLine
    $destination = [IO.Path]::GetFullPath($OutputPath)
    if ([IO.File]::Exists($destination) -and [IO.File]::ReadAllText($destination) -ceq $content) { return }
    $temporary = "$destination.$PID.tmp"
    try {
        [IO.File]::WriteAllText($temporary, $content, [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($temporary, $destination, $true)
    }
    finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
    Write-Host "대원 $($crew.Count)명 동기화 완료. 열린 게임은 새로고침하세요."
}

if (-not $Watch) {
    Sync-Crew
    return
}

Write-Host "변경 감시 중. Ctrl+C를 누르면 종료합니다. $Workbook"
$lastStamp = ''
$lastWarning = ''
while ($true) {
    $stamp = $null
    try {
        $stamp = Get-WorkbookStamp
        if ($stamp -ne $lastStamp) {
            # Wait for Excel to finish replacing the workbook after a save.
            Start-Sleep -Milliseconds 400
            try { Sync-Crew }
            catch [IO.IOException] { Start-Sleep -Milliseconds 400; Sync-Crew }
            $lastWarning = ''
        }
    }
    catch {
        if ($_.Exception.Message -ne $lastWarning) {
            $lastWarning = $_.Exception.Message
            Write-Warning $lastWarning
        }
    }
    if ($null -ne $stamp) { $lastStamp = $stamp }
    Start-Sleep -Seconds 1
}
