# Reads .env, maps to Railway service variables, and bulk-upserts via GraphQL.
# Usage: pwsh scripts/railway-set-vars.ps1
$ErrorActionPreference = 'Stop'

$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
if (-not $tokLine) { throw 'RTS_GRUDGE_RAILWAY_API not found in .env' }
$tok = (($tokLine.Line -split '=',2)[1]).Trim().Trim('"')

$projectId = '2df16bc4-1455-415a-bb9d-162f59fa841b'
$envId     = 'e4c3ada3-16e6-40a1-a634-b6703620e1dc'
$serviceId = '26b25063-e979-4a79-99ec-9a2bb77dd76f'

# Parse .env into a hashtable (skip blanks/comments, strip surrounding quotes).
$dotenv = @{}
foreach ($line in Get-Content .env) {
  if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $k = $Matches[1]; $v = $Matches[2].Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length-2) }
    $dotenv[$k] = $v
  }
}

# Build variables that the server actually reads.
$vars = @{
  NODE_ENV                  = 'production'
  GRUDGE_API_URL            = 'https://api.grudge-studio.com'
  GRUDGE_PVP_ALLOW_GUESTS   = '0'
  GRUDGE_AUTH_DEBUG         = '0'
}
# DB
if ($dotenv.ContainsKey('GRUDGE_ACCOUNT_DB')) {
  $vars.DATABASE_URL        = $dotenv['GRUDGE_ACCOUNT_DB']
  $vars.GRUDGE_DATABASE_URL = $dotenv['GRUDGE_ACCOUNT_DB']
}
if ($dotenv.ContainsKey('GRUDGE_ACCOUNT_DB_UNPOOLED')) {
  $vars.GRUDGE_ACCOUNT_DB_UNPOOLED = $dotenv['GRUDGE_ACCOUNT_DB_UNPOOLED']
}
# Auth
if ($dotenv.ContainsKey('GRUDGE_AUTH_URL')) { $vars.GRUDGE_AUTH_URL = $dotenv['GRUDGE_AUTH_URL'] }
if ($dotenv.ContainsKey('JWT_SECRET'))      { $vars.GRUDGE_JWT_SECRET = $dotenv['JWT_SECRET']; $vars.JWT_SECRET = $dotenv['JWT_SECRET'] }

# Pass-through everything else verbatim (skip the deploy token).
$skip = @('RTS_GRUDGE_RAILWAY_API')
foreach ($k in $dotenv.Keys) {
  if ($skip -contains $k) { continue }
  if (-not $vars.ContainsKey($k)) { $vars[$k] = $dotenv[$k] }
}

Write-Host "Setting $($vars.Count) variables on rts-grudge-server..."

$mutation = @'
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
'@

$mutationInput = @{
  projectId     = $projectId
  environmentId = $envId
  serviceId     = $serviceId
  variables     = $vars
  replace       = $false
}

$body = @{ query = $mutation; variables = @{ input = $mutationInput } } | ConvertTo-Json -Compress -Depth 10

$r = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
  -Headers @{ 'Project-Access-Token' = $tok; 'Content-Type'='application/json' } `
  -Body $body -TimeoutSec 60

$r | ConvertTo-Json -Depth 6
