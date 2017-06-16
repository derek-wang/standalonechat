
angular.module('chatModule').factory('ChatSessionService', ['ChatSession', 'RoomEventService', 'cookiesHandlerService', 'StompClientService', 'ModelDialogService', function (ChatSession, RoomEventService, cookiesHandlerService, StompClientService, ModelDialogService) {
        var ChatSessionData = null;

        function startChatSession(StompSession) {
            return ChatSession.startSessionWithStompSession(StompSession)
        }

        function setConnectedState(ActiveChatSession) {
            ChatSessionData = ActiveChatSession;
            return ActiveChatSession
        }

        function getChatSessionData() {
            return angular.copy(ChatSessionData)
        }
        function InitialRoomEvents()
        {
            var ChatSessionData = getChatSessionData();
            if (ChatSessionData != null) {
                angular.forEach(ChatSessionData.getPrivateRooms().list, function (room, index) {
                    RoomEventService.loadInitialRoomEventsIntoRoom(room);
                });
                
            } else {
                ModelDialogService.error("Error", "Error in getting session data");
       
            }
        }

        function Connect() {
            return StompClientService.connect().then(startChatSession).then(setConnectedState).then(InitialRoomEvents).catch(function (error) {
                ModelDialogService.error("Error", error);
            });
        };
        return {
            Connect: Connect,
            getChatSessionData: getChatSessionData
        };
    }]);
    angular.module('chatModule').factory("ChatSession", ['$timeout', '$q', 'Authentication', 'ChatSessionDataFactory', 'ChannelManager', 'ChannelEventHandlerFactory', 'DocumentTitleService', 'UserAccountService', 'cookiesHandlerService', function ($timeout, $q, Authentication, ChatSessionDataFactory, ChannelManager, ChannelEventHandlerFactory, DocumentTitleService, UserAccountService, cookiesHandlerService) {
        var ROOM_LIST_RECEIVED_TIMEOUT = 15e3;
        

        function StompChatSession(StompSession) {
            var sessionData = ChatSessionDataFactory.getInstance();
            sessionData.user = Authentication.getUser();
            sessionData.user.$newNotificationsCounter = 0;
            sessionData.user.$unreadNotifications = [];
      
            var channelHandlers = [];
            var publicRoomSubscriptions = {
                handlers: {}
            };

            function singleCallDelegateHandler(delegate) {
                var called = false;
                return function (data) {
                    if (called) {
                        return
                    }
                    called = true;
                    delegate(data)
                }
            }

            function resolvePromiseDelegateHandler(promise, delegate) {
                return function (data) {
                    promise.resolve(delegate(data))
                }
            }

            function setModelWindowStateClose() {
                sessionData.privateRooms.currentstate = 'close';
                setCookies();
            };

            function setModelWindowStateMinimize() {
                sessionData.privateRooms.currentstate = 'minimize';
                setCookies();
            };

            function setModelWindowStateOpen() {
                sessionData.privateRooms.currentstate = 'open';
                setCookies();

          
            };

            function send(message) {
                if (sessionData) {
                    sessionData.lastMessageSent = new Date
                }
                StompSession.send("/ws/dispatcher", message)
            }

            function interruptSession(error) {
                var SESSION_INTERRUPTED = {
                    error: error,
                    time: new Date,
                    type: ChannelManager.uiChannel.events.SESSION_INTERRUPTED
                };
                endSession().finally(function () {
                    ChannelManager.uiChannel.dispatch(SESSION_INTERRUPTED)
                })
            }

            function endSession() {
                function clearSession() {
                    channelHandlers = [];
                    publicRoomSubscriptions = {
                        handlers: {}
                    };
                    sessionData = ChatSessionDataFactory.getInstance();
                    ChannelManager.uiChannel.dispatch({
                        type: ChannelManager.uiChannel.events.NW_BADGE_CLEAR
                    })
                }
                DocumentTitleService.stop();
                return StompSession.disconnect().finally(clearSession)
            }

            function setCurrentRoom(room) {
                if (!angular.isObject(room)) {
                    return
                }
                var foundRoom = sessionData.getRoomById(room.id);
                if (foundRoom) {
                    sessionData.resetCurrentRoomMessages();
                    sessionData.setCurrentRoom(room);
                    ChannelManager.uiChannel.dispatch({
                        type: ChannelManager.uiChannel.events.NW_BADGE_DECREMENT,
                        count: room.unread.notification
                    });
                    room.unread.notification = 0;
                    room.unread.normal = 0;
                    room.unread.alertMeMatched = false;
                    ChannelManager.uiChannel.dispatch(angular.extend(sessionData.getRoomChangedEvent(room), {
                        type: ChannelManager.uiChannel.events.ROOM_CHANGED
                    }))
                }
                setCookies();
            }

            function setCookies() {
                if (sessionData != null) {
                    var CookiesData = {
                        CurrentRoomId: sessionData.getCurrentRoom().id,
                        user: sessionData.user,
                        currentstate: sessionData.privateRooms.currentstate
                    };
                    cookiesHandlerService.setCookieData(JSON.stringify(CookiesData));
                }
            }
            function getCookies() {
                var dealerid = Authentication.getSelectedDealerId();
                var chatinfo = cookiesHandlerService.getCookieData();
                if (chatinfo != undefined) {
                    var Data = JSON.parse(chatinfo);
                    if (Data.user != null) {
                        sessionData.privateRooms.currentstate = Data.currentstate;              
                        var room = sessionData.privateRooms.list[Data.CurrentRoomId];
                        setCurrentRoom(room);
                    }
                } else if (dealerid != null)
                {
                    angular.forEach(sessionData.privateRooms.users, function (user, index) {
             
                            if (dealerid == user.id) {
                              var room = sessionData.privateRooms.list[user.roomId];
                                setCurrentRoom(room);
                            }

                        

                    });

                }
            }
            function getCurrentRoomView() {
                return sessionData.getRoomView(sessionData.getCurrentRoom())
            }

            function getPublicRooms() {
                return sessionData.publicRooms
            }

            function getPrivateRooms() {
                return sessionData.privateRooms
            }

         

            function createPrivateRoom(messageData) {
                return send({
                    request: "CREATE_PRIVATE_ROOM",
                    data: [".CreateRoomMessageData", messageData]
                })
            }

            function getLastMessageSent() {
                return sessionData.lastMessageSent
            }

            function requestRoomList() {
                send({
                    request: "ROOM_LIST"
                })
            }

            function registerSession() {
                StompSession.setInterruptHandler(interruptSession);
                Authentication.registerPreLogoutHandler(endSession);
                var channelEventHandler = ChannelEventHandlerFactory.forSession(sessionData);
                publicRoomSubscriptions.handlers.chatUserRoomChangedHandler = channelEventHandler.chatUserRoomChangedHandler;
                var roomListReceivedPromise = startDeferredRoomListHandling(channelEventHandler);
                var chatUsersReceivedPromise = startDeferredChatUserHandling(channelEventHandler);
                var publicNotifier = StompSession.subscribe("/topic/server.notifier", ChannelManager.publicChannel.getDispatchingHandler());
                var privateNotifier = StompSession.subscribe("/user/topic/notifier", ChannelManager.privateChannel.getDispatchingHandler());
                var stompErrors = StompSession.subscribe("/user/topic/errors", ChannelManager.errorChannel.getDispatchingHandler());
                var queueSubscriptionPromises = $q.all([publicNotifier, privateNotifier, stompErrors]).then(requestRoomList);

                return $q.all([queueSubscriptionPromises, roomListReceivedPromise, chatUsersReceivedPromise]).then(registerChannelHandlers(channelEventHandler)).then(sessionData.updatePrivateRoomOnlineStatus).then(getCookies)
            }

            function startDeferredRoomListHandling(channelEventHandler) {
                var deferred = $q.defer();
                var subscription;
                var roomListReceivedTimeout = $timeout(function () {
                    deferred.reject("A list of available rooms was not returned from the server")
                }, ROOM_LIST_RECEIVED_TIMEOUT);

                function cancelTimeout() {
                    $timeout.cancel(roomListReceivedTimeout)
                }

                function removeSubscription() {
                    subscription.unsubscribe()
                }
                var singleCallRoomListHandler = singleCallDelegateHandler(resolvePromiseDelegateHandler(deferred, channelEventHandler.roomListHandler));
                subscription = ChannelManager.privateChannel.subscribe("ROOM_LIST", singleCallRoomListHandler);
                return deferred.promise.then(cancelTimeout).then(registerChatRoomSubscriptions).finally(removeSubscription)
            }

            function startDeferredChatUserHandling(channelEventHandler) {
                return UserAccountService.fetchPrivateRoomUserProfilesByChatUserId(sessionData.user.id).then(channelEventHandler.chatUserHandler);
            }

            function registerChatRoomSubscriptions() {
                _.each(sessionData.publicRooms.list, function (publicRoom) {
                    publicRoomSubscriptions[publicRoom.id] = StompSession.subscribe("/topic/chat." + publicRoom.id, ChannelManager.publicChannel.getDispatchingHandler())
                })
            }

            function chatUserRoomChangedHandler(chatUserRoomChangedEvent) {
                if (chatUserRoomChangedEvent.event == "ADDED") {
                    if (publicRoomSubscriptions[chatUserRoomChangedEvent.room.id] == null) publicRoomSubscriptions[chatUserRoomChangedEvent.room.id] = StompSession.subscribe("/topic/chat." + chatUserRoomChangedEvent.room.id, ChannelManager.publicChannel.getDispatchingHandler())
                } else if (publicRoomSubscriptions[chatUserRoomChangedEvent.room.id]) {
                    publicRoomSubscriptions[chatUserRoomChangedEvent.room.id];
                    delete publicRoomSubscriptions[chatUserRoomChangedEvent.room.id]
                }
                publicRoomSubscriptions.handlers.chatUserRoomChangedHandler(chatUserRoomChangedEvent)
            }

            function registerChannelHandlers(channelEventHandler) {
                return function () {
             
                    channelHandlers = [ChannelManager.publicChannel.subscribe("BROADCAST_MESSAGE_REPLY_COUNTER_UPDATED", channelEventHandler.broadcastReplyCounterUpdatedHandler), ChannelManager.publicChannel.subscribe("CHAT_USER_CHANGED", channelEventHandler.chatUserUpdatedHandler), ChannelManager.publicChannel.subscribe("ROOM_BROADCAST", channelEventHandler.roomBroadcastEventHandler), ChannelManager.publicChannel.subscribe("ROOM_MESSAGE", channelEventHandler.roomMessageEventHandler), ChannelManager.publicChannel.subscribe("ROOM_MESSAGE_REMOVED", channelEventHandler.roomMessageRemovedHandler), ChannelManager.publicChannel.subscribe("ROOM_UPDATED", channelEventHandler.roomChangedHandler), ChannelManager.publicChannel.subscribe("ROOM_USERS_CHANGED", channelEventHandler.roomUsersChangedHandler), ChannelManager.publicChannel.subscribe("TOPIC_CHANGE", channelEventHandler.topicChangeEventHandler), ChannelManager.publicChannel.subscribe("USER_GROUP_USER_CHANGED", channelEventHandler.userGroupUserChangedHandler), ChannelManager.publicChannel.subscribe("USER_STATUS_CHANGED", channelEventHandler.userStatusChangedHandler), ChannelManager.publicChannel.subscribe("ADMIN_MESSAGE", channelEventHandler.newNotificationHandler), ChannelManager.privateChannel.subscribe("CHAT_USER_ACCOUNT_CHANGED", channelEventHandler.chatUserAccountChangeHandler), ChannelManager.privateChannel.subscribe("CREATE_PRIVATE_ROOM", channelEventHandler.privateRoomCreatedHandler), ChannelManager.privateChannel.subscribe("KEEP_ALIVE", channelEventHandler.keepAliveEventHandler), ChannelManager.privateChannel.subscribe("PRIVATE_ROOM_MESSAGE", channelEventHandler.privateRoomMessageEventHandler), ChannelManager.privateChannel.subscribe("CHAT_USER_ROOM_CHANGED", chatUserRoomChangedHandler), ChannelManager.privateChannel.subscribe("NEW_NOTIFICATION", channelEventHandler.newNotificationHandler), ChannelManager.privateChannel.subscribe("PRIVATE_CONVERSATION_DELETED", channelEventHandler.privateConversationDeletedHandler), ChannelManager.privateChannel.subscribe("USER_TYPING", channelEventHandler.userTypingHandler), ChannelManager.privateChannel.subscribe("USER_FINISH_TYPING", channelEventHandler.userFinishTypingHandler), ChannelManager.privateChannel.subscribe("DEALER_USER_NO_RESPONSE", channelEventHandler.botMessageHandler), ChannelManager.privateChannel.subscribe("DEALERSHIP_NO_RESPONSE", channelEventHandler.botMessageHandler)]
                }
            }

            function initializeLastMessageSentForSessionNotification() {
                sessionData.lastMessageSent = 0
            }

            function startSessionNotification() {
                var sessionTimeout = sessionData.user.$sessionTimeout;
                initializeLastMessageSentForSessionNotification();
            }

            function enableNotifications() {
                DocumentTitleService.start()
            }

            function addLastHistorySearchToRoom(searchHistory, roomEvents) {
                var room = sessionData.getRoomById(searchHistory.room.id);
                room.$lastSearchHistory = searchHistory;
                room.$lastSearchedEvents = roomEvents
            }

            function removePrivateRoom(roomid) {
                sessionData.removePrivateRoom(roomid)
            }

            function createActiveSessionProxy() {
                function getUser() {
                    return sessionData.user
                }
                return {
                    removePrivateRoom: removePrivateRoom,
                    addLastHistorySearchToRoom: addLastHistorySearchToRoom,
                    setModelWindowStateMinimize: setModelWindowStateMinimize,
                    setModelWindowStateClose: setModelWindowStateClose,
                    setModelWindowStateOpen: setModelWindowStateOpen,
                    createPrivateRoom: createPrivateRoom,
                    getCurrentRoom: sessionData.getCurrentRoom,
                    getCurrentRoomView: getCurrentRoomView,
                    getPrivateRooms: getPrivateRooms,
                    getPublicRooms: getPublicRooms,
                    getRoomById: sessionData.getRoomById,
                    getRoomNameById: sessionData.getPublicRoomNameById,
                    getRoomUsersForRoom: sessionData.getRoomUsersForRoom,
                    getUser: getUser,
                    resetAlertMeTriggerCounter: sessionData.resetAlertMeTriggerCounter,
                    resetNewNotificationsCounter: sessionData.resetNewNotificationsCounter,
                    send: send,
                    setCurrentRoom: setCurrentRoom,
                    setRoomParticipants: sessionData.setRoomParticipants
                }
            }
            if (!StompSession || !angular.isObject(StompSession)) {
                throw "Invalid StompSession"
            }
            return registerSession().then(startSessionNotification).then(enableNotifications).then(createActiveSessionProxy).catch(function (error) {
                return endSession().finally(function () {
                    return $q.reject(error)
                })
            })
        }
        return {
            startSessionWithStompSession: StompChatSession
        }
    }]);
    angular.module('chatModule').factory("ChatSessionDataFactory", ["Authentication", function(Authentication) {
        return {
            getInstance: function () {
                var sessionData = {
                    publicRooms: {
                        list: {},
                        size: 0,
                        $alertMeCounter: 0,
                        $unread: {
                            notification: 0,
                            normal: 0
                        }
                    },
                    privateRooms: {
                        list: {},
                        size: 0,
                        $unread: {
                            notification: 0,
                            normal: 0
                        },
                        users: [],
                        currentstate: 'open'
                    },
                    lastMessageSent: null,
                    user: null
                };
                var currentRoom = null;
                sessionData.updateSessionUser = function () {
                    return Authentication.reloadUserProfile().then(function (result) {
                        sessionData.user = result;
                        return result
                    })
                };

                sessionData.logout = function () {
                    Authentication.logout();
                };

                sessionData.updatePublicRoomTopic = function (roomId, newTopic) {
                    var room = sessionData.publicRooms.list[roomId];
                    room.$title = !_.isEmpty(newTopic) ? room.name + " - " + newTopic : room.name;
                    room.topic = newTopic
                };
                sessionData.findPublicRoomById = function (roomId) {
                    return sessionData.publicRooms.list[roomId] || null
                };
                sessionData.findPrivateRoomById = function (roomId) {
                    return sessionData.privateRooms.list[roomId] || null
                };
                sessionData.getPublicRoomNameById = function (roomId) {
                    var room = sessionData.findPublicRoomById(roomId);
                    return room ? room.name : null
                };
                sessionData.getRoomById = function (roomId) {
                    var room = sessionData.findPublicRoomById(roomId);
                    room == null ? room = sessionData.findPrivateRoomById(roomId) : room;
                    return room
                };
                sessionData.updatePrivateRoomUser = function (user) {
                    var room = _.find(sessionData.privateRooms.list, function (room) {
                        return room.initiator.id == user.id || room.participant.id == user.id
                    });
                    if (room) {
                        angular.extend(room.initiator.id == user.id ? room.initiator : room.participant, user)
                    }
                };
                sessionData.addPrivateRoom = function (room) {
                    sessionData.privateRooms.list[room.id] = room;
                    sessionData.privateRooms.size++;
                    sessionData.privateRooms.users.push(room.participant.id === Authentication.getUser().id ? decoratePrivateRoom(room.id, room.initiator) : decoratePrivateRoom(room.id,room.participant))
                };
                function decoratePrivateRoom(roomid,_user)
                {
                    var user = _user;
                    user.online = true;
                    user.available = true;
                    user.roomId = roomid;
                    return user;
           

                }
                sessionData.removePublicRoom = function (roomId) {
                    if (sessionData.publicRooms.list[roomId]) {
                        sessionData.publicRooms.$unread.notification -= sessionData.publicRooms.list[roomId].unread.notification;
                        delete sessionData.publicRooms.list[roomId];
                        sessionData.publicRooms.size--
                    }
                };

                sessionData.removePrivateRoom = function (roomId) {
                    var users = sessionData.privateRooms.users;                  
              
                    if (sessionData.privateRooms.list[roomId]) {
                       sessionData.privateRooms.$unread.notification -= sessionData.privateRooms.list[roomId].unread.notification;
                        delete sessionData.privateRooms.list[roomId];
                        angular.forEach(users, function (user, index) {
                            
                            if (user.roomId == roomId) {
                                sessionData.privateRooms.users.splice(index, 1);  
                               // delete sessionData.privateRooms.users[index];
                            }
                        });
                        sessionData.privateRooms.size--
                    }
                };
                sessionData.addPublicRoom = function (room) {
                    sessionData.publicRooms.list[room.id] = room;
                    sessionData.publicRooms.size++
                };
                sessionData.updatePrivateRoomOnlineStatus = function () {
                    var users = sessionData.privateRooms.users;
                    _.each(sessionData.privateRooms.list, function (room) {
 
                        var otherUserId = room.participant.id === Authentication.getUser().id ? room.initiator.id : room.participant.id;
                        room.otherOnline = _.findWhere(users, {
                            id: otherUserId,
                            online: true
                        }) != null;
                        room.otherAvailable = _.findWhere(users, {
                            id: otherUserId,
                            available: true
                        }) != null
                    })
                };
                sessionData.removeRoomMessage = function (roomEvent) {
                    function removeMessage(message) {
                        message.message = roomEvent.message;
                        message.files = [];
                        message.tags = [];
                        message.linkMetadata = null;
                        message.$removed = true
                    }

                    function removeAppendedMessage(appendedMessages) {
                        var message = _.findWhere(appendedMessages, {
                            id: roomEvent.id
                        });
                        if (message) {
                            message.message = roomEvent.message;
                            message.$removed = true
                        }
                    }
                    var room = sessionData.getRoomById(roomEvent.$room.id);
                    for (var i = room.messages.length - 1; i >= 0; i--) {
                        var message = room.messages[i];
                        if (message.id <= roomEvent.id) {
                            message.id == roomEvent.id ? removeMessage(message) : removeAppendedMessage(message.appendedMessage);
                            return
                        }
                    }
                };
                sessionData.resetCurrentRoomMessages = function () {
                    var currentRoom = sessionData.getCurrentRoom();
                    if (!_.isEmpty(currentRoom)) {
                        currentRoom.$lastMessage = false;
                        currentRoom.messages = _.last(currentRoom.messages, 150)
                    }
                };
                sessionData.getCurrentRoom = function () {
                    return currentRoom || {}
                };
                sessionData.setCurrentRoom = function (room) {
                    if (!angular.isObject(room)) {
                        return
                    }
                    var roomList = room.roomType == "PUBLIC" ? sessionData.publicRooms : sessionData.privateRooms;
                    currentRoom = room;
                    roomList.$unread.notification -= room.unread.notification;
                    roomList.$unread.normal -= room.unread.normal;
                };
                sessionData.getRoomUsersForRoom = function (room) {
                    if (!room || !room.participants) {
                        return []
                    }
                    return room.participants.length > 0 ? room.participants : []
                };
                sessionData.setRoomParticipants = function (roomId, participants) {
                    if (sessionData.publicRooms.list[roomId]) {
                        sessionData.publicRooms.list[roomId].participants = participants
                    }
                };
                sessionData.getRoomView = function (room) {
                    return {
                        id: room.id,
                        roomType: room.roomType,
                        otherOnline: room.otherOnline,
                        otherAvailable: room.otherAvailable,
                        name: room.name,
                        topic: room.topic,
                        participants: room.participants && room.participants.length > 0 ? room.participants : []
                    }
                };
                sessionData.getRoomChangedEvent = function (room) {
                    return {
                        roomView: sessionData.getRoomView(room)
                    }
                };
                sessionData.updateReplyCounterOfRoomMessage = function (roomEvent) {
                    var room = sessionData.getRoomById(roomEvent.$room.id);
                    var message = _.findWhere(room.messages, {
                        id: roomEvent.id
                    });
                    if (message) {
                        message.$replyCount = roomEvent.$replyCount
                    }
                };
                sessionData.increaseAlertMeTriggeredCounter = function () {
                    sessionData.publicRooms.$alertMeCounter += 1
                };
                sessionData.resetAlertMeTriggerCounter = function () {
                    sessionData.publicRooms.$alertMeCounter = 0;
                    var sessionPublicRooms = sessionData.publicRooms.list;
                    _.forEach(sessionPublicRooms, function (room) {
                        sessionPublicRooms[room.id].unread.alertMeMatched = false
                    })
                };
                sessionData.displayAlertMeMatched = function (event) {
                    var eventRoomId = event.room.id;
                    if (currentRoom.id != eventRoomId) {
                        sessionData.publicRooms.list[eventRoomId].unread.alertMeMatched = true
                    }
                };
                sessionData.increaseNewNotificationsCounter = function () {
                    sessionData.user.$newNotificationsCounter += 1
                };
                sessionData.decreaseNewNotificationsCounter = function () {
                    sessionData.user.$newNotificationsCounter -= 1
                };
                sessionData.resetNewNotificationsCounter = function () {
                    sessionData.user.$newNotificationsCounter = 0
                };
                return sessionData
            }
        }
    }]);
