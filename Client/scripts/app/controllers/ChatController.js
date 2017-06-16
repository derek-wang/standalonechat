
    angular.module('chatModule').controller('ChatController', ['AppUrl', 'ApiContext', '$scope', '$rootScope', '$uibModalInstance', '$window', '$timeout', 'ChatSessionService', 'UserAccountService', 'SystemNotificationService', 'cookiesHandlerService', 'ModelDialogService', 'Authentication', 'UiChannel', function (AppUrl, ApiContext, $scope, $rootScope, $uibModalInstance, $window, $timeout, ChatSessionService, UserAccountService, SystemNotificationService, cookiesHandlerService, ModelDialogService, Authentication, UiChannel) {
        $scope.AppUrl = AppUrl;
        $scope.ApiContext = ApiContext;
        

    $scope.MenuSideBar = false;
    $scope.ShowSlideMenu = function () {
        var myEl = angular.element(document.querySelector('#chatModule .nav-tabs'));
        myEl.addClass('SlideLeft');
        $scope.MenuSideBar = true;
    };
    $scope.HideSlideMenu = function () {
        var myEl = angular.element(document.querySelector('#chatModule .nav-tabs'));
        myEl.removeClass('SlideLeft');
        $scope.MenuSideBar = false;
    };
    $scope.Activetab = 0;
    var ActiveChatSession = ChatSessionService.getChatSessionData();
         ActiveChatSession.setModelWindowStateOpen();
    $scope.setCurrentRoom = function (room) {  
        $scope.HideSlideMenu();
        ActiveChatSession.setCurrentRoom(room);
        $rootScope.NotificationCount = ActiveChatSession.getPrivateRooms().$unread.normal + ActiveChatSession.getPrivateRooms().$unread.notification;
    }


  
    $scope.user = ActiveChatSession.getUser();
    $scope.privateRooms = ActiveChatSession.getPrivateRooms();
    $scope.publicRooms = ActiveChatSession.getPublicRooms();
    $scope.currentRoom = ActiveChatSession.getCurrentRoomView();

    if ($scope.currentRoom.id > 0) {

        $timeout(function () {

            var roomList = $scope.currentRoom.roomType == "PUBLIC" ? $scope.publicRooms : $scope.privateRooms;
            var room = roomList.list[$scope.currentRoom.id];
            if (room != undefined) {

                roomList.$unread.notification -= room.unread.notification;
                roomList.$unread.normal -= room.unread.normal;
                UiChannel.dispatch({
                    type: UiChannel.events.NW_BADGE_DECREMENT,
                    count: room.unread.notification
                });
                room.unread.notification = 0;
                room.unread.normal = 0;
                UiChannel.dispatch({
                    type: UiChannel.events.ROOM_CHANGED,
                    roomView: room
                });
                $rootScope.NotificationCount = ActiveChatSession.getPrivateRooms().$unread.normal + ActiveChatSession.getPrivateRooms().$unread.notification;

            }
        }, 1500);

       // ActiveChatSession.setCurrentRoom(ActiveChatSession.getPrivateRooms().list[$scope.currentRoom.id]);
       
    }
   
  
   
    $scope.activecurrenttab = function () {
        angular.forEach($scope.privateRooms.users, function (user, index) {
            if ($scope.currentRoom.id == user.roomId) {

                $scope.Activetab = index;
            }
         
        });
    }
    $scope.typingRoomId = $scope.currentRoom.id;
    $scope.privateChatLimit = 30;
    $scope.sortPrivateRooms = "lastActive";
    $scope.reverseSort = true;
    $scope.$watchCollection("privateRooms.list", function () {
        separateRetailAndDealerUserSection()
    });
    $scope.countPrivateOnline = function (deleted) {
        var count = angular.extend({
            online: 0,
            offline: 0
        }, _.countBy(_.values($scope.dealerUserPrivateRooms.list), function (room) {
            if (deleted) {
                return room.otherOnline || room.otherAvailable ? "online" : "offline"
            } else {
                if ($scope.user.id == room.initiator.id && !room.initiatorDeleted) {
                    return room.otherOnline || room.otherAvailable ? "online" : "offline"
                } else if ($scope.user.id == room.participant.id && !room.participantDeleted) {
                    return room.otherOnline || room.otherAvailable ? "online" : "offline"
                }
            }
        }));
        return count.online + " / " + (count.online + count.offline)
    };
    $scope.countRetailOnline = function (deleted) {
        var count = angular.extend({
            online: 0,
            offline: 0
        }, _.countBy(_.values($scope.retailRooms.list), function (room) {
            if (deleted) {
                return room.otherOnline || room.otherAvailable ? "online" : "offline"
            } else {
                if ($scope.user.id == room.initiator.id && !room.initiatorDeleted) {
                    return room.otherOnline || room.otherAvailable ? "online" : "offline"
                } else if ($scope.user.id == room.participant.id && !room.participantDeleted) {
                    return room.otherOnline || room.otherAvailable ? "online" : "offline"
                }
            }
        }));
        return count.online + " / " + (count.online + count.offline)
    };

    function roomChangedHandler(roomChangedEvent) {
      

        $scope.currentRoom = roomChangedEvent.roomView;
        $scope.contacts = _.uniq(roomChangedEvent.roomView.participants, function (participant) {
            return participant.id
        });
        var countRoomOnline = function (data) {
            $scope.onlineCount = data.online - 1 > 0 ? data.online - 1 : 0;
      
        };
        var errorCountRoomOnline = function () {
            $scope.onlineCount = ""
        };

        if ($scope.currentRoom.id > 0) {
            UserAccountService.fetchParticipantsCountForRoom($scope.currentRoom.id).then(countRoomOnline, errorCountRoomOnline);
        }

     

       
    }

    function roomUpdatedHandler(roomUpdatedEvent) {
        $scope.$apply(function () {
            if (roomUpdatedEvent.room.id == $scope.currentRoom.id) {
                $scope.currentRoom = ActiveChatSession.getCurrentRoomView()
            }
        })
    }

    function applyHandler() {
        $scope.$apply()
    }

    function newMessageHandler(event) {
        $scope.$apply(function () {
            if (event.message != undefined && event.message.$room != undefined && event.message.$room.roomType == "PRIVATE") {
                var success = function (result) {
                    $scope.error = null;
                    $scope.resetSuccessfully = true;
                    $scope.privateRooms.list[event.message.$room.id].initiatorDeleted = result.initiatorDeleted;
                    $scope.privateRooms.list[event.message.$room.id].participantDeleted = result.participantDeleted
                };
                var error = function (error) {
                    $scope.error = error;
                };
                UserAccountService.resetPrivateConversation(event.message.$room.id).then(success, error)
            }
        })
    }

    function roomUsersChangedHandler(roomUsersChangedEvent) {
        $scope.$apply(function () {
            var eventIsValidForRoom = $scope.currentRoom.id == roomUsersChangedEvent.roomId && angular.isDefined(roomUsersChangedEvent.usersRemoved);
            if (eventIsValidForRoom) {
                if (roomUsersChangedEvent.online) {
                    $scope.onlineCount.online = roomUsersChangedEvent.usersRemoved ? $scope.onlineCount.online-- : $scope.onlineCount.online++
                } else {
                    $scope.onlineCount.offline = roomUsersChangedEvent.usersRemoved ? $scope.onlineCount.offline-- : $scope.onlineCount.offline++
                }
            }
        })
    }

    function chatUserUpdatedHandler(chatUserUpdatedEvent) {
        $scope.$apply(function () {
            $scope.currentRoom = ActiveChatSession.getCurrentRoom();
            if (angular.isDefined(chatUserUpdatedEvent.loggedIn) && angular.isDefined($scope.currentRoom.$users) && $scope.currentRoom.$users.includes(chatUserUpdatedEvent.user.id)) {
                if (chatUserUpdatedEvent.loggedIn) {
                    if (angular.isDefined($scope.onlineCount)) {
                        $scope.onlineCount.online++;
                        $scope.onlineCount.offline--
                    }
                } else {
                    if (angular.isDefined($scope.onlineCount)) {
                        $scope.onlineCount.online--;
                        $scope.onlineCount.offline++
                    }
                }
            }
        })
    }

    function privateConversationDeletedHandler(result) {
        $scope.$apply(function () {
            $scope.privateRooms.list[result.event.roomId].initiatorDeleted = result.event.initiatorDeleted;
            $scope.privateRooms.list[result.event.roomId].participantDeleted = result.event.participantDeleted
        })
    }
    var handlerRegistrations = [UiChannel.subscribe(UiChannel.events.SESSION_USER_UPDATED, sessionUserUpdatedHandler), UiChannel.subscribe(UiChannel.events.SESSION_USER_UPDATED, sessionUserUpdatedHandler), UiChannel.subscribe(UiChannel.events.ROOM_USERS_CHANGED, roomUsersChangedHandler), UiChannel.subscribe(UiChannel.events.ROOM_UNREAD, roomUnreadHandler), UiChannel.subscribe(UiChannel.events.USER_TYPING, userTypingHandler), UiChannel.subscribe(UiChannel.events.USER_FINISH_TYPING, userFinishTypingHandler), UiChannel.subscribe(UiChannel.events.UNREAD_NOTIFICATIONS, unreadNotificationsHandler), UiChannel.subscribe(UiChannel.events.NEW_NOTIFICATION, newNotificationHandler), UiChannel.subscribe(UiChannel.events.CHAT_USER_UPDATED, chatUserUpdatedHandler), UiChannel.subscribe(UiChannel.events.NEW_ROOM_MESSAGE, newMessageHandler), UiChannel.subscribe(UiChannel.events.ROOM_CHANGED, roomChangedHandler), UiChannel.subscribe(UiChannel.events.ROOM_UPDATED, roomUpdatedHandler), UiChannel.subscribe(UiChannel.events.CHAT_USER_ROOMS_CHANGED, applyHandler)];

    function unreadNotificationsHandler(unreadNotificationsEvent) {
        _.each(unreadNotificationsEvent.notifications, function (notification) {
            notification.viewed = false
        });
        $scope.user.$unreadNotifications = unreadNotificationsEvent.notifications;
        $scope.user.$newNotificationsCounter = unreadNotificationsEvent.notifications.length;
    }

    function newNotificationHandler(newNotificationEvent) {
        newNotificationEvent.notification.viewed = false;
        $scope.user.$unreadNotifications.push(newNotificationEvent.notification);
        $scope.$apply()
    }
    $window.onfocus = function () {
       
        $timeout(function () {

            var roomList = $scope.currentRoom.roomType == "PUBLIC" ? $scope.publicRooms : $scope.privateRooms;
            var room = roomList.list[$scope.currentRoom.id];
            if (room != undefined) {

                roomList.$unread.notification -= room.unread.notification;
                roomList.$unread.normal -= room.unread.normal;
                UiChannel.dispatch({
                    type: UiChannel.events.NW_BADGE_DECREMENT,
                    count: room.unread.notification
                });
                room.unread.notification = 0;
                room.unread.normal = 0;
                UiChannel.dispatch({
                    type: UiChannel.events.ROOM_CHANGED,
                    roomView: room
                });
               
            }
        }, 500);
    };

    
    $scope.$on("$destroy", function () {
        _.each(handlerRegistrations, function (registration) {
            registration.unsubscribe()
        });
        $window.onfocus = null
    });
    $scope.$watch("privateRooms.$unread.notification + publicRooms.$unread.notification", function () {
        UiChannel.dispatch({
            type: UiChannel.events.ROOM_UNREAD,
            unread: $scope.privateRooms.$unread.notification + $scope.publicRooms.$unread.notification
        });
        separateRetailAndDealerUserSection()
    });
    $scope.$watchCollection("publicRooms.list", function () {
        var parentRoom = [];
        var childRooms = [];
        var chatUserCreatedRooms = [];
        var otherRooms = [];
        _.each($scope.publicRooms.list, function (publicRoom) {
            if (publicRoom.parentRoom) {
                parentRoom.push(publicRoom)
            } else if (publicRoom.childRoom) {
                childRooms.push(publicRoom)
            } else if (publicRoom.creatorUserRole == "CHAT_USER") {
                chatUserCreatedRooms.push(publicRoom)
            } else {
                otherRooms.push(publicRoom)
            }
        });
        $scope.sortedPublicRooms = parentRoom.concat(_.sortBy(childRooms, "createDate").reverse()).concat(_.sortBy(otherRooms, "name")).concat(_.sortBy(chatUserCreatedRooms, "name"))
    });
    UiChannel.dispatch({
        type: UiChannel.events.ROOM_CHANGED,
        roomView: $scope.currentRoom
    });
    $scope.checkEditButtonDisplay = function (room) {
        var roomIsSelected = $scope.currentRoom.id == room.id;
        var roomCreatedByChatUser = room.creatorUserRole == "CHAT_USER";
        return roomIsSelected && roomCreatedByChatUser
    };
    $scope.resetNewNotificationsCounter = function () {
        ActiveChatSession.resetNewNotificationsCounter();
        UiChannel.dispatch({
            type: UiChannel.events.NW_BADGE_DECREMENT,
            count: $scope.user.$unreadNotifications.length
        })
    };
   

    $scope.showTrashBin = function (privateConversation) {
        if (privateConversation.initiator.id == $scope.user.id) {
            return !privateConversation.initiatorDeleted
        } else {
            return !privateConversation.participantDeleted
        }
    };

    function separateRetailAndDealerUserSection() {
        var retailRooms = [];
        var dealerUserPrivateRooms = [];
        var retailUnreadNotification = 0;
        var retailUnreadNormal = 0;
        var dealerUserUnreadNotification = 0;
        var dealerUserUnreadNormal = 0;
        _.each($scope.privateRooms.list, function (room) {
            if ($scope.user.id == room.initiator.id) {
                if ($scope.user.retail || room.participant.retail) {
                    retailRooms.push(room);
                    retailUnreadNotification += room.unread.notification;
                    retailUnreadNormal += room.unread.normal
                } else {
                    dealerUserPrivateRooms.push(room);
                    dealerUserUnreadNotification += room.unread.notification;
                    dealerUserUnreadNormal += room.unread.normal
                }
            } else {
                if (room.initiator.retail || room.participant.retail) {
                    retailRooms.push(room);
                    retailUnreadNotification += room.unread.notification;
                    retailUnreadNormal += room.unread.normal
                } else {
                    dealerUserPrivateRooms.push(room);
                    dealerUserUnreadNotification += room.unread.notification;
                    dealerUserUnreadNormal += room.unread.normal
                }
            }
        });
        $scope.retailRooms = {
            size: retailRooms.length,
            $unread: {
                notification: retailUnreadNotification,
                normal: retailUnreadNormal
            },
            list: retailRooms
        };
        $scope.dealerUserPrivateRooms = {
            size: dealerUserPrivateRooms.length,
            $unread: {
                notification: dealerUserUnreadNotification,
                normal: dealerUserUnreadNormal
            },
            list: dealerUserPrivateRooms
        }
    }

    function OnCloseChat() {

        $scope.emailChatHistory = false;
        $scope.emailOfflineMessages = false;
        $scope.callbackRequestCheckbox = false;
        $scope.phoneNumber = "";
        $uibModalInstance.close();
        Authentication.logout();
        cookiesHandlerService.clearCookieData();
        $scope.ShowMessageHistoryWindow = false;
       
    }


    function OnIndivisualClose() {
        $scope.emailChatHistory = false;
        $scope.emailOfflineMessages = false;
        $scope.callbackRequestCheckbox = false;
        $scope.phoneNumber = "";

        ActiveChatSession.removePrivateRoom($scope.currentRoom.id);
        if (ActiveChatSession.getPrivateRooms().users.length == 0)
        {
      
            $uibModalInstance.close();
            Authentication.logout();
            cookiesHandlerService.clearCookieData();

        }
        $scope.ShowMessageHistoryWindow = false;
     
    }
    $scope.emailChatHistory = false;
    $scope.emailOfflineMessages = false;
    $scope.callbackRequestCheckbox = false;
    $scope.phoneNumber = "";
    // close the chat window

    $scope.IndivisualClose = function () {
        if ($scope.callbackRequestCheckbox && (!angular.isDefined($scope.phoneNumber) || $scope.phoneNumber == "")) {
            ModelDialogService.error("Error", "Please enter the phone number with format xxx-xxx-xxxx to request a call.");
        } else {
            UserAccountService.retailLogoutWithSettings($scope.user.id, $scope.currentRoom.id, $scope.emailChatHistory, $scope.emailOfflineMessages, $scope.callbackRequestCheckbox, $scope.phoneNumber).then(OnIndivisualClose);
        }
    }

    $scope.cancel = function () {
        if ($scope.callbackRequestCheckbox && (!angular.isDefined($scope.phoneNumber) || $scope.phoneNumber == "")) {
            ModelDialogService.error("Error", "Please enter the phone number with format xxx-xxx-xxxx to request a call.");
        } else {
            UserAccountService.retailLogoutWithSettings($scope.user.id, $scope.currentRoom.id, $scope.emailChatHistory, $scope.emailOfflineMessages, $scope.callbackRequestCheckbox, $scope.phoneNumber).then(OnCloseChat);
        }
    }
    $scope.ShowMessageHistoryWindow = false;
    $scope.ShowMessageHistoryPopup = function () {
        $scope.IndivisualCloseRequest =false;
        $scope.emailChatHistory = false;
        $scope.emailOfflineMessages = false;
        $scope.callbackRequestCheckbox = false;
        $scope.phoneNumber = "";
        if ($scope.ShowMessageHistoryWindow) {
            $scope.ShowMessageHistoryWindow = false;
        } else {
            $scope.ShowMessageHistoryWindow = true;
        }
    };
    $scope.IndivisualCloseRequest = false;
    $scope.ShowIndivisualMessageHistoryPopup = function () {
        $scope.IndivisualCloseRequest = true;
        $scope.emailChatHistory = false;
        $scope.emailOfflineMessages = false;
        $scope.callbackRequestCheckbox = false;
        $scope.phoneNumber = "";
        if ($scope.ShowMessageHistoryWindow) {

            $scope.ShowMessageHistoryWindow = false;
        } else {
            $scope.ShowMessageHistoryWindow = true;
        }
    };


    // hide the chat window
    $scope.hide = function () {
        $uibModalInstance.close();
    };
    // shrink the chat window
    $scope.shrink = function () {   
        $uibModalInstance.close();
        ActiveChatSession.setModelWindowStateMinimize();
    };
    $scope.addMessageOnEnter = function ($event, room, message) {
        var keyCode = $event.which || $event.keyCode;
        if (keyCode === 13) {
            $scope.sendRoomMessage(room, message);
            this.Message = "";
        }
    };

    function createReplyHitInfo(isEligible, repliedBroadcastMessageId, broadcastRoomId) {
        return {
            isEligibleToCreateReplyHit: isEligible,
            repliedBroadcastMessageId: repliedBroadcastMessageId,
            broadcastRoomId: broadcastRoomId
        }
    }

    function userGroupUsersChangedHandler(userGroupUsersChangedEvent) {
        if (_.contains(userGroupUsersChangedEvent.message.publicRoomIdList, $scope.currentRoom.id)) {
            $scope.$apply(function () {
                if (userGroupUsersChangedEvent.message.event == "ADD") {
                    $scope.roomUsers.push(userGroupUsersChangedEvent.message.user)
                } else {
                    var index = $scope.roomUsers.indexOf(_.findWhere($scope.roomUsers, {
                        id: userGroupUsersChangedEvent.message.user.id
                    }));
                    $scope.roomUsers.splice(index, 1)
                }
            })
        }
    }

    function chatUserUpdatedHandler(chatUserUpdatedEvent) {

        $scope.$apply(function () {
            var roomUser = _.findWhere($scope.roomUsers, {
                id: chatUserUpdatedEvent.user.id
            });
            if (roomUser) {
                $scope.roomUsers.splice(_.indexOf($scope.roomUsers, roomUser), 1, chatUserUpdatedEvent.user)
            }
            var countRoomOnline = function (data) {
                $scope.onlineCount = data.online - 1 > 0 ? data.online - 1 : 0;
   
            };
            var errorCountRoomOnline = function () {
                $scope.onlineCount = ""
            };

            if ($scope.currentRoom.id > 0) {
                UserAccountService.fetchParticipantsCountForRoom($scope.currentRoom.id).then(countRoomOnline, errorCountRoomOnline)
            }
        });
    }

    function sessionUserUpdatedHandler(sessionUserUpdatedEvent) {
        if (sessionUserUpdatedEvent.user.id == $scope.user.id) {
            $scope.user = sessionUserUpdatedEvent.user
        }
    }

    function roomUsersChangedHandler(roomUsersChangedEvent) {
        if (roomUsersChangedEvent.roomId == $scope.currentRoom.id) {
            $scope.$apply(function () {
                $scope.roomUsers = ActiveChatSession.getRoomUsersForRoom(Room)
            })
        }
    }

    function roomUnreadHandler(event) {
        $scope.unread = event.unread
    }

    function userTypingHandler(result) {
        $scope.$apply(function () {
            $scope.typingRoomId = result.event.roomId;
            $scope.isTyping = true
        })
    }

    function userFinishTypingHandler(result) {
        $scope.$apply(function () {
            $scope.typingRoomId = result.event.roomId;
            $scope.isTyping = false
        })
    }
    var ReplyMessage = {};
    var finishTypingTimer = null;
    var delay = false;
    var typingTimer = null;
    var startToIndicateCharacterLength = 2;
    $scope.typing = function (currentRoom, message) {
        if (currentRoom.roomType == "PRIVATE" && message!=null &&  message.length > startToIndicateCharacterLength) {
            clearTimeout(finishTypingTimer);
            finishTypingTimer = setTimeout(function () {
                delay = false;
                UserAccountService.finishTypePrivateMessage(currentRoom)
            }, 3e3);
            if (!delay) {
                UserAccountService.typePrivateMessage(currentRoom).then(function () {
                    delay = true
                })
            } else {
                clearTimeout(typingTimer);
                typingTimer = setTimeout(function () {
                    UserAccountService.typePrivateMessage(currentRoom)
                }, 1500)
            }
        }
    };
    $scope.sendRoomMessage = function (room, message) {
        if (!$scope.tourEnabled && validateRoom(room)) {
            var messageType = room.roomType == "PUBLIC" ? "ROOM_MESSAGE" : "PRIVATE_ROOM_MESSAGE";
            var isReplyMessageToBroadcast = ReplyMessage.isBroadcast && message.indexOf(ReplyMessage.message.trim()) > -1;
            var messageExtras = {
                tags: null,
                files: null,
                linkMetadata: null,
                messageType: messageType,
                replyHitInfo: createReplyHitInfo(isReplyMessageToBroadcast, ReplyMessage.repliedBroadcastMessageId, ReplyMessage.broadcastRoomId)
            };
            if (!_.isEmpty($scope.files)) {
                $scope.messageForUpload = message;
                $scope.messageExtrasForUpload = messageExtras;
                $scope.uploadFiles()
            } else {
                sendMessage(room, message, messageExtras)
            }
            this.Message = "";
        }
    };

    function validateRoom(room) {
        return angular.isObject(room) ? room.id || room.roomType : false
    }

    function sendMessage(room, message, extras) {
        if (validateMessage(message) && !_.isEmpty(extras.messageType)) {
            var messageData = {
                roomId: room.id,
                message: message.trim(),
                tags: extras.tags,
                files: extras.files,
                linkMetadata: extras.linkMetadata,
                replyHitInfo: extras.replyHitInfo
            };
            switch (room.roomType) {
                case "PRIVATE":
                    var success = function (result) {
                        $scope.error = null;
                        $scope.resetSuccessfully = true;
                        $scope.privateRooms.list[room.id].initiatorDeleted = result.initiatorDeleted;
                        $scope.privateRooms.list[room.id].participantDeleted = result.participantDeleted
                    };
                    var error = function (error) {
                        $scope.error = error;
                    };
                case "PUBLIC":
                    ActiveChatSession.send({
                        request: extras.messageType,
                        data: [".RoomMessageData", messageData]
                    })
            }
        }
    }

    function validateMessage(message) {
        if (!angular.isString(message) || message.trim().length == 0) {
            return false
        } else if (message.length > 500) {
            return false
        }
        return true
    }
    }]);
