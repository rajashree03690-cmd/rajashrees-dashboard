$f = 'c:\Antigravity_projects\rajashreeSetup\CleanDashboard\supabase\functions\order-notification\index.ts'
$bytes = [System.IO.File]::ReadAllBytes($f)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Fix "Refund Initiated" subject and title - remove garbled emoji after it
$content = $content -replace 'Refund Initiated [^\x00-\x7F]+','Refund Initiated -'
# Fix "Track Your Shipment" - remove garbled emoji before it  
$content = $content -replace '[^\x00-\x7F]+\s*Track Your Shipment','Track Your Shipment'
# Fix "Estimated delivery" - remove garbled emoji before it
$content = $content -replace '[^\x00-\x7F]+\s*Estimated delivery','Estimated delivery'
# Fix "Refund Timeline" - remove garbled emoji before it
$content = $content -replace '[^\x00-\x7F]+\s*Refund Timeline','Refund Timeline'

[System.IO.File]::WriteAllText($f, $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done - fixed encoding issues"
