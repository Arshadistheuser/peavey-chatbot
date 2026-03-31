/**
 * Peavey Support Chatbot — Embeddable Widget
 *
 * Add this to any website with:
 * <script src="https://your-domain.com/widget.js"></script>
 *
 * Optional config:
 * <script src="https://your-domain.com/widget.js" data-position="bottom-right" data-accent="#dc2626"></script>
 */
(function () {
  "use strict";

  // Get config from script tag
  var script = document.currentScript;
  var baseUrl = script
    ? script.src.replace("/widget.js", "")
    : window.location.origin;
  var position = (script && script.getAttribute("data-position")) || "bottom-right";
  var accent = (script && script.getAttribute("data-accent")) || "#dc2626";

  // Prevent double initialization
  if (window.__peaveyWidget) return;
  window.__peaveyWidget = true;

  // Create styles
  var style = document.createElement("style");
  style.textContent =
    "#peavey-widget-bubble{position:fixed;z-index:99999;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg," +
    accent +
    ",#7f1d1d);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(220,38,38,0.3);transition:transform 0.2s,box-shadow 0.2s}" +
    "#peavey-widget-bubble:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(220,38,38,0.4)}" +
    "#peavey-widget-bubble svg{width:26px;height:26px;fill:white}" +
    "#peavey-widget-frame{position:fixed;z-index:99998;border:none;border-radius:16px;box-shadow:0 8px 48px rgba(0,0,0,0.5);overflow:hidden;transition:opacity 0.25s,transform 0.25s;opacity:0;transform:translateY(12px) scale(0.95);pointer-events:none}" +
    "#peavey-widget-frame.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}" +
    (position === "bottom-left"
      ? "#peavey-widget-bubble{bottom:20px;left:20px}#peavey-widget-frame{bottom:88px;left:20px}"
      : "#peavey-widget-bubble{bottom:20px;right:20px}#peavey-widget-frame{bottom:88px;right:20px}") +
    "@media(max-width:480px){#peavey-widget-frame{width:calc(100vw - 16px)!important;height:calc(100vh - 100px)!important;bottom:80px!important;right:8px!important;left:8px!important;border-radius:12px}}";
  document.head.appendChild(style);

  // Create bubble button
  var bubble = document.createElement("button");
  bubble.id = "peavey-widget-bubble";
  bubble.setAttribute("aria-label", "Open Peavey Support Chat");
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';
  document.body.appendChild(bubble);

  // Create iframe
  var frame = document.createElement("iframe");
  frame.id = "peavey-widget-frame";
  frame.src = baseUrl + "/widget";
  frame.style.width = "380px";
  frame.style.height = "560px";
  frame.setAttribute("title", "Peavey Support Chat");
  frame.setAttribute("allow", "clipboard-write; microphone");
  document.body.appendChild(frame);

  // Toggle open/close
  var isOpen = false;
  bubble.addEventListener("click", function () {
    isOpen = !isOpen;
    if (isOpen) {
      frame.classList.add("open");
      bubble.innerHTML =
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/></svg>';
    } else {
      frame.classList.remove("open");
      bubble.innerHTML =
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';
    }
  });

  // Send page context to iframe
  frame.addEventListener("load", function () {
    frame.contentWindow.postMessage(
      {
        type: "peavey-context",
        url: window.location.href,
        title: document.title,
      },
      "*"
    );
  });
})();
