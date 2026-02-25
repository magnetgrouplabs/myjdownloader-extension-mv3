(function() {
(function() {
if (typeof browser !== 'undefined') {
  chrome = browser;
}

let getParamFromHtml = function(paramName) {
  return document.getElementsByName(paramName).length > 0 ? document.getElementsByName(paramName)[0].content : undefined
}

let BrowserSolverEnhancer = function () {
  let IFRAME_VISIBLE_STYLE = "display:block;border:none; width: 100%;height: 600px;";
  let IFRAME_INVISIBLE_STYLE = "display:none;border:none; width: 100%;height: 600px;";

  let Elements = Object.create(null);

  let captchaParams = {
    siteKey: getParamFromHtml("sitekey"),
    siteKeyType: getParamFromHtml("sitekeyType"),
    siteDomain: getParamFromHtml("siteDomain"),
    challengeType: getParamFromHtml("challengeType"),
    siteUrl: getParamFromHtml("siteUrl"),
    enterprise: (function () {
      var enterprise=getParamFromHtml("enterprise");
      if (enterprise !== undefined) {
        const raw = enterprise;
        return raw === "true";
      } else { return false; }
    }),
    v3action: (function () {
      var action=getParamFromHtml("v3action");     
      if (action !== undefined) {
        return decodeURIComponent(action).replace(/\\+/g, ' ');
      }
      return undefined;
    })(),
    isValid: function () {
      return this.siteKey !== undefined && this.siteKey.length > 0 && this.siteDomain !== undefined && this.siteDomain.length > 0;
    },
    getSanitizedContextUrl: function () {
      if (this.siteDomain.indexOf("http://") === -1 && this.siteDomain.indexOf("https://") === -1) {
        return "http://" + this.siteDomain;
      }
      return this.siteDomain;
    },
    getSanitizedSiteUrl: function () {
      if (this.siteUrl.indexOf("http://") === -1 && this.siteUrl.indexOf("https://") === -1) {
        return "http://" + this.siteUrl;
      }
      return this.siteUrl;
    },
    getFinalUrl: function () {
      if (this.siteUrl != null && this.siteUrl !== "") {
        return this.getSanitizedSiteUrl();
      } else {
        return this.getSanitizedContextUrl();
      }
    }
  };

  let hideExtensionInfoContainers = function () {
    let noExtensionElements = document.getElementsByClassName("no_extension");
    if (noExtensionElements.length && noExtensionElements.length !== 0) {
      for (let i = 0; i < noExtensionElements.length; i++) {
        noExtensionElements[i].setAttribute("style", "display:none");
      }
    }
  };

  let injectCaptchaIntoTab = function () {
    captchaParams.sanitizedContextUrl = captchaParams.getSanitizedContextUrl();
    captchaParams.siteUrl = captchaParams.getSanitizedSiteUrl();
    captchaParams.finalUrl = captchaParams.getFinalUrl();
    chrome.runtime.sendMessage(chrome.runtime.id, {
      name: "myjdrc2",
      action: "captcha-new",
      data: {
        params: JSON.stringify(captchaParams),
        callbackUrl: window.location.href
      }
    }, (ev) => {
      if (chrome.runtime.lastError != null) {
        console.log(chrome.runtime.lastError.message);
      }
      console.log(ev);
    });
  };

  let init = function () {
    Elements.loadingElement = document.createElement("div");
    Elements.loadingElement.setAttribute("style", "font-weight: bold; margin-top: 20px;margin-bottom: 8px;margin-left: 8px;")
    Elements.loadingElement.textContent = "Please wait...";

    if (!captchaParams.isValid()) {
      Elements.loadingElement.setAttribute("style", "color:red;font-weight: bold; margin-top: 20px;margin-bottom: 8px;margin-left: 8px;");
      Elements.loadingElement.textContent = "Can not load captcha. This is a bug, please contact us!";
    }


    injectCaptchaIntoTab();
  };


  return {
    init: init,
    hideExtensionInfoContainers: hideExtensionInfoContainers
  };
};

window.alert = function () {
};

document.body.innerHTML = "<body style='width: 100%'><div style='margin: auto; font-size: 1.5em; width: 50%; padding: 32px;text-align:center; color: #fefefe'>Loading Browser Solver</div></body>";

let enhancer = new BrowserSolverEnhancer();

enhancer.hideExtensionInfoContainers();

enhancer.init();


function sendSolution(token) {
  chrome.runtime.sendMessage(chrome.runtime.id, {
    name: "myjdrc2",
    action: "response",
    data: {
      token: token,
      callbackUrl: window.location.href
    }
  });
}
})();
