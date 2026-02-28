# 测试火山引擎API连接
$headers = @{
    "Authorization" = "Bearer 466c7d7b-5777-4928-86b3-253eb215759e"
    "Content-Type" = "application/json"
}

$body = @{
    model = "deepseek-v3-2-251201"
    stream = $false
    input = @(
        @{
            role = "user"
            content = @(
                @{
                    type = "input_text"
                    text = "测试API连接"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "正在测试API连接..."
Write-Host "URL: https://ark.cn-beijing.volces.com/api/v3/responses"

try {
    $response = Invoke-RestMethod -Uri "https://ark.cn-beijing.volces.com/api/v3/responses" -Method POST -Headers $headers -Body $body
    Write-Host "✅ API连接成功!"
    Write-Host "响应:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ API连接失败:"
    Write-Host "错误信息: $($_.Exception.Message)"
    if ($_.ErrorDetails) {
        Write-Host "详细错误: $($_.ErrorDetails.Message)"
    }
}