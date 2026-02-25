(function() {
var clipboardHistorySupported = document.queryCommandSupported('copy') || document.queryCommandSupported('paste');

if (typeof browser !== 'undefined') { chrome = browser; }

function getSelectedHtml() {
  var html = "";
  if (typeof window.getSelection != "undefined") {
    var sel = window.getSelection();
    if (sel.rangeCount) {
      var container = document.createElement("div");
      for (var i = 0, len = sel.rangeCount; i < len; ++i) {
        var range = sel.getRangeAt(i);
        var content;
        if (range.startContainer.parentNode && range.startContainer.parentNode.tagName && range.startContainer.parentNode.tagName.toLowerCase() === "a" && range.startContainer.nodeType && range.startContainer.nodeType === Node.TEXT_NODE) {
          content = range.startContainer.parentNode.cloneNode(false);
        } else {
          content = range.cloneContents();
        }
        container.appendChild(content);
      }
      html = container.innerHTML;
    }
  } else if (typeof document.selection != "undefined") {
    if (document.selection.type == "Text") {
      html = document.selection.createRange().htmlText;
    }
  }
  return html;
}

function getSelectedHtmlBrutal() {
  var html = "";
  if (typeof window.getSelection != "undefined") {
    var sel = window.getSelection();
    if (sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      var commonAncestor = range.commonAncestorContainer;
      if (commonAncestor && commonAncestor.innerHTML) {
        var commonAncestorHtml = commonAncestor.innerHTML;
        var seekStartText = getStartText(range);
        var seekEndText = getEndText(range);
        if (seekStartText && seekEndText) {
          var commonAncestorStartIdx = Math.max(0, commonAncestorHtml.indexOf(seekStartText));
          var commonAncestorEndIdx = commonAncestorHtml.lastIndexOf(seekEndText);
          if (commonAncestorEndIdx == -1) {
            commonAncestorEndIdx = commonAncestorHtml.length - 1;
          }
          if (commonAncestorStartIdx >= 0 && commonAncestorEndIdx >= 0) {
            html = commonAncestorHtml.substring(commonAncestorStartIdx, commonAncestorEndIdx + seekEndText.length);
          }
        }
      }
    }
  }
  return html;
}

var isTextFormattingTag = function (tagName) {
  var tagName = tagName.toLowerCase();
  var isFormatTag = tagName !== "b" &&
    tagName !== "i" &&
    tagName !== "strong" &&
    tagName !== "em" &&
    tagName !== "mark" &&
    tagName !== "small" &&
    tagName !== "del" &&
    tagName !== "ins" &&
    tagName !== "sub" &&
    tagName !== "sup";
  return !isFormatTag;
};

var getStartText = function (range) {
  var seekStartText;
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    if (range.startContainer.parentNode && range.startContainer.parentNode.tagName && range.startContainer.parentNode.tagName.toLowerCase() === "a") {
      seekStartText = range.startContainer.parentNode.outerHTML;
    } else {
      var container = range.startContainer;
      var depth = 0;
      var textOrFormattingTag;

      do {
        textOrFormattingTag = (container.tagName !== undefined && isTextFormattingTag(container.tagName) || container.nodeType === Node.TEXT_NODE);
        if (textOrFormattingTag) {
          container = container.parentNode;
          depth++;
        }
      } while (textOrFormattingTag !== false && depth <= 3);

      if (container.nodeType === Node.TEXT_NODE) {
        seekStartText = container.textContent.substring(Math.max(0, range.startOffset - 1));
      } else {
        seekStartText = container.outerHTML.substring(Math.max(0, range.startOffset - 1));
      }
    }
  } else if (range.startContainer.innerHTML) {
    seekStartText = range.startContainer.innerHTML.substring(Math.max(0, range.startOffset - 1));
  }
  return seekStartText;
};

var getEndText = function (range) {
  var seekEndText;
  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    if (range.startContainer.parentNode && range.startContainer.parentNode.tagName && range.startContainer.parentNode.tagName.toLowerCase() === "a") {
      seekEndText = range.endContainer.parentNode.outerHTML;
    } else {
      var container = range.endContainer;
      var depth = 0;
      var textOrFormattingTag;

      do {
        textOrFormattingTag = (container.tagName !== undefined && isTextFormattingTag(container.tagName) || container.nodeType === Node.TEXT_NODE);
        if (textOrFormattingTag) {
          container = container.parentNode;
          depth++;
        }
      } while (textOrFormattingTag !== false && depth <= 3);

      if (container.nodeType === Node.TEXT_NODE) {
        seekEndText = container.textContent.substring(Math.max(0, range.endOffset));
      } else {
        seekEndText = container.outerHTML.substring(Math.max(0, range.endOffset));
      }
    }
  } else if (range.endContainer.innerHTML) {
    seekEndText = range.endContainer.innerHTML.substring(Math.max(0, range.endOffset));
  }
  return seekEndText;
};

function getSelectedText() {
  return window.getSelection().toString();
}

function sendSelection(textSelection, htmlSelection) {
  if (textSelection && textSelection.length > 0 || htmlSelection && htmlSelection.length > 0) {
    chrome.runtime.sendMessage({
      name: "myjd-selection",
      action: "new-selection",
      data: { text: textSelection, html: htmlSelection }
    },
      function (response) {
        if (chrome.runtime.lastError != null) {
          console.log(chrome.runtime.lastError.message);
        }
      });
  }
}

function onCopy(e) {
  if (e.isTrusted) {
    chrome.runtime.sendMessage({ name: "myjd-toolbar", action: "new-copy-event" },
      function (response) {
        if (chrome.runtime.lastError != null) {
          console.log(chrome.runtime.lastError.message);
        }
      });
  }
}
window.myjd = window.myjd || {};
if (clipboardHistorySupported && !window.myjd.clipboardInjected) {
  window.myjd.clipboardInjected = true;
  document.addEventListener('copy', onCopy, true);

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.action && msg.action === "get-selection") {
      sendSelection(getSelectedText(), getSelectedHtmlBrutal());
    }
  }.bind(this));
}
})();
