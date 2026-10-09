$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$resultPath = Join-Path $PSScriptRoot 'test_ad_login.result.json'
$connection = $null
$credential = $null
$result = $null
try {
    Add-Type -AssemblyName System.DirectoryServices.Protocols
    Write-Host 'Test PWA AD login over LDAPS. Credentials will not be saved.'
    $username = (Read-Host 'AD username').Trim()
    if ($username.Contains('\')) { $username = $username.Substring($username.LastIndexOf('\') + 1) }
    if ($username.Contains('@')) { $username = $username.Split('@')[0] }
    if ([string]::IsNullOrWhiteSpace($username)) { throw 'Username is required.' }
    $secret = Read-Host 'AD password' -AsSecureString
    if ($secret.Length -eq 0) { throw 'Password is required.' }
    $credential = New-Object System.Net.NetworkCredential($username, $secret, 'PWA')
    $identifier = New-Object System.DirectoryServices.Protocols.LdapDirectoryIdentifier('R06-DC01.pwa.local', 636)
    $connection = New-Object System.DirectoryServices.Protocols.LdapConnection($identifier, $credential, [System.DirectoryServices.Protocols.AuthType]::Basic)
    $connection.Timeout = [TimeSpan]::FromSeconds(5)
    $connection.SessionOptions.ProtocolVersion = 3
    $connection.SessionOptions.SecureSocketLayer = $true
    $connection.SessionOptions.ReferralChasing = [System.DirectoryServices.Protocols.ReferralChasingOptions]::None
    $connection.Bind()
    $result = [ordered]@{ bindSuccess = $true; profileSuccess = $false; timestamp = [DateTime]::UtcNow.ToString('o') }
    $escaped = $username.Replace('\', '\5c').Replace('*', '\2a').Replace('(', '\28').Replace(')', '\29').Replace([string][char]0, '\00')
    $filter = '(&(objectCategory=person)(sAMAccountName=' + $escaped + '))'
    $attributes = [string[]]@('sAMAccountName', 'displayName', 'givenName', 'sn', 'mail', 'title', 'department', 'company', 'telephoneNumber', 'distinguishedName', 'memberOf')
    # Request all readable standard and operational attributes for this account.
    $request = New-Object System.DirectoryServices.Protocols.SearchRequest('dc=PWA,dc=local', $filter, [System.DirectoryServices.Protocols.SearchScope]::Subtree, [string[]]@('*', '+'))
    $response = [System.DirectoryServices.Protocols.SearchResponse]$connection.SendRequest($request)
    $result.entryCount = $response.Entries.Count
    if ($response.Entries.Count -ne 1) { throw 'Expected exactly one directory account.' }
    $entry = $response.Entries[0]
    $result.profileSuccess = $true
    $result.username = [string]$entry.Attributes['sAMAccountName'][0]
    $result.presentAttributes = @($attributes | Where-Object { $entry.Attributes.Contains($_) })
    $result.missingTemplateAttributes = @($attributes | Where-Object { -not $entry.Attributes.Contains($_) })
    $result.distinguishedName = $entry.DistinguishedName
    $allAttributes = [ordered]@{}
    foreach ($attributeName in @($entry.Attributes.AttributeNames | Sort-Object)) {
        $attribute = $entry.Attributes[$attributeName]
        $values = @(
            for ($i = 0; $i -lt $attribute.Count; $i++) {
                $value = $attribute[$i]
                if ($value -is [byte[]]) {
                    [ordered]@{ encoding = 'base64'; value = [Convert]::ToBase64String($value) }
                } else {
                    [string]$value
                }
            }
        )
        $allAttributes[$attributeName] = $values
    }
    $result.attributes = $allAttributes
    Write-Host 'SUCCESS: AD accepted credentials and the account profile was found.' -ForegroundColor Green
    Write-Host 'All attributes returned by AD (binary values use base64):'
    Write-Host ($result | ConvertTo-Json -Depth 10)
} catch {
    if ($null -eq $result) { $result = [ordered]@{ bindSuccess = $false; profileSuccess = $false; timestamp = [DateTime]::UtcNow.ToString('o') } }
    $result.errorType = $_.Exception.GetType().FullName
    $result.error = $_.Exception.Message
    Write-Host ('FAILED: ' + $result.error) -ForegroundColor Red
} finally {
    if ($null -ne $connection) { $connection.Dispose() }
    if ($null -ne $secret) { $secret.Dispose() }
    $credential = $null
    $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    Write-Host ('Result saved to: ' + $resultPath)
    Read-Host 'Press Enter to close'
}
