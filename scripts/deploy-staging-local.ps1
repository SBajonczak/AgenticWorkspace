param(
  [switch]$Apply,
  [string]$Namespace = "agentic-staging",
  [string]$ReleaseName = "agentic-workspace",
  [string]$ChartPath = "helm/agentic-workspace",
  [string]$ValuesFile = "helm/agentic-workspace/values-staging.yaml",
  [string]$EnvFile = ".env"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-EnvMapFromFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Env file not found: $Path"
  }

  $map = @{}
  $lines = Get-Content -LiteralPath $Path
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
    if ($trimmed.StartsWith("#")) { continue }

    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }

    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()

    if ($value.Length -ge 2) {
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    $map[$key] = $value
  }

  return $map
}

function Get-RequiredValue {
  param(
    [hashtable]$Map,
    [string]$Key,
    [bool]$AllowEmpty = $false
  )

  if (-not $Map.ContainsKey($Key)) {
    if ($AllowEmpty) { return "" }
    throw "Missing key in .env: $Key"
  }

  $value = [string]$Map[$Key]
  if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($value)) {
    throw "Empty value in .env for required key: $Key"
  }

  return $value
}

Write-Host "Loading env values from $EnvFile ..."
$envMap = Get-EnvMapFromFile -Path $EnvFile

$openaiModel = if ($envMap.ContainsKey("OPENAI_MODEL") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["OPENAI_MODEL"])) {
  [string]$envMap["OPENAI_MODEL"]
} else {
  "gpt-5.1"
}

$outputLanguages = if ($envMap.ContainsKey("OUTPUT_LANGUAGES") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["OUTPUT_LANGUAGES"])) {
  [string]$envMap["OUTPUT_LANGUAGES"]
} else {
  "de,en"
}

$dryRun = if ($envMap.ContainsKey("DRY_RUN") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["DRY_RUN"])) {
  [string]$envMap["DRY_RUN"]
} else {
  "true"
}

$outputLanguagesEscaped = $outputLanguages -replace ',', '\,'

$secretLiterals = @{
  DATABASE_URL = Get-RequiredValue -Map $envMap -Key "DATABASE_URL"
  NEXTAUTH_SECRET = Get-RequiredValue -Map $envMap -Key "NEXTAUTH_SECRET"
  NEXTAUTH_URL = Get-RequiredValue -Map $envMap -Key "NEXTAUTH_URL"
  AUTH_URL = if ($envMap.ContainsKey("AUTH_URL") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["AUTH_URL"])) { [string]$envMap["AUTH_URL"] } else { Get-RequiredValue -Map $envMap -Key "NEXTAUTH_URL" }
  AUTH_TRUST_HOST = if ($envMap.ContainsKey("AUTH_TRUST_HOST") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["AUTH_TRUST_HOST"])) { [string]$envMap["AUTH_TRUST_HOST"] } else { "true" }
  AZURE_CLIENT_ID = Get-RequiredValue -Map $envMap -Key "AZURE_CLIENT_ID"
  AZURE_CLIENT_SECRET = Get-RequiredValue -Map $envMap -Key "AZURE_CLIENT_SECRET"
  AZURE_TENANT_ID = Get-RequiredValue -Map $envMap -Key "AZURE_TENANT_ID"
  AUTH_MICROSOFT_ENTRA_ID_ID = if ($envMap.ContainsKey("AUTH_MICROSOFT_ENTRA_ID_ID") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["AUTH_MICROSOFT_ENTRA_ID_ID"])) { [string]$envMap["AUTH_MICROSOFT_ENTRA_ID_ID"] } else { Get-RequiredValue -Map $envMap -Key "AZURE_CLIENT_ID" }
  AUTH_MICROSOFT_ENTRA_ID_SECRET = if ($envMap.ContainsKey("AUTH_MICROSOFT_ENTRA_ID_SECRET") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["AUTH_MICROSOFT_ENTRA_ID_SECRET"])) { [string]$envMap["AUTH_MICROSOFT_ENTRA_ID_SECRET"] } else { Get-RequiredValue -Map $envMap -Key "AZURE_CLIENT_SECRET" }
  AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = if ($envMap.ContainsKey("AUTH_MICROSOFT_ENTRA_ID_TENANT_ID") -and -not [string]::IsNullOrWhiteSpace([string]$envMap["AUTH_MICROSOFT_ENTRA_ID_TENANT_ID"])) { [string]$envMap["AUTH_MICROSOFT_ENTRA_ID_TENANT_ID"] } else { Get-RequiredValue -Map $envMap -Key "AZURE_TENANT_ID" }
  AZURE_OPENAI_API_KEY = Get-RequiredValue -Map $envMap -Key "AZURE_OPENAI_API_KEY"
  AZURE_OPENAI_ENDPOINT = Get-RequiredValue -Map $envMap -Key "AZURE_OPENAI_ENDPOINT"
  AZURE_OPENAI_DEPLOYMENT = Get-RequiredValue -Map $envMap -Key "AZURE_OPENAI_DEPLOYMENT"
  OPENAI_API_KEY = Get-RequiredValue -Map $envMap -Key "OPENAI_API_KEY" -AllowEmpty $true
  JIRA_HOST = Get-RequiredValue -Map $envMap -Key "JIRA_HOST" -AllowEmpty $true
  JIRA_EMAIL = Get-RequiredValue -Map $envMap -Key "JIRA_EMAIL" -AllowEmpty $true
  JIRA_API_TOKEN = Get-RequiredValue -Map $envMap -Key "JIRA_API_TOKEN" -AllowEmpty $true
  JIRA_PROJECT_KEY = Get-RequiredValue -Map $envMap -Key "JIRA_PROJECT_KEY" -AllowEmpty $true
}

if (-not (kubectl get namespace $Namespace 2>$null)) {
  Write-Host "Creating namespace $Namespace ..."
  kubectl create namespace $Namespace | Out-Null
}

$secretArgs = @("-n", $Namespace, "create", "secret", "generic", "agentic-secrets")
foreach ($entry in $secretLiterals.GetEnumerator()) {
  $secretArgs += "--from-literal=$($entry.Key)=$($entry.Value)"
}
$secretArgs += @("--dry-run=client", "-o", "yaml")

Write-Host "Applying secret agentic-secrets from .env values ..."
$secretYaml = & kubectl @secretArgs
$secretYaml | kubectl apply -f - | Out-Null

$dryRunArgs = @(
  "upgrade", "--install", $ReleaseName, $ChartPath,
  "--namespace", $Namespace,
  "--create-namespace",
  "-f", $ValuesFile,
  "--set-string", "namespace=$Namespace",
  "--set-string", "config.dryRun=$dryRun",
  "--set-string", "config.openaiModel=$openaiModel",
  "--set-string", "config.outputLanguages=$outputLanguagesEscaped"
)

if (-not $Apply) {
  $dryRunArgs += @("--dry-run=client", "--debug")
  Write-Host "Running Helm dry-run (use -Apply for real deploy) ..."
  & helm @dryRunArgs
  exit $LASTEXITCODE
}

$applyArgs = @(
  "upgrade", "--install", $ReleaseName, $ChartPath,
  "--namespace", $Namespace,
  "--create-namespace",
  "--wait",
  "--timeout", "10m",
  "-f", $ValuesFile,
  "--set-string", "namespace=$Namespace",
  "--set-string", "config.dryRun=$dryRun",
  "--set-string", "config.openaiModel=$openaiModel",
  "--set-string", "config.outputLanguages=$outputLanguagesEscaped"
)

Write-Host "Running Helm apply ..."
& helm @applyArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Checking rollout status ..."
kubectl -n $Namespace rollout status deployment/agentic-web --timeout=180s
kubectl -n $Namespace rollout status deployment/agentic-worker --timeout=180s
