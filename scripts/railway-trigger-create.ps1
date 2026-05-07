# Creates a GitHub deployment trigger so Railway auto-deploys on push.
$ErrorActionPreference = 'Stop'
$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
$tok = (($tokLine.Line -split '=',2)[1]).Trim().Trim('"')

$projectId = '2df16bc4-1455-415a-bb9d-162f59fa841b'
$envId     = 'e4c3ada3-16e6-40a1-a634-b6703620e1dc'
$serviceId = '26b25063-e979-4a79-99ec-9a2bb77dd76f'

$mut = @'
mutation($input: DeploymentTriggerCreateInput!) {
  deploymentTriggerCreate(input: $input) { id provider repository branch }
}
'@
$inp = @{
  projectId     = $projectId
  environmentId = $envId
  serviceId     = $serviceId
  provider      = 'github'
  repository    = 'MolochDaGod/RTS-Grudge'
  branch        = 'main'
}
$body = @{ query = $mut; variables = @{ input = $inp } } | ConvertTo-Json -Compress -Depth 10

try {
  $r = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
    -Headers @{ 'Project-Access-Token' = $tok; 'Content-Type'='application/json' } `
    -Body $body -TimeoutSec 30
  $r | ConvertTo-Json -Depth 6
} catch {
  Write-Host "ERR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $_.ErrorDetails.Message }
}
