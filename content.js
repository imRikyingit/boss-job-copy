(function () {
  const BUTTON_ID = "boss-copy-detail-btn";
  const TARGET_SELECTOR = ".job-detail-body";
  const DESCRIPTION_SELECTOR = "p.desc";
  const PROBE_DELAYS = [300, 600, 1000, 1600, 2400, 3200, 4500];
  const CHECK_INTERVAL_MS = 5000;
  let probeTimer = 0;
  let periodicTimer = 0;
  let isButtonVisible = false;

  function getTargetElement() {
    return document.querySelector(TARGET_SELECTOR);
  }

  function normalizeText(raw) {
    return raw.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function getDescriptionElement() {
    const root = getTargetElement();
    if (root) {
      const inRoot = root.querySelector(DESCRIPTION_SELECTOR);
      if (inRoot) {
        return inRoot;
      }
    }
    return document.querySelector(DESCRIPTION_SELECTOR);
  }

  function getDescriptionText() {
    const descElement = getDescriptionElement();
    if (!descElement) {
      return "";
    }

    let text = descElement.innerText || "";
    text = normalizeText(text);
    return text;
  }

  async function copyText(text) {
    if (!text) {
      throw new Error("No content to copy");
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!ok) {
      throw new Error("Fallback copy failed");
    }
  }

  function setButtonState(button, state, label) {
    if (button.dataset.state === state && button.textContent === label) {
      return;
    }
    button.dataset.state = state;
    button.textContent = label;
  }

  function ensureButton() {
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.className = "boss-copy-btn";
      button.title = "复制招聘文本，可粘贴到 AI 工具分析";
      button.setAttribute("aria-label", "复制招聘文本");
      button.addEventListener("click", async () => {
        try {
          const text = getDescriptionText();
          await copyText(text);
          setButtonState(button, "success", "已复制");
        } catch (err) {
          setButtonState(button, "error", "复制失败");
        }

        window.setTimeout(() => {
          const exists = !!getDescriptionElement();
          setButtonState(button, exists ? "ready" : "hidden", exists ? "复制招聘文本" : "等待招聘详情...");
          if (!exists) {
            button.classList.remove("is-visible");
            isButtonVisible = false;
          }
        }, 1200);
      });
      document.body.appendChild(button);
    }

    return button;
  }

  function renderButtonVisibility(hasTarget) {
    const button = ensureButton();
    if (hasTarget === isButtonVisible) {
      return;
    }
    isButtonVisible = hasTarget;

    if (hasTarget) {
      button.classList.add("is-visible");
      if (button.dataset.state !== "success") {
        setButtonState(button, "ready", "复制招聘文本");
      }
    } else {
      button.classList.remove("is-visible");
      setButtonState(button, "hidden", "等待招聘详情...");
    }
  }

  function clearProbeTimer() {
    if (probeTimer) {
      window.clearTimeout(probeTimer);
      probeTimer = 0;
    }
  }

  function probeForTarget(attempt) {
    clearProbeTimer();

    const hasTarget = !!getDescriptionElement();
    renderButtonVisibility(hasTarget);

    if (hasTarget || attempt >= PROBE_DELAYS.length - 1) {
      return;
    }

    const delay = PROBE_DELAYS[attempt + 1];
    probeTimer = window.setTimeout(() => probeForTarget(attempt + 1), delay);
  }

  function startProbe() {
    probeForTarget(0);
  }

  function watchPage() {
    ensureButton();
    startProbe();

    window.addEventListener("popstate", startProbe);
    window.addEventListener("hashchange", startProbe);
    document.addEventListener("click", startProbe, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        startProbe();
      }
    });

    const observer = new MutationObserver(() => startProbe());
    observer.observe(document.body, { childList: true, subtree: true });

    periodicTimer = window.setInterval(startProbe, CHECK_INTERVAL_MS);
    window.addEventListener("beforeunload", () => {
      clearProbeTimer();
      if (periodicTimer) {
        window.clearInterval(periodicTimer);
        periodicTimer = 0;
      }
      observer.disconnect();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchPage, { once: true });
  } else {
    watchPage();
  }
})();
