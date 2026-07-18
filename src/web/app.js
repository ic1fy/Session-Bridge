const root = document.documentElement;
const form = document.querySelector("#session-form");
const textarea = document.querySelector("#session-json");
const button = document.querySelector("#submit-button");
const clearButton = document.querySelector("#clear-button");
const characterCount = document.querySelector("#character-count");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const requestToken = root.dataset.requestToken;

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
  button.disabled = isBusy;
  textarea.readOnly = isBusy;
  form.setAttribute("aria-busy", String(isBusy));
  button.classList.toggle("is-loading", isBusy);
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
  setStatus("working", "正在解析并验证会话…");

  try {
    const response = await fetch("/api/open-edge", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-local-request-token": requestToken,
      },
      body: JSON.stringify({ sessionJson: textarea.value }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "操作失败，请检查粘贴内容。");
    }

    textarea.value = "";
    updateInputState();
    setStatus(
      "success",
      "验证成功。关闭专用 Edge 窗口后，本地会话会自动清理。",
    );
  } catch (error) {
    setStatus("error", error.message || "本地服务处理失败，请重试。");
  } finally {
    setBusy(false);
  }
});

updateInputState();
