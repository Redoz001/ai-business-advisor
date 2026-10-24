$path = "c:\Users\redoz\OneDrive\Documents\Reuben\ai-business-advisor\supabase\functions\reuben-ai\reuben_engine.ts"
$lines = Get-Content $path

# Fix line 138 (0-indexed 137): change content: ` to content: systemPrompt ?? `
# Use single quotes to avoid backtick interpretation
$lines[137] = '  content: systemPrompt ?? `'

# Fix: Insert intelligenceLevel/isBasic after line 244 (0-indexed 243)
$insertAfter = 243
$line1 = '  const intelligenceLevel = context?.intelligenceLevel ?? ''basic'';'
$line2 = '  const isBasic = intelligenceLevel === ''basic'';'
 
$top = $lines[0..$insertAfter]
$bottom = $lines[($insertAfter + 1)..($lines.Count - 1)]
$lines = $top + @($line1, $line2) + $bottom

Set-Content $path -Value $lines -Encoding UTF8
Write-Host "Done. Total lines: " $lines.Count

# Verify
$check1 = Select-String -Path $path -Pattern "systemPrompt"
$check2 = Select-String -Path $path -Pattern "intelligenceLevel"
Write-Host "systemPrompt lines: " $check1.LineNumber
Write-Host "intelligenceLevel lines: " $check2.LineNumber