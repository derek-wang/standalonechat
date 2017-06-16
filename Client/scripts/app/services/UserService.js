(function (angular) {
    angular.module('chatModule').factory('DealerService', ['$http', 'ApiContext', function ($http, ApiContext) {
        var getDealerList = function (groupName) {
            return $http({
                url: ApiContext + "/userGroup/users?name=" + groupName,
                method: 'GET',
                withCredentials: true
            });
        };
        var getPrivateRoomUsers = function (retailUserId) {
            return $http({
                url: ApiContext + "/user/chat/" + retailUserId + "/privateRoomUsers/",
                dataType: 'json',
                method: 'GET',
                withCredentials: true
            });
        };
        
        return {
            getDealerList: getDealerList,
            getPrivateRoomUsers: getPrivateRoomUsers
   
        };
    }]);
    angular.module('chatModule').service("Authentication", ['$http', 'ApiContext', 'UserAccountService', '$location', '$q', '$rootScope', function ($http, ApiContext, UserAccountService, $location, $q, $rootScope) {
        var X_CSRF_HEADER = "X-CSRF-HEADER";
        var X_CSRF_TOKEN_HEADER = "X-CSRF-TOKEN";
        var service;
        var csrfToken = null;
        var user = null;
        var SignInuser = null;
        var selectedDealerid = null;
        var preLoginHandlers = [];
        var preLogoutHandlers = [];
        var postLoginHandler = angular.noop;

     
      function userProfileDecorator(userProfile) {
            return userProfile
        }
      function UserProfileAcceptor(userProfile) {
            return userProfile
        }


        function reloadUserProfile(options) {
            options = options || {};
            var acceptUserProfile = function (http) {
                setAuthentication(http.data.result);

                return http.data.result
            };
            var rejectUserProfile = function (http) {
                setAuthentication(null);

                return $q.reject(http)
            };
      

            return $http({
                url: ApiContext + "/user/profile",
                dataType: 'json',
                method: 'GET',
                withCredentials: true,
                timeout: options.timeout || 5e3
            }).then(UserProfileAcceptor).then(acceptUserProfile, rejectUserProfile);
        }
        function getUserProfile() {

            var acceptUserProfile = function (http) {
                setAuthentication(http.data.result);

                return http.data.result
            };
            var rejectUserProfile = function (http) {
                setAuthentication(null);

                return $q.reject(http)
            };

            return $http({
                url: ApiContext + "/user/profile",
                dataType: 'json',
                method: 'GET',
                withCredentials: true
            }).then(UserProfileAcceptor).then(acceptUserProfile, rejectUserProfile);
        }


        function isAuthenticated() {
            return user !== null && user.authenticated
        }

        function setAuthentication(authentication) {
            user = null;
            if (angular.isObject(authentication)) {
                user = userProfileDecorator(authentication);
                user.authenticated = true
            }
           
           $rootScope.user = angular.copy(user)
            
            return user
        }
  

        function setHttpHeaderDefaults() {
           // var defaults = $http.defaults.headers.common;           
           // defaults["X-CSRF-TOKEN"] = getToken
        }

        function setTokenFromHttp(http) {
            if (!http || !http.headers) {
                csrfToken = null;
                return;
            }
            csrfToken = http.headers(X_CSRF_TOKEN_HEADER);
            setHttpHeaderDefaults();
        }

        function requestToken() {
            return $http.head(ApiContext + "/", {
                timeout: 5e3
            }).then(setTokenFromHttp, setTokenFromHttp)
        }
            
    
        function chatUserHandler(chatUserList) {
            var found = false;
            angular.forEach(chatUserList, function (chatUser) {                 
                if (chatUser.id == selectedDealerid) {
                        found = true;

                    }
            });
            if (found == false)
                {
                UserAccountService.checkAndCreateRetailChatUser(SignInuser, selectedDealerid, encodeURIComponent(window.top.location.href));
                }



            return chatUserList
        }
        function Callback() { }
         
  


        function Authenticate(userinfo, id) {
            if (!angular.isObject(userinfo)) {
                throw "InvalidToken: Supplied authentication token is invalid because it is not an object"
            }
      
            SignInuser = userinfo;
            selectedDealerid = id;         
            var token = JSON.stringify({
                "username": userinfo.email,
                "password": ">%48!C5dpd/gh6;u",
                "rememberMe": true,
                "cf_area": "CHAT"
            });
            function authenticate() {
                function successfulLogin() {
                    return $q.when(postLoginHandler(token)).then(getUserProfile);
                }
                function rejectWithHttpData(http) {
                    return $q.reject(http.data)
                }

                return $http({
                    url: ApiContext + '/json_security_check?remember-me=true',
                    method: 'POST',
                    data: token,
                    withCredentials: true
                }).catch(function (error) {
          
                    }).then(successfulLogin, rejectWithHttpData);
            }
            var handlers = _.map(preLoginHandlers, function (handler) {
                return $q.when(handler())
            });
            return $q.all(handlers).then(authenticate);
        }

        function resetUserProfile() {
           setAuthentication(null);
            preLogoutHandlers = [];
            $rootScope.ShowNotificationBar = false;
        }
   
        function getSelectedDealerId() {
            return selectedDealerid;
        }
        function getUser() {
            return angular.copy(user)
        }

        function getToken() {
            return csrfToken;
        }

        function getHeaders() {
            var headers = {};
            headers[X_CSRF_HEADER] = X_CSRF_TOKEN_HEADER;
            headers["X-CSRF-TOKEN"] = getToken();
            return headers;
        }

        function clearToken() {
            csrfToken = null;
        }


        function logout() {
            _.each(preLogoutHandlers, function (handler) {
                handler()
            });
            $http({
                url: ApiContext + '/logout',
                method: 'GET',
               withCredentials: true
            }).then(resetUserProfile, resetUserProfile);
            

        }

        function registerPreLoginHandler(handler) {
            if (!handler || !angular.isFunction(handler)) {
                throw "Supplied login handler is not a function"
            }
            preLoginHandlers.push(handler)
        }

        function setPostLoginHandler(handler) {
            if (!handler || !angular.isFunction(handler)) {
                throw "Supplied post login handler is not a function"
            }
            postLoginHandler = handler
        }

        function registerPreLogoutHandler(handler) {
            if (!handler || !angular.isFunction(handler)) {
                throw "Supplied logout handler is not a function"
            }
            preLogoutHandlers.push(handler);
        }

        service = {
            isAuthenticated: isAuthenticated,
            reloadUserProfile: reloadUserProfile,
            setTokenFromHttp: setTokenFromHttp,
            requestToken: requestToken,
            getToken: getToken,
            getHeaders: getHeaders,
            clearToken: clearToken,
            Authenticate: Authenticate,
            getUser: getUser,
            getUserProfile: getUserProfile,
            registerPreLoginHandler: registerPreLoginHandler,
            registerPreLogoutHandler: registerPreLogoutHandler,
            logout: logout,
            getSelectedDealerId: getSelectedDealerId
        };
        return service;
    }]);
    angular.module('chatModule').config(["$httpProvider",function ($httpProvider) {
        var securityInterceptor = [
            "$location", "$window", "$q",
            function ($location, $window, $q) {
                function getRejectionObjectFromResponse(response) {
                    var rejection = {
                        $statusCode: response.status,
                        $statusText: response.statusText,
                        reason: ""
                    };
                    if (angular.isObject(response.data)) {
                        rejection = angular.extend(rejection, response.data)
                    }
                    return rejection
                }
                return {
                    response: function (response) {
                        return response
                    },
                    responseError: function (response) {
                        var rejection = getRejectionObjectFromResponse(response);
                        var responseData = response.data;
                        switch (response.status) {
                            case 401:
                                if (angular.isDefined(rejection.authenticated) && !rejection.authenticated) {
                                    rejection.reason = responseData.reason
                                } else {
                                    rejection.reason = "AUTHORIZATION_REQUIRED"
                                }
                                break;
                            case 403:
                                rejection.reason = "ACCESS_DENIED";
                                break;
                            case 419:
                                rejection.reason = "AUTHENTICATION_REQUIRED";
                                break;
                            case 502:
                                rejection.reason = "GATEWAY_ERROR";
                                break;
                            case 0:
                                rejection.reason = "TIMEOUT";
                                break
                        }
                        response.data = rejection;
                        return $q.reject(response)
                    }
                }
            }
        ];
        $httpProvider.interceptors.push(securityInterceptor)
    }]);
    angular.module('chatModule').service("UserAccountService", ["$http", "$q", "$log", "RequestContext", "ApiContext", function ($http, $q, $log, RequestContext, ApiContext) {
        function formatErrorsIntoErrorObject(errors) {
            var formattedErrors = {};
            if (angular.isObject(errors.data) && angular.isArray(errors.data.errors)) {
                _.each(errors.data.errors, function (error) {
                    formattedErrors[error.field] = {
                        message: error.reason,
                        type: error.errorType
                    }
                });
                $log.error("Formatted response: " + angular.toJson(formattedErrors))
            } else {
                formattedErrors = errors
            }
            return $q.reject(formattedErrors)
        }
        function unwrapResponse(response) {
            return response && response.data ? response.data.result : response
        }

        function getUserProfileDecorator(userProfile) {
            var unknownProfileAvatar = RequestContext + "img/unknown-user-profile.png";
            if (angular.isDefined(userProfile)) {
                userProfile.$avatar = userProfile.avatar ? ApiContext + "/files/user/avatar/" + userProfile.id + "/" + userProfile.avatar : unknownProfileAvatar
            }
            return userProfile
        }

        function fetchParticipantsCountForRoom(roomId) {

            return $http({
                url: ApiContext + "/room/" + roomId + "/participants/status",
                method: 'GET',
                withCredentials: true
            }).then(unwrapResponse, formatErrorsIntoErrorObject);
        }

        function fetchPrivateRoomUserProfilesByChatUserId(userId) {
            return $http({
                url: ApiContext + "/user/chat/" + userId + "/retailRoomUsers/",
                dataType: 'json',
                method: 'GET',
                withCredentials: true
            }).then(unwrapResponse, formatErrorsIntoErrorObject)
        }

        function typePrivateMessage(room) {
            return $http({
                url: ApiContext + "/user/chat/typing/" + room.id,
                dataType: 'json',
                method: 'GET',
                withCredentials: true
            }).then(unwrapResponse);
        }

        function finishTypePrivateMessage(room) {
            return $http({
                url: ApiContext + "/user/chat/finish/typing/" + room.id,
                dataType: 'json',
                method: 'GET',
                withCredentials: true
            }).then(unwrapResponse);
        }

        function checkAndCreateRetailChatUser(userInfo, id, sourceUrl) {
            return $http({
                url: ApiContext + "/user/chat/retail/" + id + "?source=" + sourceUrl,
                dataType: 'json',
                method: 'POST',
                data: JSON.stringify({
                    "firstName": userInfo.firstName,
                    "lastName": userInfo.lastName,
                    "username": userInfo.email
                }),
                withCredentials: true
            }).then(unwrapResponse);
        }

        function retailLogoutWithSettings(retailUserId, roomId, emailChatHistory, emailOfflineMessages, callbackRequest, phoneNumber) {
            return $http({
                url: ApiContext + "/user/chat/retail/logout/" + retailUserId + "/" + roomId + "?emailChatHistory=" + emailChatHistory + "&emailOfflineMessages=" + emailOfflineMessages + "&callbackRequest=" + callbackRequest + "&phoneNumber=" + phoneNumber,
                method: 'GET',
                withCredentials: true
            }).then(unwrapResponse);
        }

        function resetPrivateConversation(id) {
            return $http({
                url: ApiContext + "/room/private/" + id,
                method: 'POST',
                withCredentials: true
            }).then(unwrapResponse);
        }
        return {
            fetchParticipantsCountForRoom: fetchParticipantsCountForRoom,
            fetchPrivateRoomUserProfilesByChatUserId: fetchPrivateRoomUserProfilesByChatUserId,
            getUserProfileDecorator: getUserProfileDecorator,
            resetPrivateConversation: resetPrivateConversation,
            typePrivateMessage: typePrivateMessage,
            finishTypePrivateMessage: finishTypePrivateMessage,
            checkAndCreateRetailChatUser: checkAndCreateRetailChatUser,
            retailLogoutWithSettings: retailLogoutWithSettings,
        }
    }])
})(angular);