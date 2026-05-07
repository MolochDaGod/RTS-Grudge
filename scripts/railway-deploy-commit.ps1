# Triggers a deployment at a specific commit SHA on the rts-grudge-server service.
param([string]$CommitSha = '')
$ErrorActionPreference = 'Stop'

if (-not $CommitSha) {
  $CommitSha = (git rev-parse HEAD).Trim()
}
Write-Host "Deploying commit: $CommitSha"

$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
$tok = (($tokLine.Line -split '=',2)[1]).Trim().Trim('"')

$projectId = '2df16bc4-1455-415a-bb9d-162f59fa841b'
$envId     = 'e4c3ada3-16e6-40a1-a634-b6703620e1dc'
$serviceId = '26b25063-e979-4a79-99ec-9a2bb77dd76f'

function Invoke-Rail($query, $variables) {
  $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Compress -Depth 10
  Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
    -Headers @{ 'Project-Access-Token' = $tok; 'Content-Type'='application/json' } `
    -Body $body -TimeoutSec 60
}

$mut = @'
mutation($input: DeploymentTriggerInput!) {
  deploymentTrigger(input: $input) { id status }
}
'@
$inp = @{
  projectId     = $projectId
  environmentId = $envId
  serviceId     = $serviceId
  commitSha     = $CommitSha
}
try {
  $r = Invoke-Rail $mut @{ input = $inp }
  $r | ConvertTo-Json -Depth 6
} catch {
  Write-Host "deploymentTrigger err: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $_.ErrorDetails.Message }
}
