// ==UserScript==
// @name         나라장터 공고번호 자동조회
// @namespace    https://chunsame.github.io/g2b-online-marketing-bids/
// @version      1.0.3
// @description  마케팅 입찰공고 목록에서 넘어온 공고번호를 나라장터 검색칸에 자동 입력하고 공지/안내 팝업을 정리합니다.
// @match        https://www.g2b.go.kr/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const HASH_KEY = "g2bBidNo";
  const DONE_KEY = "g2bAutoSearchDone";
  const STATUS_ID = "g2b-auto-search-status";
  const MAX_WAIT_MS = 30000;
  const INTERVAL_MS = 700;
  const POPUP_CLEAN_MS = 30000;

  const cleanBidNo = (value) => String(value || "").trim().replace(/-\d+$/, "");

  function getParamValue(source) {
    try {
      const params = new URLSearchParams(source);
      return cleanBidNo(params.get(HASH_KEY));
    } catch (_) {
      return "";
    }
  }

  function getBidNo() {
    const incoming =
      getParamValue(window.location.hash.replace(/^#/, "")) ||
      getParamValue(window.location.search) ||
      getParamValue(window.name || "");

    if (incoming) {
      sessionStorage.setItem(HASH_KEY, incoming);
      sessionStorage.removeItem(DONE_KEY);
      return incoming;
    }
    return cleanBidNo(sessionStorage.getItem(HASH_KEY));
  }

  function showStatus(message, tone = "info") {
    let box = document.getElementById(STATUS_ID);
    if (!box) {
      box = document.createElement("div");
      box.id = STATUS_ID;
      box.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "z-index:2147483647",
        "max-width:420px",
        "padding:13px 15px",
        "border-radius:12px",
        "box-shadow:0 12px 30px rgba(15,23,42,.22)",
        "font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "color:#fff"
      ].join(";");
      document.documentElement.appendChild(box);
    }
    box.style.background = tone === "error" ? "#b42318" : tone === "ok" ? "#047857" : "#175cd3";
    box.textContent = message;
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function safeClick(el) {
    if (!isVisible(el)) return false;
    try {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      if (typeof el.click === "function") el.click();
      return true;
    } catch (_) {
      return false;
    }
  }

  function hideElement(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    try {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("pointer-events", "none", "important");
      return true;
    } catch (_) {
      return false;
    }
  }

  function removeDimLayers() {
    const dimSelectors = [
      "[class*='dim']",
      "[class*='Dim']",
      "[class*='modal-backdrop']",
      "[class*='overlay']",
      "[class*='Overlay']",
      "[id*='dim']",
      "[id*='Dim']"
    ];
    for (const el of Array.from(document.querySelectorAll(dimSelectors.join(",")))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.4 && rect.height > window.innerHeight * 0.4) hideElement(el);
    }
  }

  function getPopupRoot(el) {
    let cur = el;
    for (let i = 0; cur && i < 8; i += 1, cur = cur.parentElement) {
      if (!isVisible(cur)) continue;
      const rect = cur.getBoundingClientRect();
      const text = (cur.innerText || cur.textContent || "").slice(0, 1200);
      const looksPopup =
        /나라장터 공지사항|안내 메시지|최대 검색기간|2차 인증 확대 적용/.test(text) &&
        rect.width > 180 &&
        rect.height > 100;
      if (looksPopup) return cur;
    }
    return null;
  }

  function clickCloseButtons() {
    const closeWords = ["오늘 하루", "닫기", "팝업 닫기", "close", "확인", "×", "X"];
    const selectors = [
      "button",
      "a",
      "[role='button']",
      "input[type='button']",
      "input[type='submit']",
      "[id*='close']",
      "[id*='Close']",
      "[class*='close']",
      "[class*='Close']",
      "[title*='닫기']",
      "[aria-label*='닫기']"
    ].join(",");

    for (const target of Array.from(document.querySelectorAll(selectors))) {
      const label = `${target.innerText || ""} ${target.textContent || ""} ${target.value || ""} ${target.title || ""} ${target.id || ""} ${target.className || ""} ${target.getAttribute("aria-label") || ""}`.trim();
      const parentText = (target.closest("div, section, article, dialog")?.innerText || "").slice(0, 1200);
      const inNotice = /나라장터 공지사항|안내 메시지|최대 검색기간|2차 인증 확대 적용/.test(parentText);
      const looksClose = closeWords.some((word) => label.toLowerCase().includes(word.toLowerCase())) || /close|btn.?x|popup.?close/i.test(label);
      if (inNotice || looksClose) safeClick(target);
    }
  }

  function hideKnownPopups() {
    const markers = ["나라장터 공지사항", "안내 메시지", "최대 검색기간", "2차 인증 확대 적용"];
    const nodes = Array.from(document.querySelectorAll("div, section, article, dialog, iframe, form"));
    for (const node of nodes) {
      const text = (node.innerText || node.textContent || "").slice(0, 1500);
      if (!markers.some((marker) => text.includes(marker))) continue;
      const root = getPopupRoot(node) || node;
      hideElement(root);
    }
    removeDimLayers();
  }

  function closeNoticePopups() {
    clickCloseButtons();
    window.setTimeout(clickCloseButtons, 80);
    window.setTimeout(hideKnownPopups, 180);
  }

  function keepClosingPopups(duration = POPUP_CLEAN_MS) {
    const startedAt = Date.now();
    closeNoticePopups();
    const popupTimer = window.setInterval(() => {
      closeNoticePopups();
      if (Date.now() - startedAt > duration) window.clearInterval(popupTimer);
    }, 350);
  }

  function setValue(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  function isUsableInput(input) {
    return !!input && !input.disabled && !input.readOnly && isVisible(input);
  }

  function findSearchInput() {
    const selectors = [
      'input[id$="totBizNo"]',
      'input[id*="totBizNo"]',
      'input[id$="sbxBizNo"]',
      'input[id*="sbxBizNo"]',
      'input[title*="입찰공고번호"]',
      'input[title*="사업번호"]'
    ];
    for (const selector of selectors) {
      const input = Array.from(document.querySelectorAll(selector)).find(isUsableInput);
      if (input) return input;
    }
    const bidButton = document.querySelector('a[id$="btnBidPbancDtlSrch"], a[id*="btnBidPbancDtlSrch"]');
    if (bidButton) {
      const container = bidButton.closest("section, article, div") || document.body;
      const input = Array.from(container.querySelectorAll('input[title*="검색어"], input[placeholder*="검색어"]')).find(isUsableInput);
      if (input) return input;
    }
    return Array.from(document.querySelectorAll('input[title*="검색어"], input[placeholder*="검색어"]')).find(isUsableInput) || null;
  }

  function findSearchButton() {
    const selectors = [
      'a[id$="btnUntyDtlSrch"]',
      'a[id*="btnUntyDtlSrch"]',
      'a[id$="btnBidPbancDtlSrch"]',
      'a[id*="btnBidPbancDtlSrch"]',
      'input[id$="trigger1"]',
      'input[id*="trigger1"]'
    ];
    for (const selector of selectors) {
      const button = Array.from(document.querySelectorAll(selector)).find(isVisible);
      if (button) return button;
    }
    return null;
  }

  function run() {
    const bidNo = getBidNo();
    if (!bidNo) return;

    keepClosingPopups();

    if (sessionStorage.getItem(DONE_KEY) === bidNo) {
      showStatus(`나라장터 자동조회 완료: ${bidNo}`, "ok");
      return;
    }

    const startedAt = Date.now();
    showStatus(`나라장터 자동조회 준비 중: ${bidNo}`);

    const timer = window.setInterval(() => {
      closeNoticePopups();
      const input = findSearchInput();
      const button = findSearchButton();

      if (input && button) {
        window.clearInterval(timer);
        setValue(input, bidNo);
        sessionStorage.setItem(DONE_KEY, bidNo);
        showStatus(`공고번호 ${bidNo} 입력 완료 — 검색합니다.`, "ok");
        window.setTimeout(() => {
          safeClick(button);
          keepClosingPopups();
        }, 400);
        return;
      }

      if (Date.now() - startedAt > MAX_WAIT_MS) {
        window.clearInterval(timer);
        showStatus("자동조회 실패: 나라장터 검색칸을 찾지 못했습니다. 페이지가 완전히 열린 뒤 새로고침해 주세요.", "error");
      }
    }, INTERVAL_MS);
  }

  run();
  window.addEventListener("hashchange", run);
})();
