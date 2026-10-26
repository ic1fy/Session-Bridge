<h1 align="center">Session Bridge</h1>

用于 Microsoft Edge 和 Google Chrome，在无痕窗口中打开本人或已获授权的 ChatGPT 会话。

## 安装

从 [Releases](https://github.com/ic1fy/Session-Bridge/releases) 下载安装包，或点击 **Code → Download ZIP** 下载源码，解压后安装：

| 浏览器 | 扩展管理页 | 加载方式 | 详情页中需要开启 |
| --- | --- | --- | --- |
| Edge | `edge://extensions/` | 开发人员模式 → 加载解压缩的扩展 | 允许在 InPrivate 中使用 |
| Chrome | `chrome://extensions/` | 开发者模式 → 加载已解压的扩展程序 | 在无痕模式下启用 |

选择 **`extension` 文件夹**，其中应直接包含 `manifest.json`。然后在浏览器的扩展菜单中，将 Session Bridge 固定到工具栏。

安装后请保留该文件夹的位置；更新文件后，在扩展管理页点击“重新加载”。

## 使用

1. 在普通窗口登录 [ChatGPT](https://chatgpt.com/)。
2. 打开 [会话页面](https://chatgpt.com/api/auth/session)，复制完整 JSON。
3. 关闭当前浏览器配置文件中的其他无痕窗口。
4. 点击工具栏的 **Session Bridge**，粘贴 JSON。
5. 点击 **验证并打开无痕窗口**，验证成功后自动进入 ChatGPT。
6. 使用结束后关闭该无痕窗口。

支持最大 **128 KiB** 的完整 JSON，内容须包含 `sessionToken`。

## 常见问题

| 提示 | 处理方式 |
| --- | --- |
| 需要开启无痕权限 | 在扩展详情中开启上表对应的开关。 |
| 存在其他无痕窗口 | 关闭其他无痕窗口后重试。 |
| JSON 无效、Token 缺失或不完整 | 重新复制完整 JSON，不加代码块标记；没有 `sessionToken` 时使用官方登录流程。 |
| 会话过期或未被接受 | 在来源账号重新登录并复制新 JSON。 |
| 无法连接验证页 | 检查浏览器能否正常访问 ChatGPT。 |

> Session JSON 是登录凭证，请勿分享。同一浏览器配置文件的无痕窗口共享登录状态，使用期间不要在其他无痕窗口登录另一个账号。
