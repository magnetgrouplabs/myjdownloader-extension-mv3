"use strict";

angular.module('myjdWebextensionApp')
    .service('StringUtilsService', [
        function () {
            this.hashCode = function (input) {
                var hash = 0;
                if (input.length === 0) return hash;
                for (var i = 0; i < this.length; i++) {
                    var char = input.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return hash;
            };

            this.bytesToSize = function (bytes, precision) {
                var kilobyte = 1024;
                var megabyte = kilobyte * 1024;
                var gigabyte = megabyte * 1024;
                var terabyte = gigabyte * 1024;

                if ((bytes >= 0) && (bytes < kilobyte)) {
                    return bytes + ' B';

                } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
                    return (bytes / kilobyte).toFixed(precision) + ' KB';

                } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
                    return (bytes / megabyte).toFixed(precision) + ' MB';

                } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
                    return (bytes / gigabyte).toFixed(precision) + ' GB';

                } else if (bytes >= terabyte) {
                    return (bytes / terabyte).toFixed(precision) + ' TB';

                } else {
                    return bytes + ' B';
                }
            };

            this.bytesToSizeSanitized = function (bytes, precision, defaultValue) {
                var ret = defaultValue || "~";
                var sizeText = this.bytesToSize(bytes, precision);
                if (sizeText !== "0 B") {
                    return sizeText;
                }
                return ret;
            };

            this.secondsToTime = function (secs) {
                var weeks = Math.floor(secs / (60 * 60 * 24 * 7));
                secs -= weeks * (60 * 60 * 24 * 7);

                var days = Math.floor(secs / (60 * 60 * 24));
                secs -= days * (60 * 60 * 24);

                var hours = Math.floor(secs / (60 * 60)) % 24;
                secs -= hours * 3600;

                var minutes = Math.floor(secs / 60) % 60;
                secs -= minutes * 60;

                var seconds = secs % 60;

                var obj = {
                    "w": weeks,
                    "d": days,
                    "h": hours,
                    "m": minutes,
                    "s": seconds
                };
                return obj;
            };

            this.createEtaText = function (seconds) {
                var ret = "";
                var time = this.secondsToTime(seconds);
                if (time.w > 0) {
                    ret += "more than a week";
                    return ret;
                }
                if (time.d > 0) {
                    ret += time.d + "d ";
                }
                if (time.h > 0 || ret.length > 0) {
                    ret += time.h + "h ";
                }
                if (time.m > 0 || ret.length > 0) {
                    ret += time.m + "m ";
                }
                if (time.s > 0 || ret.length > 0) {
                    ret += time.s + "s";
                }
                return ret;
            }
        }]);