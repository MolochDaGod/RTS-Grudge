# Deletes the rts-grudge-server service and recreates it pointing at the latest commit.
# Variables and the public domain will need to be reset afterwards.
$ErrorActionPreference = 'Stop'

$tokLine = (Select-String -Path .env -Pattern '^RTS_GRUDGE_RAILWAY_API=' | Select-Object -First 1)
$tok = (($tokLine.Line -split '=',2)[1]).Trim().Trim('"')

$projectId = '2df16bc4-1455-415a-bb9d-162f59fa841b'
$envId     = 'e4c3ada3-16e6-40a1-a634-b6703620e1dc'
$oldServiceId = '26b25063-e979-4a79-99ec-9a2bb77dd76f'

function Invoke-Rail($query, $variables) {
  $body = @{ query = $query; variables = $variables } | ConvertTo-Json -Compress -Depth 10
  Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
    -Headers @{ 'Project-Access-Token' = $tok; 'Content-Type'='application/json' } `
    -Body $body -TimeoutSec 60
}

# 1) Delete existing service
Write-Host "Deleting old service $oldServiceId..."
try {
  $r = Invoke-Rail 'mutation($id: String!) { serviceDelete(id: $id) }' @{ id = $oldServiceId }
  $r | ConvertTo-Json -Depth 4
} catch {
  Write-Host "delete failed: $($_.Exception.Message)"
  if ($_.ErrorDetails) { $_.ErrorDetails.Message }
}

Start-Sleep -Seconds 5

# 2) Recreate with fresh source clone
Write-Host "`nCreating fresh rts-grudge-server..."
$createMut = @'
mutation($projectId: String!, $environmentId: String!) {
  serviceCreate(input: {
    projectId: $projectId,
    environmentId: $environmentId,
    name: "rts-grudge-server",
    source: { repo: "MolochDaGod/RTS-Grudge" },
    branch: "main"
  }) { id name }
}
'@
$r2 = Invoke-Rail $createMut @{ projectId = $projectId; environmentId = $envId }
$r2 | ConvertTo-Json -Depth 6

$newSvcId = $r2.data.serviceCreate.id
Write-Host "`nNew service ID: $newSvcId"
Write-Host "Save this ID and update scripts/railway-set-vars.ps1 + railway-deploy.ps1 to use it."
