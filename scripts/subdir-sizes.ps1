param([string]$Root)
Get-ChildItem $Root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [PSCustomObject]@{ Name = $_.Name; SizeMB = [math]::Round($size / 1MB, 1) }
} | Sort-Object SizeMB -Descending | Format-Table -AutoSize
