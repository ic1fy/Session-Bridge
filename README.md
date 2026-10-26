# Session Bridge

在无痕窗口中打开本人或已获授权的 ChatGPT 会话，保留普通窗口的登录状态。

适用于 Microsoft Edge / Google Chrome 的 Manifest V3 扩展。原生 JavaScript，无第三方依赖，安装后无需运行本地服务。

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

输入最大 **128 KiB（UTF-8 字节）**，必须包含 `sessionToken`；仅有 `accessToken` 时无法导入。扩展检查格式和可选的到期时间，由 ChatGPT 最终验证会话有效性。

## 常见问题

| 提示 | 处理方式 |
| --- | --- |
| 需要开启无痕权限 | 在扩展详情中开启上表对应的开关。 |
| 存在其他无痕窗口 | 关闭其他无痕窗口后重试；同一配置文件的无痕窗口共享 Cookie。 |
| JSON 无效、Token 缺失或不完整 | 重新复制完整 JSON，不加代码块标记；没有 `sessionToken` 时使用官方登录流程。 |
| 会话过期或未被接受 | 在来源账号重新登录并复制新 JSON。 |
| 无法连接验证页 | 检查浏览器能否正常访问 ChatGPT。 |

## 会话数据

扩展只向 `chatgpt.com` 写入和发送会话 Cookie，不上传到项目作者或第三方，不记录 Token 日志。临时状态只保存窗口 ID 和 Cookie 存储 ID，导入失败会回滚，关闭目标窗口会尝试清理导入的 Cookie。

Session JSON 是登录凭证，请勿提交到 Issue 或分享给他人。使用过程中不要在其他无痕窗口登录另一个账号。该工具非 OpenAI 官方产品，依赖当前会话格式和 Cookie 命名，网站变化可能影响兼容性。
