(function() {
(function() {
if (typeof browser !== 'undefined') {
  chrome = browser;
}

if (window.hasRunRc2Contentscript) {
  return;
}
window.hasRunRc2Contentscript = true;

var _logCache = [];
var mouseMoved = Date.now();
const intermediateBody = `
<body id='myjd-intermediate-captcha' style='margin: 0; padding: 32px; width: 100%; height: 100%; background: #3c686f; color: #ffffff;'>

JDownloader Browser Solver for captchas<br /><br />There's no captcha displayed? Go back to your JDownloader and open the captcha again.
<br/><br/>
If this doesn't help please create a ticket in <a target='blank' href='https://support.jdownloader.org'>our support system</a> and don't forget to add an example link.
</body>
`;

const solverCSS = "body{padding:0;height:100%;min-width:640px}.headerPlatforms{text-align:right;margin-top:-10px;color:#eebb1b}header{width:608px;margin:25px auto 16px auto;background:#3c686f url(data:image/png;base64,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) no-repeat;height:50px}.container{max-width:730px}#contentPanel{width:640px;margin:4px auto;padding:4px 16px}.whiteBox{text-decoration:none;color:#000!important;box-shadow:0 1px 6px rgba(0,0,0,.25);border-radius:3px;background-color:#fff;padding:8px 6px 6px}iframe{border:1px solid #f90}body{background-color:#3c686f;color:#18383f;font-size:14px}a,a:visited{text-decoration:underline;color:#18383f;font-weight:700;text-align:right}h1,h2{text-transform:uppercase;font-size:46px;line-height:42px;font-weight:700;letter-spacing:2px}h1,h2,h3,h4,h5{letter-spacing:1px}h3{font-size:1.3em;font-family:Arial,Helvetica,sans-serif;text-align:start}.teaser h2{text-transform:none;font-size:2.2em;text-align:center;line-height:42px;font-weight:700;letter-spacing:normal}.gridContainer{margin:4px 6px 22px 6px;display:grid;grid-gap:10px;grid-template-columns:repeat(1,1fr)}.gridItemFullWidth{grid-column:1/2}.gridContainer>div{margin-bottom:8px}.gridItem img{-webkit-transition:all 1s ease;-moz-transition:all 1s ease;-ms-transition:all 1s ease;-o-transition:all 1s ease;transition:all 1s ease}.gridItem img:hover{-webkit-transform:scale(1.1);-moz-transform:scale(1.1);-ms-transform:scale(1.1);-o-transform:scale(1.1);transform:scale(1.1)}.needHelpInfo{padding-top:16px;padding-bottom:16px}.invisible-captcha-button{border:1px solid #FF9900;font-size:14px;font-weight:700;width:100%;text-decoration:none;background-color:#eee;padding:16px;margin-bottom:18px;box-shadow:0 3px 6px rgba(0,0,0,.12),0 3px 4px rgba(0,0,0,.24);transition:all .3s cubic-bezier(.25,.8,.25,1)}.invisible-captcha-button:hover{cursor:pointer;color:#e99c00;background-color:#e3e3e3;box-shadow:0 7px 14px rgba(0,0,0,.25),0 5px 5px rgba(0,0,0,.22)}.captchaControls{display:table;width:100%;margin-top:64px;table-layout:fixed;border-collapse:separate}.captchaControls button{display:inline-block;text-decoration:none;border-radius:3px;background-color:#eebb1b;background-image:linear-gradient(to bottom,#f3d435,#e9a201);border:1px solid #cd8000;border-top-color:#e99c00;text-shadow:0 1px 1px #c97a00;box-shadow:0 0 2px #fff inset;cursor:pointer;transition:all .1s linear;height:32px;padding-right:8px;padding-left:8px;text-align:center;line-height:29px;margin-bottom:4px}.captchaControls button:hover{border-color:#b16400;border-top-color:#e89b00;background-color:#f6c316;background-image:-webkit-gradient(linear,left top,left bottom,from(#ffdb29),to(#ecaa04));background-image:-webkit-linear-gradient(top,#ffdb29,#ecaa04);background-image:-moz-linear-gradient(top,#ffdb29,#ecaa04);background-image:-ms-linear-gradient(top,#ffdb29,#ecaa04);background-image:-o-linear-gradient(top,#ffdb29,#ecaa04);background-image:linear-gradient(to bottom,#ffdb29,#ecaa04);box-shadow:0 0 2px #fff inset,0 0 7px #b3b3b3}.captchaControls button:active{box-shadow:0 0 6px #b67f01 inset,0 0 4px #fff;border-color:#ac6100;background-color:#eebc12;background-image:-webkit-gradient(linear,left top,left bottom,from(#ecaf09),to(#efc91a));background-image:-webkit-linear-gradient(top,#ecaf09,#efc91a);background-image:-moz-linear-gradient(top,#ecaf09,#efc91a);background-image:-ms-linear-gradient(top,#ecaf09,#efc91a);background-image:-o-linear-gradient(top,#ecaf09,#efc91a);background-image:linear-gradient(to bottom,#ecaf09,#efc91a)}";
const solverTitle = "New Captcha!";
const solverDescription = "JDownloader needs your help with solving a captcha";

function clearDocument() {
  try {
    let htmls = document.getElementsByTagName("html");
    let children = htmls[0].childNodes;

    for (let i = 0; i < children.length; i++) {
      var parentElement = children[i];
      while (parentElement.childElementCount > 0) {
        parentElement.removeChild(parentElement.lastChild);
      }
    }
  } catch (error) {
    console.error(error);
  }
}


function ResultPoll(job) {
  let self = this;

  function _poll() {
    let sTokenElementId = job.challengeType === "HCaptchaChallenge" ? "h-captcha-response" : "g-recaptcha-response";
    let sTokenElement = document.getElementById(sTokenElementId);
    let fallbackElement = document.getElementById('captcha-response');
    if (sTokenElement != null && sTokenElement.value != null && sTokenElement.value.length > 0) {
      _logCache.push(Date.now() + " | result poll SUCCESSFULL, value: " + sTokenElement.value);
      self.cancel();
      CaptchaFormInjector.success(sTokenElement.value, job);
    } else if (fallbackElement != null && fallbackElement.value != null && fallbackElement.value.length > 0) {
      _logCache.push(Date.now() + " | result poll SUCCESSFULL (FALLBACK ELEMENT), value: " + fallbackElement.value);
      self.cancel();
      CaptchaFormInjector.success(fallbackElement.value, job);
    }
  }

  this.poll = function (interval) {
    _logCache.push(Date.now() + " | starting result poll");
    this.intervalHandle = setInterval(_poll, interval || 500);
  };

  this.cancel = function () {
    if (self.intervalHandle !== undefined) {
      clearInterval(self.intervalHandle);
    }
  }
}

let CaptchaFormInjector = (function () {
  let tabMode = document.location.hash.startsWith("#rc2jdt");
  let state = {
    inserted: false
  };

  function loadSolverTemplate(callback, errorCallback, templateUrl) {
    let xhr = new XMLHttpRequest();
    xhr.onload = function () {
      _logCache.push(Date.now() + " | solver template loaded");
      if (callback !== undefined && typeof callback === "function") {
        try {
          callback(this.response);
        } catch (error) {
          errorCallback(error);
        }
      }
    };
    xhr.onerror = function () {
      _logCache.push(Date.now() + " | failed to load solver template");
      if (error !== undefined && typeof error === "function") {
        errorCallback(this.response);
      }
    };
    xhr.open("GET", templateUrl === undefined ? chrome.runtime.getURL("./res/browser_solver_template.html") : templateUrl);
    xhr.responseType = "text";
    xhr.send();
  }

  let sendLoadedEvent = function (element, callbackUrl) {
    let bounds = element.getBoundingClientRect();

    let w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    let h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    /*
         * If the browser does not support screenX and screen Y, use screenLeft and
         * screenTop instead (and vice versa)
         */
    let winLeft = window.screenX ? window.screenX : window.screenLeft;
    let winTop = window.screenY ? window.screenY : window.screenTop;
    let windowWidth = window.outerWidth;
    let windowHeight = window.outerHeight;
    let ie = getInternetExplorerVersion();
    if (ie > 0) {
      if (ie >= 10) {
        // bug in ie 10 and 11
        let zoom = screen.deviceXDPI / screen.logicalXDPI;
        winLeft *= zoom;
        winTop *= zoom;
        windowWidth *= zoom;
        windowHeight *= zoom;
      }
    }
    let loadedParams = Object.create(null);
    loadedParams.x = winLeft;
    loadedParams.y = winTop;
    loadedParams.w = windowWidth;
    loadedParams.h = windowHeight;
    loadedParams.vw = w;
    loadedParams.vh = h;
    loadedParams.eleft = bounds.left;
    loadedParams.etop = bounds.top;
    loadedParams.ew = bounds.width;
    loadedParams.eh = bounds.height;
    loadedParams.dpi = window.devicePixelRatio;

    chrome.runtime.sendMessage({
      name: "myjdrc2",
      action: "loaded",
      callbackUrl: callbackUrl,
      params: loadedParams
    });
    console.warn("LOADED EVENT", loadedParams);
  };

  let sendMouseMovedEvent = function (callbackUrl, currentTime) {
    chrome.runtime.sendMessage({
      name: "myjdrc2",
      action: "mouse-move",
      callbackUrl: callbackUrl,
      timestamp: currentTime
    });
  };

  let init = function (data) {
   
    let injectionMsg = { type: "myjdrc2", name: "injected" };
    _logCache.push(Date.now() + " | posting to parent " + JSON.stringify(injectionMsg));
    window.parent.postMessage(injectionMsg, "*");
    _logCache.push(Date.now() + " | tab mode inited");
    if (typeof data.params !== 'object') {
      data.params = JSON.parse(data.params);
    }
    let params = data.params;
    let v3action = params.v3action;
    let siteKey = params.siteKey;
    let siteKeyType = params.siteKeyType;
    let hoster = params.siteDomain;
    let callbackUrl = data.callbackUrl;
    let challengeType = params.challengeType;
    let captchaId = params.captchaId || callbackUrl.match("\\?id=(.*)")[1];
    _logCache.push(Date.now() + " | [params] sitekey: " + siteKey + " callbackUrl: " + callbackUrl + " captchaId: " + captchaId + " hoster: " + hoster+ " challengeType: " + challengeType + " additional data: " + v3action);
    writeCaptchaFormFirefoxCompat({
      siteKey: siteKey,
      siteKeyType: siteKeyType,
      callbackUrl: callbackUrl,
      captchaId: captchaId,
      challengeType: challengeType,
      hoster: hoster,
      v3action: v3action
    });
    chrome.runtime.sendMessage({
      name: "myjdrc2",
      action: "tabmode-init",
      data: {
        callbackUrl: callbackUrl,
        captchaId: captchaId
      }
    });

    let searchElementTimeout = setTimeout(function () {
      let captchaContainer = document.getElementById("captchaContainer");
      if (captchaContainer != null) {
        clearInterval(searchElementTimeout);
        sendLoadedEvent(captchaContainer, callbackUrl);
      }
    }, 300);

    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg.name && msg.name === "myjdrc2") {
        if (msg.action && msg.action === "captcha-done") {
          if (msg.data && msg.data.captchaId === captchaId) {
            chrome.runtime.sendMessage({
              name: "close-me",
              data: { "tabId": "self" }
            });
          }
        }
      }
    });

    if (callbackUrl !== "MYJD") {
      // only check for auto-close conditions if captcha comes from localhost
      document.addEventListener("mousemove", function (event) {
        let currentTime = Date.now();
        if (currentTime - mouseMoved > 3 * 1000) {
          mouseMoved = currentTime;
          sendMouseMovedEvent(callbackUrl, currentTime);
        }
      });
    }
  };

  let i18n = function () {
    const keys = [
      "header_please_solve",
      "help_whats_happening_header",
      "help_whats_happening_description",
      "help_whats_happening_link",
      "help_need_help_header",
      "help_need_help_description",
      "help_need_help_link"
    ];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const element = document.getElementById(key);
      if (element != null) {
        const replace = chrome.i18n.getMessage(key);
        if (replace != null) {
          element.innerText = replace;
        }
      }
    }
  };

  let listenToParent = function () {
    let lastKnownHeight;
    let lastKnownWidth;
    setInterval(function () {
      if (document.documentElement && document.documentElement.scrollHeight && document.documentElement.scrollWidth) {
        // Firefox: document.body.scrollHeight not returning correct values if body contains position:fixed elements -> using document.documentElement
        let currentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        let currentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        if (lastKnownHeight !== (currentHeight - 32) || lastKnownWidth !== (currentWidth - 16)) {
          lastKnownHeight = currentHeight;
          lastKnownWidth = currentWidth;
          /*window.parent.postMessage({
           type: "myjdrc2",
           name: "window-dimensions-update",
           data: {height: currentHeight + 32, width: currentWidth + 16}
         }, "*"); */
        }
      }
    }, 500);
  };

  let success = function (result, job) {
    if (result && result.length > 0) {
      sendSolution(result, job);
    }
  };

  let sendSolution = function (token, job) {
    let resultMsg = {
      name: "myjdrc2",
      action: "response",
      data: {
        token: token,
        callbackUrl: job.callbackUrl,
        captchaId: job.captchaId
      }
    };
    _logCache.push(Date.now() + " | sending solution message to extension background " + JSON.stringify(resultMsg));
    chrome.runtime.sendMessage(resultMsg);

    setTimeout(function () {
      chrome.runtime.sendMessage({
        name: "close-me",
        data: { "tabId": "self" }
      });
    }, 2000);
    window.parent.postMessage({ type: "myjdrc2", name: "response", data: { token: token } }, "*");
  };

  let insertHosterName = function (body, hosterName) {
    if (hosterName != null && hosterName != "" && hosterName != "undefined") {
      _logCache.push(Date.now() + " | inserting hostername into DOM for job " + JSON.stringify(hosterName));
      let hosterNameContainer = body.getElementsByClassName("hosterName");
      for (let i = 0; i < hosterNameContainer.length; i++) {
        hosterNameContainer[i].textContent = hosterName.replace(/^(https?):\/\//, "");
      }
    } else {
      let shouldHideContainer = body.getElementsByClassName("hideIfNoHoster");
      for (let i = 0; i < shouldHideContainer.length; i++) {
        shouldHideContainer[i].style.visibility = "hidden";
      }
    }
  };

  let insertFavIcon = function (body, favicon) {
    if (favicon != null && favicon.startsWith("data:image/png;base64,")) {
      let favIconImg = body.getElementsByClassName("hideIfNoFavicon");
      for (let i = 0; i < favIconImg.length; i++) {
        favIconImg[i].src = favicon;
      }
    } else {
      let favIconImg = body.getElementsByClassName("hideIfNoFavicon");
      for (let i = 0; i < favIconImg.length; i++) {
        favIconImg[i].style.visibility = "hidden";
      }
    }
  };

  let insertRc2ScriptIntoDOM = function (body, job) {
    let nameSpace = job.enterprise === true ? "grecaptcha.enterprise" : "grecaptcha";
    _logCache.push(Date.now() + " | inserting rc2 script into DOM for job " + JSON.stringify(job));
    let captchaContainer = body.getElementsByClassName("captchaContainer")[0];
    captchaContainer.innerHTML = "<div id=\"recaptcha_container\"><form action=\"\" method=\"post\"> <div class=\"placeholder\"> <div id=\"recaptcha_widget\"> \
                <form action=\"?\" method=\"POST\"> \
                <div id=\"recaptcha-widget-placeholder\" class=\"g-recaptcha\" data-callback=\"onResponse\"></div> \
                </form></div>";
    captchaContainer.querySelector('.g-recaptcha').setAttribute("data-sitekey", job.siteKey);
    if (job.siteKeyType === "INVISIBLE") {
      captchaContainer.querySelector('.g-recaptcha').setAttribute("data-size", "invisible");
      captchaContainer.innerHTML += "<button style='border: 1px solid #FF9900' class='invisible-captcha-button' id='submit' onclick='onClickCallbackScript();'>" + chrome.i18n.getMessage("button_i_am_no_robot")
        + "</button>";
    }
    let dataCallbackScript = document.createElement('script');
    dataCallbackScript.type = 'text/javascript';
    dataCallbackScript.text = 'window.onResponse = function (response) {\n' +
      '            document.getElementById(\'captcha-response\').value = response;\n' +
      '        }';
    body.appendChild(dataCallbackScript);

    let onClickCallbackScript = document.createElement('script');
    onClickCallbackScript.type = 'text/javascript';
    if (job.v3action != null && job.v3action !== "") {
      try {
        if (typeof job.v3action === 'object') {
          job.v3action = "`" + JSON.stringify(job.v3action) + "`";
        } else if (typeof job.v3action === 'string') {
          job.v3action = "`" + job.v3action + "`";
          JSON.parse(job.v3action); // trigger fallback if not parsable
        }
      } catch (error) {
        // fallback: we can't get json out of job.v3action
        job.v3action = "`" + JSON.stringify({ action: "login" }) + "`";
      }

      let callbackScript = "window.onClickCallbackScript =   function () {\n" +
        "                " + nameSpace + ".ready(function () {\n" +
        "                    " + nameSpace + ".execute(JSON.parse(" + job.v3action + ")).then(function (token) {\n" +
        "                        var el = document.getElementById('captcha-response');\n" +
        "                        if (el == null) {" +
        "                           el = document.getElementById('g-recaptcha-response');    " +
        "                        }           " +
        "                        el.value = token;\n" +
        "                    });\n" +
        "                });\n" +
        "        };";
      onClickCallbackScript.text = callbackScript;
    } else {
      onClickCallbackScript.text = "window.onClickCallbackScript =   function () {\n" +
        "                " + nameSpace + ".execute();   \n" +
        "        };";
    }
    body.appendChild(onClickCallbackScript);

    var rc2Script = document.createElement('script');
    rc2Script.type = 'text/javascript';
    if (job.enterprise === true) {
      rc2Script.src = "https://www.google.com/recaptcha/enterprise.js?render=explicit";
    } else {
      rc2Script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    }
    rc2Script.onload = function () {
      var delayedRenderScript = document.createElement('script');
      delayedRenderScript.type = 'text/javascript';
      delayedRenderScript.innerText = `
                    var handle = setInterval(() => {
                        if (grecaptcha) {
                    `+ nameSpace + `.render(\"recaptcha-widget-placeholder\");
                    clearInterval(handle);
                        }
                    },100);
                    `;
      body.appendChild(delayedRenderScript);

      console.log(Date.now() + " | rc2script onload fired, letting window.parent know");
      window.parent.postMessage({ type: "myjdrc2", name: "content_loaded" }, "*");
    };
    body.appendChild(rc2Script);


    let resultPoll = new ResultPoll(job);
    resultPoll.poll();
  };

  let insertHcScriptIntoDOM = function (body, job) {
    let nameSpace ="hcaptcha";
      _logCache.push(Date.now() + " | inserting hc script into DOM for job " + JSON.stringify(job));
      let captchaContainer = body.getElementsByClassName("captchaContainer")[0];
      captchaContainer.innerHTML = "<div id=\"hcaptcha_container\"><form action=\"\" method=\"post\"> <div class=\"placeholder\"> <div id=\"hcaptcha_widget\"> \
                  <form action=\"?\" method=\"POST\"> \
                  <div id=\"hcaptcha-widget-placeholder\" class=\"h-recaptcha\" data-callback=\"onResponse\"></div> \
                  </form></div>";
      captchaContainer.querySelector('.h-recaptcha').setAttribute("data-sitekey", job.siteKey);
      if (job.siteKeyType === "INVISIBLE") {
        captchaContainer.querySelector('.h-recaptcha').setAttribute("data-size", "invisible");
        captchaContainer.innerHTML += "<button style='border: 1px solid #FF9900' class='invisible-captcha-button' id='submit' onclick='onClickCallbackScript();'>" + chrome.i18n.getMessage("button_i_am_no_robot")
          + "</button>";
      }
      let dataCallbackScript = document.createElement('script');
      dataCallbackScript.type = 'text/javascript';
      dataCallbackScript.text = 'window.onResponse = function (response) {\n' +
        '            document.getElementById(\'captcha-response\').value = response;\n' +
        '        }';
      body.appendChild(dataCallbackScript);

      let onClickCallbackScript = document.createElement('script');
      onClickCallbackScript.type = 'text/javascript';

      let callbackScript = " \
      window.onClickCallbackScript =   function () { \
        hcaptcha.execute(); \
        };"
      onClickCallbackScript.text = callbackScript;

      body.appendChild(onClickCallbackScript);

      var hcScript = document.createElement('script');
      hcScript.type = 'text/javascript';
      hcScript.src = "https://hcaptcha.com/1/api.js?render=explicit";
      hcScript.onload = function () {
        var delayedRenderScript = document.createElement('script');
        delayedRenderScript.type = 'text/javascript';
        delayedRenderScript.innerText = `
                      var handle = setInterval(() => {
                          if (hcaptcha) {
                      `+ nameSpace + `.render(\"hcaptcha-widget-placeholder\");
                        clearInterval(handle);
                          }
                      },100);
                      `;
        body.appendChild(delayedRenderScript);

        console.log(Date.now() + " | hcScript onload fired, letting window.parent know");
        window.parent.postMessage({ type: "myjdrc2", name: "content_loaded" }, "*");
    };
    body.appendChild(hcScript);


    let resultPoll = new ResultPoll(job);
    resultPoll.poll();
  };


  let writeCaptchaFormFirefoxCompat = function (job) {
    _logCache.push(Date.now() + " | firefox compat: tab mode");
    console.log("job", job);
    loadSolverTemplate(function (template) {


      clearDocument();

      const descriptionMetaTag = document.createElement("meta");
      descriptionMetaTag.name = "description";
      descriptionMetaTag.content = solverDescription;
      document.head.appendChild(descriptionMetaTag);
      const styleTag = document.createElement("style");
      styleTag.innerText = solverCSS;
      document.head.appendChild(styleTag);
      const titleTag = document.createElement("title");
      titleTag.innerText = solverTitle;
      document.head.appendChild(titleTag);
      const newBody = document.createElement("body");
      newBody.innerHTML = template;
      insertHosterName(newBody, job.hoster);
      insertFavIcon(newBody, job.favIcon);
      if (job.challengeType === "HCaptchaChallenge") {
        insertHcScriptIntoDOM(newBody, job);
      } else {
        insertRc2ScriptIntoDOM(newBody, job);
      }


      document.body = newBody;

      if (job.callbackUrl === "MYJD") {
        var captchaControls = document.getElementById("captchaControlsContainer");
        captchaControls.style = "display:none;";
      }

      i18n();
      insertButtonListeners(job);

    }, function (xhrError) {
      console.error(xhrError);
    });
  };

  let insertButtonListeners = function (job) {
    document.getElementById("captchaSkipHoster").addEventListener("click", function () {
      sendSkipRequest("hoster", job);
    });
    document.getElementById("captchaSkipPackage").addEventListener("click", function () {
      sendSkipRequest("package", job);
    });
    document.getElementById("captchaSkipAll").addEventListener("click", function () {
      sendSkipRequest("all", job);
    });
    document.getElementById("captchaCancel").addEventListener("click", function () {
      sendSkipRequest("single", job);
    });
  };

  function sendSkipRequest(skipType, job) {
    chrome.runtime.sendMessage({
      name: "myjdrc2",
      action: "tabmode-skip-request",
      data: {
        skipType: skipType,
        captchaId: job.captchaId,
        callbackUrl: job.callbackUrl
      }
    });
  }

  return {
    init: init,
    success: success,
    listenToParent: listenToParent,
    tabMode: tabMode
  }
})();

var alreadyInjected = false;

if (document.location.hash.startsWith("#rc2jdt")) {
  //history.pushState("", document.title, window.location.pathname + window.location.search);
  if (true) {
    try {
      // block document load
      document.open();
      document.write(intermediateBody);
      document.close();
    } catch (exception) {
      console.log(exception);
    }
  }
  if (document.head !== undefined && document.head !== null) {
    document.head.outerHTML = "";
  }
  clearDocument();

  document.body = document.createElement("body");
  document.body.outerHTML = intermediateBody;
  var doClearDocument = true;
  var contentLoaded = false;
  document.addEventListener("readystatechange", (state) => {
    try {
      if (doClearDocument) {
        clearDocument();
      }
      if (contentLoaded) {


        doClearDocument = false;
        if (alreadyInjected === false) {
          alreadyInjected = true;
          chrome.runtime.sendMessage({
            name: "myjdrc2", action: "captcha-get"
          }, (ev) => {
            console.log("captcha-get-readystatechange", ev);
          });
        }

      }
    } catch (e) {
      console.error("readystatechange", e);
    }
  });


  window.addEventListener('DOMContentLoaded', (event) => {
    console.log(event);
    const bodies = document.getElementsByTagName("body");
    for (let i = 0; i < bodies.length; i++) {
      if (bodies[i].id !== "myjd-intermediate-captcha" && bodies[i].id !== "myjd-captcha-solver") {
        bodies[i].parentElement.removeChild(bodies[i]);
      }
    }
    contentLoaded = true;

  });
}

let callbackScript = "window.onError = function(message, source, lineno, colno, error) { " +
  "console.error(\"ERROR\", error);" +
  "};";


chrome.runtime.onMessage.addListener(function (msg) {
  // listen for background messages
  if (msg.name && msg.name === "myjdrc2") {
    if (msg.action && msg.action === "captcha-available") {
      chrome.runtime.sendMessage({
        name: "myjdrc2", action: "captcha-get"
      }, (ev) => {
        console.log("captcha-get-onmessage", ev);
      });
    } else if (msg.action && msg.action === "captcha-set") {
      console.log("CAPTCHA PARAMS", msg);
      clearDocument();
      CaptchaFormInjector.init(msg.data);
    }
  }
});
CaptchaFormInjector.listenToParent();

function getInternetExplorerVersion() {
  let rv = -1;
  if (navigator.appName == 'Microsoft Internet Explorer') {
    let ua = navigator.userAgent;
    let re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
    if (re.exec(ua) != null) rv = parseFloat(RegExp.$1);
  } else if (navigator.appName == 'Netscape') {
    let ua = navigator.userAgent;
    let re = new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})");
    if (re.exec(ua) != null) rv = parseFloat(RegExp.$1);
  }
  return rv;
}

let debug = function () {
  if (_logCache !== undefined && _logCache.length > 0) {
    for (let i = 0; i < _logCache.length; i++) {
      console.log(_logCache[i]);
    }
  } else {
    console.log("no logs available");
  }
};
})();
