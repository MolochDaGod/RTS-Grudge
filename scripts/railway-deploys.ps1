# Lists recent deployments for the rts-grudge-server service.
$ErrorActionPreference = 'Stop'
$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
$tok = (($tokLine.Line -split '=',2)[1]).Trim().Trim('"')

$serviceId = '26b25063-e979-4a79-99ec-9a2bb77dd76f'
$envId     = 'e4c3ada3-16e6-40a1-a634-b6703620e1dc'

$query = @'
query($serviceId: String!, $envId: String!) {
  deployments(first: 5, input: { serviceId: $serviceId, environmentId: $envId }) {
    edges { node { id status createdAt meta } }
  }
}
'@
$body = @{ query = $query; variables = @{ serviceId = $serviceId; envId = $envId } } | ConvertTo-Json -Compress -Depth 6
$r = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
  -Headers @{ 'Project-Access-Token' = $tok; 'Content-Type'='application/json' } `
  -Body $body -TimeoutSec 30
$r | ConvertTo-Json -Depth 8
