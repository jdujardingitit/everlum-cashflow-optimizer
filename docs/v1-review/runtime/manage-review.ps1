param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Setup', 'Start', 'Stop', 'Reset', 'Health', 'Test', 'Remove')]
    [string] $Action
)

$ErrorActionPreference = 'Stop'
$Tag = 'ecf-wordpress-v1.0-review'
$Commit = 'e4de26b154b10f01c5df14c3c9de04ecd48b0b9e'
$Project = 'ecf-wordpress-v1-review'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$RuntimeRoot = Join-Path $env:LOCALAPPDATA 'Everlum\ECF-WordPress-V1-Review'
$ComposeFile = Join-Path $RuntimeRoot 'docker-compose.yml'
$EnvFile = Join-Path $RuntimeRoot '.env'
$ReviewUrl = 'http://127.0.0.1:9400/everlum-cf-qa/?ecf_e2e=1&disable_clarity=1&ecf_mock_turnstile=1'

function Require-Command([string] $Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command is unavailable: $Name"
    }
}

function Read-ReviewEnv {
    $result = @{}
    Get-Content -LiteralPath $EnvFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $result[$matches[1]] = $matches[2]
        }
    }
    return $result
}

function Invoke-Compose([string[]] $Arguments) {
    & docker compose --project-name $Project --env-file $EnvFile -f $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed: $($Arguments -join ' ')"
    }
}

function New-LocalSecrets {
    if (Test-Path -LiteralPath $EnvFile) {
        return
    }
    $a = 'A!' + [guid]::NewGuid().ToString('N')
    $b = 'B!' + [guid]::NewGuid().ToString('N')
    $admin = 'Admin!' + [guid]::NewGuid().ToString('N')
    $db = 'Db!' + [guid]::NewGuid().ToString('N')
    $root = 'Root!' + [guid]::NewGuid().ToString('N')
    @(
        'MYSQL_DATABASE=ecf_v1_review'
        'MYSQL_USER=ecf_review'
        "MYSQL_PASSWORD=$db"
        "MYSQL_ROOT_PASSWORD=$root"
        'WP_ADMIN_USER=ecf_review_admin'
        "WP_ADMIN_PASSWORD=$admin"
        'WP_ADMIN_EMAIL=ecf-review-admin@example.test'
        'OWNER_A_USERNAME=owner_review_a'
        "OWNER_A_PASSWORD=$a"
        'OWNER_A_EMAIL=owner-review-a@example.test'
        'OWNER_B_USERNAME=owner_review_b'
        "OWNER_B_PASSWORD=$b"
        'OWNER_B_EMAIL=owner-review-b@example.test'
    ) | Set-Content -LiteralPath $EnvFile -Encoding ASCII
    @(
        'LOCAL SYNTHETIC OWNER REVIEW CREDENTIALS - DO NOT COMMIT OR UPLOAD'
        "Owner Review User A: owner_review_a / $a"
        "Owner Review User B: owner_review_b / $b"
        "Review admin: ecf_review_admin / $admin"
    ) | Set-Content -LiteralPath (Join-Path $RuntimeRoot 'review-secrets.txt') -Encoding ASCII
}

function Prepare-Runtime {
    Require-Command git
    Require-Command docker
    $actual = (& git -C $RepoRoot rev-list -n 1 $Tag).Trim()
    if ($actual -ne $Commit) {
        throw "Frozen tag mismatch: expected $Commit, found $actual"
    }
    New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
    $plugin = Join-Path $RuntimeRoot 'plugin'
    $mu = Join-Path $RuntimeRoot 'mu-plugins'
    $seed = Join-Path $RuntimeRoot 'seed'
    New-Item -ItemType Directory -Path $plugin, $mu, $seed -Force | Out-Null
    $zip = Join-Path $RuntimeRoot 'tagged-plugin.zip'
    & git -C $RepoRoot archive --format=zip --output=$zip $Tag everlum-cashflow-optimizer.php assets
    if ($LASTEXITCODE -ne 0) { throw 'Could not archive the frozen tag.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $plugin -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'docker-compose.v1-review.yml') -Destination $ComposeFile -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'mu-plugins\ecf-v1-review-banner.php') -Destination $mu -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'seed\seed-review.php') -Destination $seed -Force
    New-LocalSecrets
}

function Wait-ForSite {
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9400/' -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 2
    }
    throw 'WordPress did not become ready.'
}

function Seed-Review([switch] $Reset) {
    $values = Read-ReviewEnv
    $common = @(
        'run', '--rm',
        '-e', "OWNER_A_USERNAME=$($values.OWNER_A_USERNAME)",
        '-e', "OWNER_A_PASSWORD=$($values.OWNER_A_PASSWORD)",
        '-e', "OWNER_A_EMAIL=$($values.OWNER_A_EMAIL)",
        '-e', "OWNER_B_USERNAME=$($values.OWNER_B_USERNAME)",
        '-e', "OWNER_B_PASSWORD=$($values.OWNER_B_PASSWORD)",
        '-e', "OWNER_B_EMAIL=$($values.OWNER_B_EMAIL)",
        'cli', 'eval-file', '/review/seed-review.php'
    )
    if ($Reset) { $common += 'reset' }
    Invoke-Compose $common
    Invoke-Compose @('run', '--rm', 'cli', 'rewrite', 'flush', '--hard')
}

function Install-WordPress {
    $values = Read-ReviewEnv
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose --project-name $Project --env-file $EnvFile -f $ComposeFile run --rm cli core is-installed 2>$null
    $installed = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $old
    if (-not $installed) {
        Invoke-Compose @(
            'run', '--rm', 'cli', 'core', 'install',
            '--url=http://127.0.0.1:9400',
            '--title=Everlum Cashflow Optimizer V1 Review',
            "--admin_user=$($values.WP_ADMIN_USER)",
            "--admin_password=$($values.WP_ADMIN_PASSWORD)",
            "--admin_email=$($values.WP_ADMIN_EMAIL)",
            '--skip-email'
        )
    }
    Invoke-Compose @('run', '--rm', 'cli', 'plugin', 'activate', 'everlum-cashflow-optimizer')
    Seed-Review
}

function Test-Health {
    Invoke-Compose @('exec', '-T', 'db', 'mysqladmin', 'ping', '-h', '127.0.0.1', '-u', 'root', "-p$((Read-ReviewEnv).MYSQL_ROOT_PASSWORD)", '--silent')
    $response = Invoke-WebRequest -UseBasicParsing -Uri $ReviewUrl -TimeoutSec 20
    if ($response.StatusCode -ne 200) { throw "Site health failed: HTTP $($response.StatusCode)" }
    if ($response.Content -notmatch 'data-testid=["'']ecf-cashflow-root["'']') {
        throw 'Calculator root marker was not found.'
    }
    Write-Output "Database healthy; site HTTP 200; calculator root present: $ReviewUrl"
}

switch ($Action) {
    'Setup' {
        Prepare-Runtime
        Invoke-Compose @('up', '-d', 'db', 'wordpress')
        Wait-ForSite
        Install-WordPress
        Test-Health
        Write-Output "Credentials: $(Join-Path $RuntimeRoot 'review-secrets.txt')"
    }
    'Start' {
        if (-not (Test-Path -LiteralPath $EnvFile)) { throw 'Run Setup first.' }
        Invoke-Compose @('up', '-d', 'db', 'wordpress')
        Wait-ForSite
        Test-Health
    }
    'Stop' {
        Invoke-Compose @('stop')
    }
    'Reset' {
        Seed-Review -Reset
        Test-Health
    }
    'Health' {
        Test-Health
    }
    'Test' {
        Require-Command npm
        $values = Read-ReviewEnv
        Push-Location $RepoRoot
        try {
            $env:ECF_CALC_URL = $ReviewUrl
            $env:ECF_TEST_USER_EMAIL = $values.OWNER_A_EMAIL
            $env:ECF_TEST_USER_PASSWORD = $values.OWNER_A_PASSWORD
            $env:ECF_TEST_USER_EMAIL_ALT = $values.OWNER_B_EMAIL
            $env:ECF_TEST_USER_PASSWORD_ALT = $values.OWNER_B_PASSWORD
            $env:ECF_E2E_TURNSTILE_MOCK = '1'
            & npm install
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
            & npx playwright install
            if ($LASTEXITCODE -ne 0) { throw 'Playwright browser install failed.' }
            & npm run test:e2e
            if ($LASTEXITCODE -ne 0) { throw 'V1 E2E gate failed.' }
        } finally {
            Pop-Location
        }
    }
    'Remove' {
        if (-not (Test-Path -LiteralPath $RuntimeRoot)) { return }
        $expected = Join-Path $env:LOCALAPPDATA 'Everlum\ECF-WordPress-V1-Review'
        if ($RuntimeRoot -ne $expected) { throw 'Removal path safety check failed.' }
        if (Test-Path -LiteralPath $EnvFile) { Invoke-Compose @('down', '--volumes', '--remove-orphans') }
        Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force
    }
}
