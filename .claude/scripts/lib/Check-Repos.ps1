# Audit org repos: cloned at expected paths, branch, dirtiness.
# Reads ~/.claude/memory/repositories.json if present, else falls back to known list.

. "$PSScriptRoot\Common.ps1"

function Get-RepoMap {
    $oss = "$env:USERPROFILE"  # repos live at user-home root, not under ~/oss anymore
    $userHome = $env:USERPROFILE
    $memoryFile = "$script:ClaudeDir\memory\repositories.json"

    if (Test-Path $memoryFile) {
        try {
            $data = Get-Content $memoryFile -Raw | ConvertFrom-Json
            if ($data.repos) {
                $map = [ordered]@{}
                foreach ($p in $data.repos.PSObject.Properties) {
                    $map[$p.Name] = $ExecutionContext.InvokeCommand.ExpandString($p.Value)
                }
                return $map
            }
        } catch { }
    }

    # Fallback — matches today's sync-repos.ps1
    [ordered]@{
        codebase             = "$userHome\codebase"
        kun                  = "$userHome\kun"
        shadcn               = "$oss\shadcn"
        radix                = "$oss\radix"
        hogwarts             = "$oss\hogwarts"
        souq                 = "$oss\souq"
        mkan                 = "$oss\mkan"
        shifa                = "$oss\shifa"
        'swift-app'          = "$oss\swift-app"
        'distributed-computer' = "$oss\distributed-computer"
        marketing            = "$oss\marketing"
    }
}

function Test-Repos {
    $r = @()
    $repos = Get-RepoMap

    foreach ($name in $repos.Keys) {
        $path = $repos[$name]
        if (-not (Test-Path $path)) {
            $r += New-CheckResult -Category 'ORG REPOS' -Name $name -Status fail `
                -Detail 'not cloned' -Fix "clone-$name"
            continue
        }
        Push-Location $path
        try {
            $branch  = (git branch --show-current 2>$null).Trim()
            $commit  = (git rev-parse --short HEAD 2>$null).Trim()
            $changes = (git status --porcelain 2>$null | Measure-Object).Count
            if ($changes -gt 0) {
                $r += New-CheckResult -Category 'ORG REPOS' -Name $name -Status warn `
                    -Detail "$changes uncommitted · $branch · $commit"
            } else {
                $r += New-CheckResult -Category 'ORG REPOS' -Name $name -Status pass `
                    -Detail "clean · $branch · $commit"
            }
        } catch {
            $r += New-CheckResult -Category 'ORG REPOS' -Name $name -Status warn `
                -Detail 'unable to read git state'
        } finally {
            Pop-Location
        }
    }

    $r
}
