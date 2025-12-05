# Commit & push JARVIS_V5_REPO_OVERVIEW.md for Jarvis V5 OS
# Repo: C:\Users\yosiw\Desktop\Jarvis-main

Set-Location 'C:\Users\yosiw\Desktop\Jarvis-main'

Write-Host '📁 Repo path:' (Get-Location)

# Stage the repo overview doc (no-op if already staged/committed)
git add JARVIS_V5_REPO_OVERVIEW.md

# Commit with a clear message if there is anything to commit
$status = git status --porcelain
if ($status) {
  Write-Host '✅ Changes detected, creating commit...'
  git commit -m "Docs: add Jarvis V5 repo owner overview"
} else {
  Write-Host 'ℹ️ No changes to commit for JARVIS_V5_REPO_OVERVIEW.md.'
}

# Push main to origin
Write-Host '🚀 Pushing main to origin...'
git push origin main

# Show final short status
Write-Host ''
Write-Host '--- Final git status (short) ---'
git status -sb
Write-Host '--------------------------------'
Write-Host '🎉 Done: repo overview doc is committed and pushed (if there were changes).'
