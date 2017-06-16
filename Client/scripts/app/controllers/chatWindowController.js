
    angular.module('chatModule').controller('chatWindowController', ["AppUrl", "ApiContext", '$document', '$scope', '$http', 'DealerService', 'Authentication', '$window', '$rootScope', '$filter', '$uibModal', 'UiChannel', 'ngToast', 'UserAccountService', 'moment', 'RoomEventService', 'ChatSessionService', 'cookiesHandlerService', 'ModelDialogService', function (AppUrl, ApiContext,$document, $scope, $http, DealerService, Authentication, $window, $rootScope, $filter, $uibModal, UiChannel, ngToast, UserAccountService, moment, RoomEventService, ChatSessionService, cookiesHandlerService, ModelDialogService) {
        $rootScope.ShowNotificationBar = false;
        $rootScope.Dealers = [];
        $rootScope.SelectedDealer = null;
        $rootScope.loading = false;

        Authentication.requestToken().then(requestToken_ResponceHandler);
        $rootScope.user = {
            firstName: '',
            lastName: '',
            email: ''
        };
        $scope.$on('ShowDialog', function () {
            $rootScope.ShowNotificationBar = false;
            OpenMessageWindow();
        });
        var chatinfo = cookiesHandlerService.getCookieData();
        if (chatinfo != undefined) {
            var Data = JSON.parse(chatinfo);
            if (Data.user != null) {
                $rootScope.loading = true;
                $rootScope.user.firstName = Data.user.firstName;
                $rootScope.user.lastName = Data.user.firstName;
                $rootScope.user.email = Data.user.username;
                Authentication.Authenticate($rootScope.user, 0).then(function (result) {
                    if (result != null) {
                        ChatSessionService.Connect().then(function () {


                            var chatinfo = cookiesHandlerService.getCookieData();
                            if (chatinfo != undefined) {
                                chatinfo = JSON.parse(chatinfo);
                                if (chatinfo.currentstate == "open") {
                                    ModelDialogService.ChatWindow();
                                } else {
                                    $rootScope.ShowNotificationBar = true;
                                    $rootScope.loading = false;
                                }
                            } else {
                                ModelDialogService.ChatWindow();
                            }
                        });
                    }
                });
            }
        }
        var handlerRegistrations = [UiChannel.subscribe(UiChannel.events.NEW_ROOM_MESSAGE, newMessageHandler)];
        $rootScope.NotificationCount = 0;

        function newMessageHandler(event) {
            $scope.$apply(function () {
                var ActiveChatSession = ChatSessionService.getChatSessionData();
                var room = ActiveChatSession.getPrivateRooms();
                $rootScope.NotificationCount = room.$unread.normal + room.$unread.notification;
  
                if (event.message != undefined && event.message.$room != undefined && event.message.$room.roomType == "PRIVATE") {
                    if (!event.message.$own && room.currentstate == 'minimize') {
                        ngToast.create({
                            className: '',
                            dismissOnClick: true,
                            timeout: 4000,
                            content: '<span><img src="' + event.message.$from.avatar + '"> </span><span>' + event.message.message + '</span>'
                        });
                    }
                }
            })
        }
        var element = document.getElementsByName("ChatterFox");
        if (element.length > 0) {

            $rootScope.groupName = element[0].getAttribute("Data-GroupName");

        } 

        // Show and hide side bar on double click
        $scope.SideBar = function () {
            if ($scope.ShowSideBar)
                $scope.ShowSideBar = false;
            else
                $scope.ShowSideBar = true;
        };
        $scope.signedInDialog = function (ev) {
            if (!Authentication.isAuthenticated()) {
                ModelDialogService.SignIn();
            } else
            {             
                ModelDialogService.ChatWindow();
                
            }
        };

        function OpenMessageWindow() {
   
            ModelDialogService.ChatWindow();
        }
        /**
         * @param {responce} handler reponce function
         * @returns void
         */
        function requestToken_ResponceHandler(responce) {
            DealerService.getDealerList($rootScope.groupName).then(function(result) {
                if (result.status == 200 && result.data != null) {
                    var responce = result.data.result;
                    if (responce != null && responce.length > 0) {
                      responce = responce.sort(function (a, b) {
                           var nameA = a.firstName.toUpperCase(); 
                           var nameB = b.firstName.toUpperCase(); 
                            if (nameA < nameB) {
                                return -1;
                            }
                            if (nameA > nameB) {
                                return 1;
                            }            
                            return 0;
                        });


                        for (var i = 0; i < responce.length; i++) {
                            $scope.Dealers.push(new Dealer(responce[i].id, responce[i].username, responce[i].firstName, responce[i].lastName, responce[i].online, responce[i].available, 0, responce[i].userAvatar));
                        }
                    }
                }
            });
        }

      

       
        var User = function (firstname, lastname, email, Remember) {
            this.firstname = firstname;
            this.lastname = lastname;
            this.email = email;
            this.Remember = Remember;
        };
        var Dealer = function (id, username, firstName, lastName, online, available, roomid, avatar) {
            this.id = id;
            this.roomid = roomid;
            this.username = username;
            this.firstName = firstName;
            this.lastName = lastName;
            this.online = online;
            this.available = available;
            this.unreadMessageCount = 0;
            this.avatar = avatar ? ApiContext+"/files/user/avatar/" + id + "/" + avatar : AppUrl+"/images/unknown-user-avatar.png";
        };
     
    }]);
