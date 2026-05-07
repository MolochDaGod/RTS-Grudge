param([string]$Root, [int]$Top = 20)
Get-ChildItem $Root -Recurse -File -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending |
  Select-Object -First $Top |
  ForEach-Object {
    [PSCustomObject]@{
      SizeMB = [math]::Round($_.Length / 1MB, 2)
      Path   = $_.FullName.Substring((Get-Location).Path.Length + 1)
    }
  } | Format-Table -AutoSize
