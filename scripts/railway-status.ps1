# Polls deployment status. Pass deploy ID via -DeployId, or it picks the latest.
param([string]$DeployId = 'd4c9cc0d-c208-4269-9f88-f29e01ad55e1')

$ErrorActionPreference = 'Stop'
$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
$tok = (($tokLine.Line -split '=',2)[1]).Trim().Trim('"')

$query = @'
query($id: String!) {
  deployment(id: $id) {
    id status canRedeploy createdAt updatedAt staticUrl url
  }
}
'@
$body = @{ query = $query; variables = @{ id = $DeployId } } | ConvertTo-Json -Compress -Depth 6
$r = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
  -Headers @{ 'Project-Access-Token' = $tok; 'Content-Type'='application/json' } `
  -Body $body -TimeoutSec 30
$r | ConvertTo-Json -Depth 6
