$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework

[xml]$layout = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="림버스 판정 확률" Width="462" MinWidth="382" Height="650"
        Background="#191C24" Foreground="#ECE4D4" FontFamily="Malgun Gothic"
        WindowStartupLocation="Manual" ResizeMode="CanResizeWithGrip" Topmost="True">
  <Window.Resources>
    <Style TargetType="Button">
      <Setter Property="Padding" Value="13,7"/>
      <Setter Property="Foreground" Value="#191C24"/>
      <Setter Property="Background" Value="#E0B477"/>
      <Setter Property="BorderBrush" Value="#E0B477"/>
      <Setter Property="FontWeight" Value="Bold"/>
      <Setter Property="Cursor" Value="Hand"/>
    </Style>
  </Window.Resources>
  <Border Background="#191C24" BorderThickness="0,3,0,0" BorderBrush="#8A6650">
    <ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
    <StackPanel Margin="18,16,18,16">
      <DockPanel LastChildFill="True">
        <Button x:Name="ConnectGame" DockPanel.Dock="Right" Content="림버스 창 연결"/>
        <TextBlock Text="거울 관측" FontFamily="Batang" FontWeight="Bold" FontSize="21"
                   VerticalAlignment="Center" Foreground="#E0B477"/>
      </DockPanel>
      <TextBlock x:Name="CheckName" Text="판정 성공률" FontSize="18" FontWeight="Bold"
                 Margin="0,18,0,4" TextWrapping="Wrap"/>
      <TextBlock x:Name="Status" FontSize="12" Foreground="#BBC5D0" TextWrapping="Wrap"
                 Margin="0,0,0,10" Text="림버스 컴퍼니를 켠 뒤 게임 창을 연결해줘."/>
      <Grid Margin="8,0,8,5">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="76"/>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="42"/>
          <ColumnDefinition Width="112"/>
        </Grid.ColumnDefinitions>
        <TextBlock Text="수감자" Foreground="#BBC5D0" FontSize="11"/>
        <TextBlock Grid.Column="1" Text="현재 인격" Foreground="#BBC5D0" FontSize="11"/>
        <TextBlock Grid.Column="2" Text="정신력" Foreground="#BBC5D0" FontSize="11" TextAlignment="Right"/>
        <TextBlock Grid.Column="3" Text="성공률 · 동기화" Foreground="#BBC5D0" FontSize="11" TextAlignment="Right"/>
      </Grid>
      <ItemsControl x:Name="Rows">
        <ItemsControl.ItemTemplate>
          <DataTemplate>
            <Border x:Name="RosterRow" Background="#252A35" BorderThickness="0,0,0,1" BorderBrush="#394554"
                    Padding="8,6" Margin="0,0,0,2">
              <Grid>
                <Grid.ColumnDefinitions>
                  <ColumnDefinition Width="76"/>
                  <ColumnDefinition Width="*"/>
                  <ColumnDefinition Width="42"/>
                  <ColumnDefinition Width="112"/>
                </Grid.ColumnDefinitions>
                <TextBlock Text="{Binding Sinner}" FontWeight="Bold" VerticalAlignment="Center"/>
                <TextBlock Grid.Column="1" Text="{Binding Identity}" Foreground="{Binding Accent}"
                           VerticalAlignment="Center" TextWrapping="Wrap" Margin="0,0,5,0"
                           ToolTip="{Binding Details}"/>
                <TextBlock Grid.Column="2" Text="{Binding Sanity}" Foreground="#BBC5D0"
                           VerticalAlignment="Center" TextAlignment="Right"/>
                <TextBlock x:Name="ChanceText" Grid.Column="3" Text="{Binding Chance}" FontFamily="Consolas" FontSize="{Binding ChanceSize}"
                           Foreground="{Binding Accent}" VerticalAlignment="Center" TextAlignment="Right"
                           ToolTip="{Binding Details}"/>
              </Grid>
            </Border>
            <DataTemplate.Triggers>
              <DataTrigger Binding="{Binding IsRecommended}" Value="True">
                <Setter TargetName="RosterRow" Property="Background" Value="#3A3028"/>
                <Setter TargetName="RosterRow" Property="BorderBrush" Value="#E0B477"/>
                <Setter TargetName="RosterRow" Property="BorderThickness" Value="3,1,1,1"/>
                <Setter TargetName="RosterRow" Property="Padding" Value="5,5,7,6"/>
                <Setter TargetName="RosterRow" Property="ToolTip" Value="{Binding Recommendation}"/>
                <Setter TargetName="ChanceText" Property="FontWeight" Value="Bold"/>
              </DataTrigger>
            </DataTemplate.Triggers>
          </DataTemplate>
        </ItemsControl.ItemTemplate>
      </ItemsControl>
      <DockPanel Margin="0,12,0,0" LastChildFill="True">
        <CheckBox x:Name="KeepOnTop" DockPanel.Dock="Right" Content="항상 위"
                  IsChecked="True" Foreground="#BBC5D0" VerticalAlignment="Center"/>
        <TextBlock Text="실시간 창 모드" Foreground="#BBC5D0" FontSize="11"/>
      </DockPanel>
    </StackPanel>
    </ScrollViewer>
  </Border>
</Window>
'@

$reader = [System.Xml.XmlNodeReader]::new($layout)
$window = [Windows.Markup.XamlReader]::Load($reader)
$connectGame = $window.FindName('ConnectGame')
$checkName = $window.FindName('CheckName')
$status = $window.FindName('Status')
$rows = $window.FindName('Rows')
$keepOnTop = $window.FindName('KeepOnTop')
$area = [System.Windows.SystemParameters]::WorkArea
$window.MaxHeight = $area.Height - 52
$window.Height = [Math]::Min($window.Height, $window.MaxHeight)
$window.Left = [Math]::Max($area.Left, $area.Right - $window.Width - 20)
$window.Top = $area.Top + 32

$sinners = @('이상', '파우스트', '돈키호테', '료슈', '뫼르소', '홍루', '히스클리프', '이스마엘', '로쟈', '싱클레어', '오티스', '그레고르')
$script:displayedRoster = $null

function Format-ChanceRange([double]$lower, [double]$upper) {
    if ([Math]::Abs($upper - $lower) -lt 1e-12) {
        return '{0:0.####}%' -f ($lower * 100)
    }
    $roundedLower = [Math]::Floor($lower * 10000 + 1e-9) / 100
    $roundedUpper = [Math]::Ceiling($upper * 10000 - 1e-9) / 100
    '{0:0.##}–{1:0.##}%' -f $roundedLower, $roundedUpper
}

function Show-Roster([object[]]$observed = @()) {
    $key = ConvertTo-Json -InputObject $observed -Depth 10 -Compress
    if ($key -eq $script:displayedRoster) { return }
    $bySlot = @{}
    foreach ($entry in $observed) {
        $bySlot[[int]$entry.slot] = $entry
    }
    $scores = foreach ($entry in $observed) {
        $veryHigh = $entry.gameGrade -eq '매우 높음'
        $lower = 0
        $upper = 0
        if ($entry.status -eq 'calculated') {
            $lower = $upper = $entry.bestSkill.successProbability
        } elseif ($entry.status -eq 'unknown-uptie') {
            $lower = $entry.lower
            $upper = $entry.upper
        }
        if ($veryHigh -or $upper -gt 0) {
            [pscustomobject]@{
                Slot = [int]$entry.slot
                VeryHigh = $veryHigh
                Lower = $lower
                Upper = $upper
            }
        }
    }
    $best = $scores | Sort-Object @{Expression='VeryHigh'; Descending=$true},
        @{Expression='Lower'; Descending=$true}, @{Expression='Upper'; Descending=$true}, Slot |
        Select-Object -First 1
    $rows.ItemsSource = @(for ($i = 0; $i -lt $sinners.Count; $i++) {
        $entry = $bySlot[$i + 1]
        $row = [pscustomobject]@{
            Sinner = if ($entry.sinnerId) { $sinners[$entry.sinnerId - 1] }
                elseif ($observed.Count) { '슬롯 {0}' -f ($i + 1) }
                else { $sinners[$i] }
            Identity = if ($entry.identity) { $entry.identity } else { '미확인' }
            Details = $null
            Sanity = if ($null -ne $entry.sanity) { '{0:+0;-0;0}' -f $entry.sanity } else { '—' }
            Chance = '—'
            ChanceSize = 15
            Accent = '#BBC5D0'
            IsRecommended = $best.Slot -eq ($i + 1)
            Recommendation = if ($best.Slot -eq ($i + 1)) {
                if ($best.VeryHigh) { '게임 예상 확률이 매우 높고 최저 성공률 우선' }
                else { '최저 성공률 우선 · 같으면 최대 성공률 비교' }
            }
        }
        if ($entry.status -eq 'calculated') {
            $row.Chance = '{0:0.####}%' -f ($entry.bestSkill.successProbability * 100)
            $row.Details = '정신력 {0:+0;-0;0} · 판정 기준 {1}' -f $entry.sanity, $entry.bestSkill.target
        } elseif ($entry.status -eq 'unknown-uptie') {
            $row.ChanceSize = 12
            if ($entry.uptieGroups.Count) {
                $lines = foreach ($group in $entry.uptieGroups) {
                    '{0}–{1} {2}' -f $group.first, $group.last, (Format-ChanceRange $group.lower $group.upper)
                }
                $row.Chance = $lines -join [Environment]::NewLine
                $row.Details = '동기화 ' + ($lines -join ' · 동기화 ')
            } else {
                $row.Chance = Format-ChanceRange $entry.lower $entry.upper
                $row.Details = '동기화 단계별 성공률 ' + $row.Chance
            }
        }
        if ($row.IsRecommended) { $row.Accent = '#E0B477' }
        $row
    })
    $script:displayedRoster = $key
}

$script:gamePid = $null
$script:session = 0
$script:frameJob = $null
$script:eventId = ''
$script:lastChoiceSeen = [datetime]::MinValue
$script:lastFrame = ''
$script:hasRoster = $false
$script:retryMessage = $null
$eventContextLifetime = [TimeSpan]::FromSeconds(10)
$script:nextCapture = [datetime]::MinValue

function Show-Status([string]$message, [string]$title = '판정 성공률') {
    $script:lastFrame = ''
    $script:hasRoster = $false
    $script:retryMessage = $null
    $checkName.Text = $title
    $status.Text = $message
    Show-Roster
}

function Show-RetryStatus([string]$message) {
    if ($script:hasRoster) {
        $script:retryMessage = $message
        $status.Text = "$message · 직전 결과 표시 중"
        return
    }
    Show-Status $message
}

function Disconnect-Game([string]$message) {
    $script:gamePid = $null
    $script:session++
    $script:eventId = ''
    $connectGame.Content = '림버스 창 연결'
    Show-Status $message
}

function Start-Frame([string]$arguments) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $env:LIMBUS_PANEL_NODE
    $start.Arguments = '"{0}" {1}' -f $env:LIMBUS_PANEL_ANALYZER, $arguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.Encoding]::UTF8
    $process = [Diagnostics.Process]::Start($start)
    $script:frameJob = [pscustomobject]@{
        Session = $script:session
        Process = $process
        Output = $process.StandardOutput.ReadToEndAsync()
        Error = $process.StandardError.ReadToEndAsync()
    }
}

function Show-Frame($result) {
    $name = if ($result.event) { $result.event } else { '판정 성공률' }
    if ($result.favoredAffinities.Count -and $null -ne $result.favoredTarget) {
        $name += ' · {0} 유리 {1} · 일반 {2}' -f ($result.favoredAffinities -join '·'), $result.favoredTarget, $result.ordinaryTarget
    } elseif ($null -ne $result.displayedTarget) {
        $name += ' · 화면 목표 {0}' -f $result.displayedTarget
    }
    switch ($result.state) {
        'closed' { Show-RetryStatus '게임 창을 다시 찾는 중' }
        'hidden' { Show-RetryStatus '게임 창이 최소화됐어. 창을 다시 열면 이어서 읽을게.' }
        'small' { Show-RetryStatus '게임 창이 너무 작아. 창 크기를 키워줘.' }
        'unavailable' { Show-RetryStatus '게임 창을 읽을 수 없어. 창 모드로 전환하고 패널을 옆에 둔 뒤 게임 창을 클릭해줘.' }
        'choices' { Show-Status '게임에서 판정 선택지를 고르면 성공률을 계산할게.' $name }
        'waiting' { Show-RetryStatus '연결됨 · 게임에서 판정 시작 전 화면을 열어줘.' }
        'resolved' { Show-Status ('판정 {0} · 다음 판정 화면을 기다리는 중' -f $result.outcome) }
        'unknown-check' {
            $checkName.Text = $name
            $sanity = @($result.roster | Where-Object { $null -ne $_.sanity }).Count
            $reason = if ($null -eq $result.displayedTarget) { '성공 목표값 미확인' }
                elseif (!$result.favoredAffinities.Count) { '유리 속성 미확인' }
                else { '판정 규칙 미확인' }
            $status.Text = "$reason · 정신력 $sanity/$($result.roster.Count)명 확인"
            Show-Roster $result.roster
        }
        default {
            $checkName.Text = $name
            $identified = @($result.roster | Where-Object identity)
            $sanity = @($result.roster | Where-Object { $null -ne $_.sanity })
            $known = @($result.roster | Where-Object status -eq 'calculated')
            $ranges = @($result.roster | Where-Object status -eq 'unknown-uptie')
            $status.Text = "인격 $($identified.Count)/$($result.roster.Count)명 · 정신력 $($sanity.Count)/$($result.roster.Count)명 · 성공률 $($known.Count)명"
            if ($ranges.Count) { $status.Text += " · 동기화별 $($ranges.Count)명" }
            if ($result.checkSource -eq 'condition-match') { $status.Text += ' · 화면 조건과 일치하는 규칙 적용' }
            Show-Roster $result.roster
        }
    }
}

function Update-FrameDisplay($result, [string]$json) {
    if (!$result.state -and !$result.roster.Count) {
        Show-RetryStatus '게임 화면을 다시 읽는 중'
        return
    }
    if ($result.state -in @('closed', 'hidden', 'small', 'unavailable', 'waiting')) {
        Show-Frame $result
        return
    }
    if ($result.state -in @('check', 'unknown-check')) {
        if (!$result.roster.Count) {
            Show-RetryStatus '인격 목록을 다시 읽는 중'
            return
        }
    }
    if ($json -ne $script:lastFrame -or $script:retryMessage) {
        Show-Frame $result
        $script:lastFrame = $json
        $script:retryMessage = $null
    }
    if ($result.state -in @('check', 'unknown-check')) {
        $script:hasRoster = $true
    }
}

$timer = [Windows.Threading.DispatcherTimer]::new()
$timer.Interval = [TimeSpan]::FromMilliseconds(250)
$timer.Add_Tick({
    if ($script:frameJob) {
        $job = $script:frameJob
        if (!$job.Process.HasExited -or !$job.Output.IsCompleted -or !$job.Error.IsCompleted) { return }
        $script:frameJob = $null
        try {
            if ($job.Session -eq $script:session) {
                if ($job.Process.ExitCode -ne 0) {
                    throw $job.Error.GetAwaiter().GetResult()
                }
                $json = $job.Output.GetAwaiter().GetResult()
                $result = $json | ConvertFrom-Json
                if ($result.state -in @('choices', 'check') -and $result.eventId) {
                    $script:eventId = [string]$result.eventId
                    $script:lastChoiceSeen = [datetime]::UtcNow
                } elseif ($result.state -eq 'resolved') {
                    $script:eventId = ''
                }
                Update-FrameDisplay $result $json
            }
        } catch {
            Show-RetryStatus '게임 화면 분석에 실패했어. 다시 읽는 중'
            [Console]::Error.WriteLine($_.Exception.Message)
        } finally {
            $job.Process.Dispose()
        }
    }
    if (!$script:gamePid -or [datetime]::UtcNow -lt $script:nextCapture) { return }
    $game = Get-Process -Id $script:gamePid -ErrorAction SilentlyContinue
    if (!$game -or $game.ProcessName -ne 'LimbusCompany') {
        Disconnect-Game '게임 창이 닫혔어. 게임을 켜고 다시 연결해줘.'
        return
    }
    $script:nextCapture = [datetime]::UtcNow.AddSeconds(1)
    if ($game.MainWindowHandle -eq [IntPtr]::Zero) {
        Show-RetryStatus '게임 창을 기다리는 중이야.'
        return
    }
    try {
        if ([datetime]::UtcNow - $script:lastChoiceSeen -ge $eventContextLifetime) { $script:eventId = '' }
        Start-Frame ('live-frame {0} {1} "{2}"' -f $game.MainWindowHandle.ToInt64(), $game.Id, $script:eventId)
    } catch {
        Show-RetryStatus '게임 화면 분석을 시작하지 못했어. 다시 읽는 중'
        [Console]::Error.WriteLine($_.Exception.Message)
    }
})

$connectGame.Add_Click({
    if ($script:gamePid) {
        Disconnect-Game '연결을 끊었어. 림버스 창을 다시 연결할 수 있어.'
        return
    }
    $games = @(Get-Process -Name 'LimbusCompany' -ErrorAction SilentlyContinue |
        Where-Object MainWindowHandle -ne ([IntPtr]::Zero))
    if ($games.Count -ne 1) {
        Show-Status '연결할 게임 창을 찾지 못했어. 림버스 컴퍼니 창을 하나 열어줘.'
        return
    }
    $script:gamePid = $games[0].Id
    $script:session++
    $script:eventId = ''
    $script:nextCapture = [datetime]::MinValue
    $connectGame.Content = '연결 끊기'
    Show-Status '연결됨 · 게임에서 판정 시작 전 화면을 열어줘.'
})
$window.Add_Closed({
    $timer.Stop()
    if ($script:frameJob) { $script:frameJob.Process.Dispose() }
})
$keepOnTop.Add_Checked({ $window.Topmost = $true })
$keepOnTop.Add_Unchecked({ $window.Topmost = $false })
Show-Roster
$timer.Start()
if ($env:LIMBUS_PANEL_SAMPLE) {
    $window.Add_ContentRendered({
        Start-Frame ('screenshot "{0}"' -f $env:LIMBUS_PANEL_SAMPLE)
    })
}
[void]$window.ShowDialog()
