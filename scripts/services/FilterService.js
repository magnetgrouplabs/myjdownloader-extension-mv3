'use strict';

angular.module('myjdWebextensionApp')
    .service('FilterService', ['ExtensionI18nService',
        function (ExtensionI18nService) {
            var customFilterSets = []; // TODO:
            var service = this;

            this.ExtensionGroupTags = {
                AUDIO: "AUDIO",
                VIDEO: "VIDEO",
                ARCHIVE: "ARCHIVE",
                IMAGE: "IMAGE",
                DOCUMENT: "DOCUMENT",
                OTHER: "OTHER"
            };

            var ExtensionFilterSet = function (title, active, tag) {
                this.tag = tag || service.ExtensionGroupTags.OTHER;
                this.title = title;
                this.active = active || true;
                this.extensions = [];
                this.rules = [];
                var isDirty = false;
                var self = this;

                this.addExtension = function (extension, allowDuplicate) {
                    if (allowDuplicate === true) {
                        self.extensions.push(extension);
                        return true;
                    }

                    var dupe = self.extensions.some(function (ex) {
                        if (extension == ex) return true;
                    });

                    if (!dupe) {
                        self.extensions.push(extension);
                        isDirty = true;
                    }
                    return dupe;
                };

                this.addExtensions = function (extensions, allowDuplicate) {
                    var added = false;
                    extensions.map(function (ext) {
                        var innerAdd = self.addExtension(ext, allowDuplicate);
                        if (added === false && innerAdd === true) added = true;
                    });
                    return added;
                };

                this.getRules = function () {
                    if (isDirty) self.compileRules();
                    return self.rules;
                };

                this.compileRules = function () {
                    var extensions = self.extensions.join("|");
                    self.rules = [new RegExp(".*\\.(?:" + extensions + ")(\\?.*|#.*)?$", "i")];
                    isDirty = false;
                };
            };

            const ArchiveFilterSet = new ExtensionFilterSet(ExtensionI18nService.getMessage("filterset_title_images"), true, this.ExtensionGroupTags.ARCHIVE);
            ArchiveFilterSet.addExtensions(["REV", "RAR", "ZIP", "7ZIP", "r\\d{1,4}", "\\d{1,4}", "z\\d{1,4}", "(ace|c\\d{2,4})", "TAR", "GZ", "AR", "BZ2", "ARJ", "CPIO", "7Z", "S7Z", "DMG", "SFX", "XZ", "TGZ", "LZH", "LHA"]);

            const ImageFilterSet = new ExtensionFilterSet(ExtensionI18nService.getMessage("filterset_title_images"), true, this.ExtensionGroupTags.IMAGE);
            ImageFilterSet.addExtensions(["JPG", "JPEG", "GIF", "EPS", "PNG", "BMP", "TIF", "TIFF", "RAW", "SVG", "ICO", "WEBP"]);

            const AudioFilterSet = new ExtensionFilterSet(ExtensionI18nService.getMessage("filterset_title_audio"), true, this.ExtensionGroupTags.AUDIO);
            AudioFilterSet.addExtensions(["MP3", "WMA", "AAC", "WAV", "FLAC", "MID", "MOD", "OGG", "S3M", "4MP", "AA", "AIF", "AIFF", "AU", "M3U", "M4a", "M4b", "M4P", "MKA", "MP1", "MP2", "MPA", "OMG", "OMF", "SND"]);

            const VideoFilterSet = new ExtensionFilterSet(ExtensionI18nService.getMessage("filterset_title_video"), true, this.ExtensionGroupTags.VIDEO);
            VideoFilterSet.addExtensions(["3GP", "ASF", "AVI", "DIVX", "XVID", "FLV", "MP4", "H264", "H265", "M4U", "M4V", "MOV", "MKV", "MPEG", "MPEG4", "MPG", "OGM", "OGV", "VOB", "WMV", "GP3", "WEBM"]);

            const DocumentFilterSet = new ExtensionFilterSet(ExtensionI18nService.getMessage("filterset_title_documents"), true, this.ExtensionGroupTags.DOCUMENT);
            DocumentFilterSet.addExtensions(["txt", "html?", "php", "jsp", "java", "js", "doc(x|m)?", "dot(x|m)?", "epub", "readme", "xml", "csv", "rtf", "pdf", "nfo", "srt", "usf"]);

            this.getFilters = function () {
                var filters = [ArchiveFilterSet, ImageFilterSet, AudioFilterSet, VideoFilterSet, DocumentFilterSet];
                customFilterSets.map(function (filter) {
                    filters.push(filter);
                });
                return filters;
            };

            this.getMatchingFilters = function (link) {
                return this.getFilters().filter(function (filter) {
                    if (filter.getRules().some(function (rule) {
                            // reset global regex
                            rule.lastIndex = 0;
                            if (rule.test(link)) return true;
                        })) {
                        return filter;
                    }
                });
            }
        }]);