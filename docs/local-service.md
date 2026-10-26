# 早期 macOS 本地服务

`src/` 是浏览器扩展之前的实现，保留用于开发参考。日常使用推荐安装 `extension/`，无需运行此服务。

该服务需要 macOS、Node.js 22+ 和已安装的 Microsoft Edge：

```sh
npm ci
npm start
```

启动后在本机提供输入页面，使用 Playwright 启动单独的 Edge 临时配置文件。退出时清理临时配置。它与已安装扩展的窗口和状态互不管理。

该实现的 JSON 输入上限仍为 32 KiB，与扩展的 128 KiB 不同。不建议将本机服务暴露到公网。
