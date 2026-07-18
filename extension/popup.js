import { BridgeError } from "./lib/errors.js";
import { parseSessionJson } from "./lib/session.js";

const form = document.querySelector("#session-form");
const textarea = document.querySelector("#session-json");
const submitButton = document.querySelector("#submit-button");
const clearButton = document.querySelector("#clear-button");
const characterCount = document.querySelector("#character-count");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");

function updateInputState() {
  const length = textarea.value.length;
  characterCount.textContent = `${length.toLocaleString("zh-CN")} 字符`;
  clearButton.hidden = length === 0;
}

function setStatus(kind, message) {
  status.hidden = false;
  status.dataset.kind = kind;
  statusText.textContent = message;
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  textarea.readOnly = isBusy;
  form.setAttribute("aria-busy", String(isBusy));
  submitButton.classList.toggle("is-loading", isBusy);
}

textarea.addEventListener("input", updateInputState);

clearButton.addEventListener("click", () => {
  textarea.value = "";
  status.hidden = true;
  updateInputState();
  textarea.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setStatus("working", "正在本机解析并验证会话…");

  try {
    if (textarea.value.length === 0) {
      throw new BridgeError(
        "EMPTY_INPUT",
        "请先粘贴完整的会话 JSON。",
      );
    }

    const { sessionToken } = parseSessionJson(textarea.value);
    const result = await chrome.runtime.sendMessage({
      type: "OPEN_SESSION",
      sessionToken,
    });
    if (!result?.ok) {
      throw new BridgeError(
        result?.code ?? "OPEN_SESSION_FAILED",
        result?.error ?? "无法打开隔离会话。",
      );
    }

    textarea.value = "";
    updateInputState();
    setStatus(
      "success",
      "已在无痕窗口中打开。关闭该窗口即可清理会话。",
    );
  } catch (error) {
    setStatus(
      "error",
      error?.safeMessage ?? "本地处理失败，请重试。",
    );
  } finally {
    setBusy(false);
  }
});

updateInputState();
