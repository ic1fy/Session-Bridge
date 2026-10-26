# Session Bridge

在独立的无痕窗口中打开本人或已获授权的 ChatGPT 会话，保留普通浏览窗口的登录状态。

这是一个使用原生 JavaScript 编写的 Manifest V3 浏览器扩展，当前版本为 **0.1.0**。主要在 Microsoft Edge 上使用，也提供 Google Chrome 的安装方法。扩展安装后无需运行 Node.js、Playwright 或本地服务器。

## 功能

- 本机解析完整 Session JSON，支持最大 **128 KiB（UTF-8 字节）**的输入。
- 检查 `sessionToken` 格式及可选的 `expires` 到期时间。
- 创建无痕窗口，将会话 Cookie 写入该窗口对应的 Cookie 存储。
- 通过 ChatGPT 验证会话，再在同一个标签页打开 ChatGPT。
- 验证失败时回滚；关闭目标窗口时清理导入的会话 Cookie。

本项目不提供套餐购买、充值或银行卡填写功能，也不是 OpenAI 官方产品。

## 下载与安装

### 获取文件

任选一种方式：

- 从 [Releases](https://github.com/ic1fy/Session-Bridge/releases) 下载 `session-bridge-chromium-extension.zip` 并解压。
- 在仓库首页点击 **Code → Download ZIP** 并解压。
- 使用 Git：`git clone https://github.com/ic1fy/Session-Bridge.git`。

下面需要选择的是 **`extension` 文件夹**，其中应能直接看到 `manifest.json`。不要选择 ZIP 文件或整个项目根目录。

### Microsoft Edge

1. 在地址栏输入 `edge://extensions/`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”，选择解压后的 `extension` 文件夹。
4. 找到 **Session Bridge → 详细信息**。
5. 开启 **允许 InPrivate / 允许在 InPrivate 中使用**（名称可能随浏览器语言和版本不同）。
6. 在工具栏的扩展菜单中，将 **Session Bridge** 固定到工具栏。

### Google Chrome

1. 在地址栏输入 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择 `extension` 文件夹。
4. 打开扩展的“详细信息”，开启 **在无痕模式下启用**。
5. 在扩展菜单中将 **Session Bridge** 固定到工具栏。

**安装后保留 `extension` 文件夹的位置。** 开发模式直接读取这些文件，删除或移动目录会导致扩展无法加载。

## 使用方法

1. 在普通浏览窗口登录 [ChatGPT](https://chatgpt.com/)。
2. 登录后打开 [会话页面](https://chatgpt.com/api/auth/session)，复制页面显示的完整 JSON。
3. 关闭当前浏览器配置文件中的其他无痕窗口。
4. 点击工具栏的 **Session Bridge** 图标，将 JSON 粘贴到输入框。
5. 点击 **验证并打开无痕窗口**。验证成功后会自动打开 ChatGPT。
6. 使用结束后关闭该无痕窗口。再次使用时重新粘贴有效的 Session JSON。

JSON 必须包含 `sessionToken`。仅有 `accessToken` 的 JSON 不受支持；如果会话页面没有返回 `sessionToken`，当前版本无法导入，请使用 ChatGPT 官方登录流程。

输入框显示的是字符数，128 KiB 限制按 UTF-8 字节计算；中文字符通常占多个字节。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 提示开启无痕访问权限 | 在扩展详情中开启允许 InPrivate / 在无痕模式下启用，再重试。 |
| 提示先关闭其他无痕窗口 | 同一配置文件下的无痕窗口共享 Cookie 存储。关闭这些窗口后再导入。 |
| 提示缺少 `sessionToken` | 检查是否复制了完整 JSON；只有 `accessToken` 不能使用。 |
| 提示 JSON 无效或 JWE 不完整 | 重新复制完整内容，不要带 Markdown 代码块标记或手动修改 Token。 |
| 提示会话已过期或未被接受 | 在来源账号重新登录，再复制新的会话 JSON。 |
| 验证连接失败 | 检查当前浏览器是否能正常访问 ChatGPT，然后重试。 |
| 提示正在打开会话 | 等待当前操作完成，避免同时在多个面板提交。 |
| 更新文件后界面没有变化 | 在扩展管理页点击 Session Bridge 的“重新加载”。 |

## 数据与权限

Session JSON 包含登录凭证。只导入本人或已获授权的会话，不要将真实 JSON、Token、Cookie 或包含它们的截图提交到 GitHub Issue。

扩展在本机解析 JSON，不发送到项目作者或第三方服务器。导入的 Cookie 会由浏览器发送给 **chatgpt.com**，用于验证和使用账号。扩展不记录 Token 日志，不将凭证写入 `storage.local` / `storage.sync`；`storage.session` 只保存窗口 ID 和 Cookie 存储 ID。输入框在导入成功后清空，失败时保留内容以便重试。

| 权限 | 用途 |
| --- | --- |
| `cookies` | 在目标无痕 Cookie 存储中写入和清理 ChatGPT 会话 Cookie。 |
| `scripting` | 读取会话验证页，确认服务端是否接受该会话。 |
| `storage` | 在浏览器会话期间记录受管理窗口的 ID。 |
| `tabs` | 导航到验证页和 ChatGPT，观察页面加载状态。 |
| `https://chatgpt.com/*` | 将站点访问范围限制在 ChatGPT。 |
| 用户手动允许无痕访问 | 让扩展能够创建和操作无痕会话。 |

新建无痕窗口与普通窗口的 Cookie 分开，但**同一配置文件的无痕窗口并不彼此隔离**。导入期间和使用过程中，不要再用其他无痕窗口登录另一个 ChatGPT 账号。这里也不会获得独立的网络身份。

该工具依赖 ChatGPT 当前的会话格式和 Cookie 命名；网站变更可能导致兼容性失效。本地格式检查不验证 Token 的真实性，最终以 ChatGPT 的验证结果为准。

## 开发与验证

开发及运行全部测试需要 Node.js 22 或以上；安装扩展本身不需要 Node.js。

```sh
npm ci
npm test
npm run package:extension
```

打包命令需要 POSIX shell 和 `zip`（macOS/Linux 可直接使用，Windows 可在 Git Bash 或 WSL 中运行）。输出文件：

```text
dist/session-bridge-chromium-extension.zip
```

ZIP 只包含 `extension/`，不包含开发依赖、Git 历史或早期本地服务。修改扩展文件后，在浏览器扩展管理页点击“重新加载”。测试使用合成数据，不需要真实账号或 Session JSON。

## 项目结构

```text
extension/
  popup.html / popup.css / popup.js   输入面板
  background.js                      扩展事件入口
  lib/session-request.js             请求验证和并发控制
  lib/session.js                     JSON、JWE 格式与过期检查
  lib/session-cookies.js              Cookie 构造与分段
  lib/browser-session.js              无痕窗口、验证和清理
  lib/errors.js                      可展示的错误
  assets/                            本地图标
scripts/package-extension.sh         扩展打包
test/                                自动化测试
docs/                                架构及开发说明
src/                                 保留的早期 macOS 本地服务
```

浏览器扩展与 `src/` 中的早期本地服务独立。普通使用者只需要 `extension/`；早期服务不随扩展安装，也不属于推荐使用入口。详见 [架构说明](docs/architecture.md) 和 [早期本地服务说明](docs/local-service.md)。
