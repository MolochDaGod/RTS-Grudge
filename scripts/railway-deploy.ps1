# Triggers a deploy + generates a public domain on the rts-grudge-server service.
$ErrorActionPreference = 'Stop'
$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
if (-not $tokLine) { throw 'RTS_GRUDGE_RAILWAY_API not found in .env' }
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

# 1) trigger deployment
Write-Host "Triggering deploy..."
$deployMut = 'mutation($serviceId: String!, $environmentId: String!) { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId) }'
try {
  $r = Invoke-Rail $deployMut @{ serviceId = $serviceId; environmentId = $envId }
  $r | ConvertTo-Json -Depth 6
} catch {
  Write-Host "deployV2 failed, trying serviceInstanceDeploy..."
  $deployMut2 = 'mutation($serviceId: String!, $environmentId: String!) { serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) }'
  $r = Invoke-Rail $deployMut2 @{ serviceId = $serviceId; environmentId = $envId }
  $r | ConvertTo-Json -Depth 6
}

# 2) generate a public domain
Write-Host "`nGenerating public domain..."
$domainMut = @'
mutation($serviceId: String!, $environmentId: String!) {
  serviceDomainCreate(input: { serviceId: $serviceId, environmentId: $environmentId, targetPort: 8080 }) {
    domain
  }
}
'@
try {
  $r2 = Invoke-Rail $domainMut @{ serviceId = $serviceId; environmentId = $envId }
  $r2 | ConvertTo-Json -Depth 6
} catch {
  Write-Host "serviceDomainCreate failed: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $_.ErrorDetails.Message }
}
