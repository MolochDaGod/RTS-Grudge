Get-ChildItem -Directory | Where-Object { $_.Name -notin @('node_modules', '.git') } | ForEach-Object {
  $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  [PSCustomObject]@{ Name = $_.Name; SizeMB = [math]::Round($size / 1MB, 1) }
} | Sort-Object SizeMB -Descending | Format-Table -AutoSize
