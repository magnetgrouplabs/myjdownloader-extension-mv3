'use strict';

angular.module('myjdWebextensionApp')
    .service('CnlService', [
        function () {
            var LOCALHOST_ROOT = "localhost:9666";
            var LOCALHOST_IP_ROOT = "127.0.0.1:9666";
            var JD_CHECK_NATIVE_URL = "/jdcheck.js";
            var JD_CROSS_DOMAIN_CHECK_URL = "/crossdomain.xml";
            var JD_FLASH_ADD_CRYPTED_URL = "/flash/addcrypted2";
            var JD_FLASH_ADD_URL = "/flash/add";
            var JD_CHECK_TRUE_RESPONSE_DATA_URI = "data:text/plain;charset=utf-8;base64,dmFyIGpkb3dubG9hZGVyID0gdHJ1ZTs=";
            var JD_CHECK_CROSS_DOMAIN_DATA_URI = "data:text/plain;charset=utf-8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/Pg0KPGNyb3NzLWRvbWFpbi1wb2xpY3k+DQogIDxzaXRlLWNvbnRyb2wgcGVybWl0dGVkLWNyb3NzLWRvbWFpbi1wb2xpY2llcz0ibWFzdGVyLW9ubHkiLz4NCiAgPGFsbG93LWFjY2Vzcy1mcm9tIGRvbWFpbj0iKiIvPg0KICA8YWxsb3ctaHR0cC1yZXF1ZXN0LWhlYWRlcnMtZnJvbSBkb21haW49IioiIGhlYWRlcnM9IioiLz4NCjwvY3Jvc3MtZG9tYWluLXBvbGljeT4=";

            function isRequestByExtension(url) {
                return checkIfRequestMatches(url, "?fromExtension");
            }

            function isJDCheckNativeUrl(url) {
                return checkIfRequestMatches(url, JD_CHECK_NATIVE_URL);
            }

            function isJDCheckUrl(url) {
                return isJDCheckNativeUrl(url) || url.endsWith(JD_CHECK_NATIVE_URL);
            }

            function isCrossDomainCheckUrl(url) {
                return checkIfRequestMatches(url, JD_CROSS_DOMAIN_CHECK_URL);
            }

            function isFlashAddCryptedUrl(url) {
                return checkIfRequestMatches(url, JD_FLASH_ADD_CRYPTED_URL);
            }

            function isFlashAddUrl(url) {
                return checkIfRequestMatches(url, JD_FLASH_ADD_URL);
            }

            function checkIfRequestMatches(testRequest, request) {
                return testRequest.indexOf(LOCALHOST_ROOT + request) !==-1 || testRequest.indexOf(LOCALHOST_IP_ROOT + request) !==-1;
            }

            function isCnLRelatedUrl(url) {
                return isCrossDomainCheckUrl(url) || isFlashAddCryptedUrl(url) || isFlashAddUrl(url) || isJDCheckUrl(url);
            }

            function createCnLRequestOptions(deviceId, formData, crypted, successCallback, errorCallback) {
                if (!formData) return;
                if (!deviceId) {
                    return createLocalCnLRequestOptions(formData, crypted, successCallback, errorCallback);
                } else {
                    return createRemoteCnLRequestOptions(deviceId, formData, crypted, successCallback, errorCallback);
                }
            }

            function createLocalCnLRequestOptions(formData, crypted) {
                return {
                    url: (crypted ? "http://127.0.0.1:9666/flash/addcrypted2?fromExtension" : "http://127.0.0.1:9666/flash/add?fromExtension"),
                    data: formData
                }
            }

            function createRemoteCnLRequestOptions(deviceId, formData, crypted) {
                return {
                    params: [formData.crypted, formData.jk, formData.source],
                    method: (crypted ? "/flash/addcrypted2Remote" : "/flash/add?fromExtension"),
                    deviceId: deviceId
                }
            }

            this.isJDCheckNativeUrl = isJDCheckNativeUrl;
            this.isCrossDomainCheckUrl = isCrossDomainCheckUrl;
            this.isFlashAddCryptedUrl = isFlashAddCryptedUrl;
            this.isJDCheckUrl = isJDCheckUrl;
            this.isFlashAddUrl = isFlashAddUrl;
            this.checkIfRequestMatches = checkIfRequestMatches;
            this.isCnLRelatedUrl = isCnLRelatedUrl;
            this.createCnLRequestOptions = createCnLRequestOptions;
            this.createLocalCnLRequestOptions = createLocalCnLRequestOptions;
            this.createRemoteCnLRequestOptions = createRemoteCnLRequestOptions;
            this.isRequestByExtension = isRequestByExtension;
            this.JD_CHECK_TRUE_RESPONSE_DATA_URI = JD_CHECK_TRUE_RESPONSE_DATA_URI;
            this.JD_CHECK_CROSS_DOMAIN_DATA_URI = JD_CHECK_CROSS_DOMAIN_DATA_URI;
        }]);