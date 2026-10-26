# Session Bridge Chromium 扩展

Session Bridge 可在 Microsoft Edge 和 Google Chrome 中本机解析 ChatGPT
Session JSON，将登录 Cookie 写入独立的无痕 Cookie 仓，验证后在同一个页签
打开 ChatGPT。

不需要 Node.js、Playwright、本地服务或公网服务器。Session JSON 在本机解析；浏览器会将导入的 Cookie
发送给 chatgpt.com 进行验证和使用。扩展不会将凭证发送给项目作者或第三方，
不会将其保存到扩展持久化存储或输出到日志。

## 安装到 Microsoft Edge

1. 在 Edge 地址栏打开 `edge://extensions`。
2. 开启左侧的“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择本项目的 `extension/` 目录。
5. 找到 Session Bridge，点击“详细信息”。
6. 开启“允许 InPrivate”。
7. 在扩展菜单中将 Session Bridge 固定到工具栏。

## 安装到 Google Chrome

1. 在 Chrome 地址栏打开 `chrome://extensions`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目的 `extension/` 目录。
5. 打开 Session Bridge 的“详细信息”。
6. 开启“在无痕模式下启用”。
7. 在扩展菜单中将 Session Bridge 固定到工具栏。

每个浏览器配置文件只需安装并授权一次。

## 使用

1. 登录 [https://chatgpt.com](https://chatgpt.com)。
2. 登录后打开
   [https://chatgpt.com/api/auth/session](https://chatgpt.com/api/auth/session)。
3. 复制页面显示的全部 JSON，不可缺漏。
4. 点击浏览器右上角工具栏中的 Session Bridge 图标，打开小面板。
5. 粘贴 JSON，点击“验证并打开无痕窗口”。
6. 使用完成后关闭该无痕窗口。

`popup.html` 是扩展的小面板，不需要在标签页中单独打开。验证成功后，浏览器会
自动新建并聚焦一个独立无痕窗口；普通窗口中已经打开的 ChatGPT 不会被替换。

扩展会拒绝与已经打开的其他无痕窗口共用 Cookie 仓。看到提示时，请先关闭
所有无痕窗口，再重新操作。

输入最多支持 **128 KiB（UTF-8 字节）**。字符计数不等同于字节数。
如果 JSON 仅有 `accessToken` 而没有 `sessionToken`，当前版本不能导入。

## 一次性与隔离

- 扩展只读取 `sessionToken` 和可选的 `expires`。
- Token 值超过单个 Cookie 限制时会自动按 3933 个字符分段。
- 写入的是没有持久化到期时间的 Session Cookie。
- 验证页和最终 ChatGPT 页面复用同一个无痕页签。
- 关闭目标窗口时扩展会主动清理 Session Cookie；Edge 也会清理最后一个
  InPrivate 窗口的临时站点数据，Chrome 会清理最后一个无痕窗口的数据。
- 普通浏览窗口中的 ChatGPT 登录不会被替换。

## 安全边界

- Session JSON 等同登录凭证，只处理本人或已获授权账户的数据。
- 不要把 Session JSON、Token 或扩展调试日志发送给其他人。
- 扩展不读取剪贴板，需要用户主动粘贴。
- 扩展不使用 `storage.local` 或 `storage.sync` 保存会话。
- `storage.session` 只短暂保存窗口 ID 和 Cookie 仓 ID，不包含凭证。
- 扩展不加载 CDN、远程字体、统计脚本或远程代码。
- 在原账户执行退出登录或撤销会话，导入的 Session 也可能随即失效。

## 更新与分发

开发模式更新后，在 `edge://extensions` 或 `chrome://extensions` 的 Session
Bridge 卡片上点击“重新加载”。给少数可信用户测试时，可以把整个
`extension/` 目录或项目生成的 ZIP 包发送给对方，由对方按安装步骤加载。

扩展商店发布和自动更新不在当前版本范围内。

## 项目与开发说明

源码、完整 README 和问题反馈：
[ic1fy/Session-Bridge](https://github.com/ic1fy/Session-Bridge)。

提交问题时只提供错误提示和复现步骤，不附带真实会话 JSON 或 Cookie。
