'use strict';

angular.module('myjdWebextensionApp')
    .service('ApiErrorService', ['ExtensionI18nService', function (ExtensionI18nService) {
        function ApiError(status, type, checkType) {
            this.status = status;
            this.type = type;
            this.checkType = checkType === undefined || true;
        }

        ApiError.prototype.equals = function (e) {
            if (!e || !e.status)
                return false;
            var sameType = this.checkType ? e.type && this.type === e.type : true;
            if (this.status === e.status && sameType) {
                return true;
            }
        };

        this.ApiError = ApiError;

        this.SERVER_ERROR = {
            MAINTENANCE: new ApiError(503, "MAINTENANCE"),
            BAD_GATEWAY: new ApiError(502, "BAD_GATEWAY"),
            OVERLOAD: new ApiError(503, "OVERLOAD"),
            TOO_MANY_REQUESTS: new ApiError(429, "TOO_MANY_REQUESTS"),
            ERROR_EMAIL_NOT_CONFIRMED: new ApiError(401, "ERROR_EMAIL_NOT_CONFIRMED"),
            OUTDATED: new ApiError(403, "OUTDATED"),
            TOKEN_INVALID: new ApiError(403, "TOKEN_INVALID"),
            OFFLINE: new ApiError(504, "OFFLINE"),
            UNKNOWN: new ApiError(-1, "UNKNOWN"),
            BAD_REQUEST: new ApiError(400, "BAD_REQUEST"),
            AUTH_FAILED: new ApiError(403, "AUTH_FAILED"),
            EMAIL_INVALID: new ApiError(500, "EMAIL_INVALID", false),
            CHALLENGE_FAILED: new ApiError(200, "CHALLENGE_FAILED", true),
            METHOD_FORBIDDEN: new ApiError(200, "METHOD_FORBIDDEN", true),
            EMAIL_FORBIDDEN: new ApiError(200, "EMAIL_FORBIDDEN", true),
            FAILED: new ApiError(200, "FAILED", false),
            BLOCKED_CLIENT: new ApiError(200, "BLOCKED_CLIENT", true),
            /* storage errors */
            STORAGE_NOT_FOUND: new ApiError(200, "STORAGE_NOT_FOUND", true),
            STORAGE_LIMIT_REACHED: new ApiError(200, "STORAGE_LIMIT_REACHED", true),
            STORAGE_ALREADY_EXISTS: new ApiError(200, "STORAGE_ALREADY_EXISTS", true),
            STORAGE_INVALID_KEY: new ApiError(200, "STORAGE_INVALID_KEY", true),
            STORAGE_KEY_NOT_FOUND: new ApiError(200, "STORAGE_KEY_NOT_FOUND", true),
            STORAGE_INVALID_STORAGEID: new ApiError(200, "STORAGE_INVALID_STORAGEID", true)
        };

        this.DEVICE_ERROR = {
            SESSION: new ApiError(403, "SESSION"),
            API_COMMAND_NOT_FOUND: new ApiError(404, "API_COMMAND_NOT_FOUND"),
            AUTH_FAILED: new ApiError(403, "AUTH_FAILED"),
            FILE_NOT_FOUND: new ApiError(404, "FILE_NOT_FOUND"),
            INTERNAL_SERVER_ERROR: new ApiError(500, "INTERNAL_SERVER_ERROR"),
            API_INTERFACE_NOT_FOUND: new ApiError(404, "API_INTERFACE_NOT_FOUND"),
            BAD_PARAMETERS: new ApiError(400, "BAD_PARAMETERS"),
            UNKNOWN: new ApiError(500, "UNKNOWN")
        };

        this.CLIENT_UNKNOWN_ERROR = new ApiError(-1, "UNKNOWN");

        this.createReadableApiError = function (e) {
            if (this.SERVER_ERROR.AUTH_FAILED.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_auth_failed"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.EMAIL_INVALID.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_email_invalid"),
                    link: "https://my.jdownloader.org/login.html?register",
                    raw: e
                };
            } else if (this.SERVER_ERROR.ERROR_EMAIL_NOT_CONFIRMED.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_email_not_confirmed"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.MAINTENANCE.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_server_maintenance"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.BAD_GATEWAY.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_bad_gateway"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.OVERLOAD.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_overload"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.TOO_MANY_REQUESTS.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_too_many_requests"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.OUTDATED.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_outdated"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.OFFLINE.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_server_offline"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.BAD_REQUEST.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_bad_request"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.BLOCKED_CLIENT.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_blocked_client"),
                    raw: e
                };
            } else if (this.SERVER_ERROR.UNKNOWN.equals(e)) {
                return {
                    message: ExtensionI18nService.getMessage("api_error_unknown"),
                    raw: e
                };
            } else if (e.status && e.status === -1 && e.type) {
                return {message: e.type, log: true, raw: e};
            } else {
                return {message: ExtensionI18nService.getMessage("api_error_generic"), log: true, raw: e};
            }
        };

        this.createApiError = function (e) {
            if (e) {
                if (e.src && e.type) {
                    // done
                    return e;
                } else if (e.responseText && e.status) {
                    try {
                        var responseJSON = JSON.parse(e.responseText);
                        if (this.SERVER_ERROR[responseJSON.type] && this.SERVER_ERROR[responseJSON.type].status === e.status) {
                            return this.SERVER_ERROR[responseJSON.type];
                        } else if (this.DEVICE_ERROR[responseJSON.type] && this.DEVICE_ERROR[responseJSON.type].status === e.status) {
                            return this.DEVICE_ERROR[responseJSON.type];
                        }
                    } catch (parseError) {
                        // TODO
                    }
                } else {
                    // no raw response text, only status code
                    if (this.SERVER_ERROR[e.status]) {
                        return this.SERVER_ERROR[e.status];
                    } else if (this.DEVICE_ERROR[e.status]) {
                        return this.DEVICE_ERROR[e.status];
                    }
                }
            }
            return this.CLIENT_UNKNOWN_ERROR;
        }
    }]);