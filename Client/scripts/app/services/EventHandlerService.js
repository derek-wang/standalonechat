    angular.module('chatModule').factory("ChannelEventHandlerFactory", ["RoomMessageDecoratorFactory", "UiChannel", "UserAccountService", "EventDecoratorFactory", function (RoomMessageDecoratorFactory, UiChannel, UserAccountService, EventDecoratorFactory) {
        function forSession(SessionData) {
            var eventDecorator = EventDecoratorFactory.forSessionInfo(SessionData);

            function incrementNotificationUnreadCounts(rooms, roomId) {
                rooms.list[roomId].unread.notification++;
                rooms.$unread.notification++
            }


            function incrementNormalUnreadCounts(rooms, roomId) {
                rooms.list[roomId].unread.normal++;
                rooms.$unread.normal++
            }

            function insertRoomMessage(currentMessage, room) {
                var lastMessage = _.last(room.messages);
          
                if (lastMessage && RoomMessageDecoratorFactory.shouldAppendMessage(currentMessage, lastMessage)) {
                
                    var messageAppended = {
                        id: currentMessage.id,
                        message: currentMessage.message,
                        roomId: currentMessage.$room.id,
                        $removed: currentMessage.$removed,
                        $from: currentMessage.$from.id,
                        $roomType: currentMessage.$room.roomType
                    };
                    if (lastMessage.appendedMessage !== "undefined" && lastMessage.appendedMessage != undefined && lastMessage.inquiry === false) {
                
                        lastMessage.appendedMessage.push(messageAppended)
                    } else {
                       
                        room.messages.push(currentMessage)
                    }
                } else {
                   
                    room.messages.push(currentMessage);
                  }
                room.lastActive = currentMessage.$date
            }

            function roomListHandler(roomListEvent) {
                roomListEvent = eventDecorator.decorateRoomListEvent(roomListEvent);
                SessionData.publicRooms.list = roomListEvent.$publicRooms;
                SessionData.publicRooms.size = _.size(roomListEvent.$publicRooms);
                SessionData.privateRooms.list = roomListEvent.$privateRooms;
                SessionData.privateRooms.size = _.size(roomListEvent.$privateRooms);
                var isLastRoomIdValid = SessionData.user.$lastRoomId != null && SessionData.user.$lastRoomId != 0;
                if (SessionData.user != null && isLastRoomIdValid) {
                    var publicRoom = _.findWhere(roomListEvent.$publicRooms, {
                        id: SessionData.user.$lastRoomId
                    });
                    var privateRoom = _.findWhere(roomListEvent.$privateRooms, {
                        id: SessionData.user.$lastRoomId
                    });
                    if (angular.isDefined(publicRoom)) {
                        SessionData.setCurrentRoom(publicRoom)
                    } else if (angular.isDefined(privateRoom)) {
                        SessionData.setCurrentRoom(privateRoom)
                    }
                } else {
                    SessionData.setCurrentRoom(_.values(roomListEvent.$publicRooms)[0])
                }
            }

            function chatUserHandler(chatUserList) {
                chatUserList = eventDecorator.decorateChatUserEvent(chatUserList);
                SessionData.privateRooms.users = chatUserList;
                return chatUserList
            }

            function userStatusChangedHandler(message) {
                var privateUserAccount = _.findWhere(SessionData.privateRooms.users, {
                    id: message.user.id
                });

                function dispatchUiChannelStatusUpdate(user) {
                    var userLoggedIn = message.status == "ONLINE" || message.status == "AVAILABLE";
                    UiChannel.dispatch({
                        type: UiChannel.events.CHAT_USER_UPDATED,
                        user: user,
                        loggedIn: userLoggedIn
                    })
                }

                function updateUserStatus(user, message) {
                    user.online = message.status == "ONLINE";
                    user.available = message.status == "AVAILABLE"
                }

                function updatePrivateRoomStatus() {
                    if (privateUserAccount) {
                        updateUserStatus(privateUserAccount, message);
                        var privateRoom = _.find(SessionData.privateRooms.list, function (room) {
                            return room.initiator.id == privateUserAccount.id || room.participant.id == privateUserAccount.id
                        });
                        if (privateRoom) {
                            privateRoom.otherOnline = privateUserAccount.online;
                            privateRoom.otherAvailable = privateUserAccount.available
                        }
                        dispatchUiChannelStatusUpdate(privateUserAccount);
                    }
                }

                function updatePublicRoomParticipantsStatus() {
                    var roomsToUpdate = _.filter(SessionData.publicRooms.list, function (room) {
                        return _.findWhere(room.participants, {
                            id: message.user.id
                        })
                    });
                    roomsToUpdate.forEach(function (room) {
                        var participant = _.findWhere(SessionData.publicRooms.list[room.id].participants, {
                            id: message.user.id
                        });
                        if (participant) {
                            var contactIndex = _.indexOf(SessionData.publicRooms.list[room.id].participants, participant);
                            updateUserStatus(participant, message);
                            SessionData.publicRooms.list[room.id].participants.splice(contactIndex, 1, participant)
                        }
                        dispatchUiChannelStatusUpdate(participant)
                    })
                }
                updatePrivateRoomStatus();
                updatePublicRoomParticipantsStatus()
            }

            function userGroupUserChangedHandler(message) {
                message.user = eventDecorator.decorateChatUserEvent([message.user])[0];
                processNewUser(message)
            }

            function processNewUser(message) {
                message.event == "ADD" ? addNewUser(message) : removeUser(message);
                var rooms = _.filter(SessionData.publicRooms.list, function (room) {
                    return _.contains(message.publicRoomIdList, room.id)
                });
                if (!_.isEmpty(rooms)) {
                    _.each(rooms, function (room) {
                        switch (message.event) {
                            case "ADD":
                                room.$users.push(message.user.id);
                                room.participants.length > 0 ? room.participants.push(message.user) : room.participants = [];
                                break;
                            case "REMOVE":
                                room.$users = _.without(room.$users, message.user.id);
                                room.participants = room.participants.length > 0 ? _.without(room.participants, _.findWhere(room.participants, {
                                    id: message.user.id
                                })) : [];
                                break;
                            default:
                                return
                        }
                    });
                    UiChannel.dispatch({
                        type: UiChannel.events.USER_GROUP_USERS_CHANGED,
                        message: message
                    })
                }
            }

            function addNewUser(message) {
                SessionData.privateRooms.users.push(message.user)
            }

            function removeUser(message) {
                var index = SessionData.privateRooms.users.indexOf(_.findWhere(SessionData.privateRooms.users, {
                    id: message.user.id
                }));
                SessionData.privateRooms.users.splice(index, 1);
                SessionData.updatePrivateRoomUser(message.user)
            }

            function chatUserRoomChangedHandler(chatUserRoomChangedEvent) {
                var publicRoom = eventDecorator.decoratePublicRoom(chatUserRoomChangedEvent.room, chatUserRoomChangedEvent.users);
                if (chatUserRoomChangedEvent.event == "ADDED") {
                    SessionData.addPublicRoom(publicRoom)
                } else {
                    SessionData.removePublicRoom(chatUserRoomChangedEvent.room.id)
                }
                UiChannel.dispatch({
                    type: UiChannel.events.CHAT_USER_ROOMS_CHANGED,
                    room: publicRoom
                })
            }

            function roomUsersChangedHandler(roomUsersChangedEvent) {
                var publicRoom = SessionData.findPublicRoomById(roomUsersChangedEvent.roomId);
                if (publicRoom) {
                    var usersRemoved = publicRoom.$users.length > roomUsersChangedEvent.users.length;
                    publicRoom.$users = roomUsersChangedEvent.users;
                    if (usersRemoved && publicRoom.participants.length > 0) {
                        publicRoom.participants = _.filter(publicRoom.participants, function (participant) {
                            return _.contains(roomUsersChangedEvent.users, participant.id)
                        })
                    } else {
                        publicRoom.participants = []
                    }
                    UiChannel.dispatch({
                        type: UiChannel.events.ROOM_USERS_CHANGED,
                        roomId: roomUsersChangedEvent.roomId,
                        usersRemoved: usersRemoved,
                        online: roomUsersChangedEvent.userChangedIsOnline
                    })
                }
            }

            function roomMessageEventHandler(roomMessageEvent) {
               
                var roomMessage = eventDecorator.decorateRoomMessageEvent(roomMessageEvent);
                handleRoomMessage(roomMessage, SessionData.publicRooms);
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_ROOM_MESSAGE,
                    message: roomMessage
                })
            }

            function handleRoomMessage(roomMessage, rooms) {
                var roomId = roomMessage.$room.id;

                function isRoomFocused() {
                    if (SessionData.privateRooms.currentstate == "minimize") {
                        return false;
                    }

                    return roomId == SessionData.getCurrentRoom().id;
                }

                function isMessageBroadcastOrPrivate() {
                    return roomMessage.isBroadcast || roomMessage.$room.roomType == "PRIVATE"
                }
                if (!roomMessage.$own && (!isRoomFocused())) {
          
                    if (isMessageBroadcastOrPrivate()) {
             
                        incrementNotificationUnreadCounts(rooms, roomId);
                        UiChannel.dispatch({
                            type: UiChannel.events.NW_BADGE_INCREMENT,
                            count: 1
                        })
                    } else {
                 
                        incrementNormalUnreadCounts(rooms, roomId)
                    }
                }
           
                insertRoomMessage(roomMessage, rooms.list[roomId]);
            }

            function privateRoomMessageEventHandler(roomMessageEvent) {
            
                var roomMessage = eventDecorator.decorateRoomMessageEvent(roomMessageEvent);
                var roomId = roomMessage.$room.id;

               

                if (!SessionData.privateRooms.list[roomId]) {
            
                    var room = eventDecorator.decoratePrivateRoom(roomMessageEvent.room);
                    room.otherOnline = true;
                    room.otherAvailable = false;
                    SessionData.addPrivateRoom(room)
                }
                handleRoomMessage(roomMessage, SessionData.privateRooms);
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_ROOM_MESSAGE,
                    message: roomMessage
                });
            }

            function roomBroadcastEventHandler(broadcastEvent) {
                var roomMessage = eventDecorator.decorateRoomMessageEvent(broadcastEvent);
                handleRoomMessage(roomMessage, SessionData.publicRooms);
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_ROOM_MESSAGE,
                    message: roomMessage
                })
            }

            function topicChangeEventHandler(broadcastEvent) {
                var roomMessage = eventDecorator.decorateRoomMessageEvent(broadcastEvent);
                SessionData.updatePublicRoomTopic(roomMessage.$room.id, roomMessage.$newTopic);
                handleRoomMessage(roomMessage, SessionData.publicRooms);
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_ROOM_MESSAGE,
                    message: roomMessage
                })
            }

            function keepAliveEventHandler(keepAliveEvent) { }

            function privateRoomCreatedHandler(createRoomEvent) {
                var roomId = createRoomEvent.room.id;
                var privateRoom = SessionData.findPrivateRoomById(roomId);
                var sameUserCreatedTheRoom = createRoomEvent.room.initiator.id == createRoomEvent.room.participant.id;
                if (!privateRoom && !sameUserCreatedTheRoom) {
                    var room = eventDecorator.decoratePrivateRoom(createRoomEvent.room);
                    room.otherOnline = false;
                    room.otherAvailable = false;
                    if (SessionData.user != null && SessionData.user.id == room.initiator.id) {
                        room.otherOnline = createRoomEvent.participantOnline;
                        room.otherAvailable = createRoomEvent.participantAvailable
                    } else if (SessionData.user != null && SessionData.user.id == room.participant.id) {
                        room.otherOnline = createRoomEvent.initiatorOnline;
                        room.otherAvailable = createRoomEvent.initiatorAvailable
                    }
                    SessionData.addPrivateRoom(room)
                }
                UiChannel.dispatch({
                    type: UiChannel.events.ROOM_CHANGE,
                    roomId: roomId
                })
            }

            function roomChangedHandler(roomChangedEvent) {
                var updatedRoom = eventDecorator.decorateRoomUpdatedEvent(roomChangedEvent.roomView);
                var room = SessionData.findPublicRoomById(updatedRoom.id);
                if (room.$version < updatedRoom.$version) {
                    room = angular.extend(room, updatedRoom);
                    SessionData.updatePublicRoomTopic(updatedRoom.id, room.topic);
                    UiChannel.dispatch({
                        type: UiChannel.events.ROOM_UPDATED,
                        room: room
                    })
                }
            }

            function chatUserUpdatedHandler(chatUserUpdatedEvent) {
                function updateUserInPublicRooms(user, publicRooms) {
                    var roomsToUpdate = _.filter(publicRooms, function (room) {
                        return _.findWhere(room.participants, {
                            id: user.id
                        })
                    });
                    roomsToUpdate.forEach(function (room) {
                        var participant = _.findWhere(publicRooms[room.id].participants, {
                            id: user.id
                        });
                        if (participant && participant.$version <= user.$version) {
                            var contactIndex = _.indexOf(publicRooms[room.id].participants, participant);
                            publicRooms[room.id].participants.splice(contactIndex, 1, user)
                        }
                    })
                }

                function updateUserInPrivateRooms(user, privateRoomUsers) {
                    var existingUser = _.findWhere(privateRoomUsers, {
                        id: user.id
                    });
                    if (existingUser && existingUser.$version <= user.$version) {
                        privateRoomUsers.splice(_.indexOf(privateRoomUsers, existingUser), 1, user);
                        SessionData.updatePrivateRoomUser(user)
                    }
                }
                var updatedUser = eventDecorator.decorateChatUserEvent([chatUserUpdatedEvent.userView])[0];
                updateUserInPublicRooms(updatedUser, SessionData.publicRooms.list);
                updateUserInPrivateRooms(updatedUser, SessionData.privateRooms.users);
                if (SessionData.user.id == updatedUser.id && SessionData.user.$version < updatedUser.$version) {
                    updateSessionUser()
                }
                UiChannel.dispatch({
                    type: UiChannel.events.CHAT_USER_UPDATED,
                    user: updatedUser
                })
            }

            function updateSessionUser() {
                SessionData.updateSessionUser().then(function (sessionUser) {
                    UiChannel.dispatch({
                        type: UiChannel.events.SESSION_USER_UPDATED,
                        user: sessionUser
                    })
                })
            }

            function roomMessageRemovedHandler(roomMessageRemovedEvent) {
                var roomMessage = eventDecorator.decorateRoomMessageEvent(roomMessageRemovedEvent);
                SessionData.removeRoomMessage(roomMessage);
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_ROOM_MESSAGE,
                    message: roomMessage
                })
            }

            function chatUserAccountChangeHandler(userEvent) {
                var title, message;
                switch (userEvent.event) {
                    case "LOCK":
                        title = "Account Suspended";
                        message = "Your account has been suspended. Please contact your customer service representative for more information.";
                        break;
                    case "DELETE":
                        title = "Account Removed";
                        message = "Your account has been removed. Please contact your customer service representative for more information.";
                        break;
                    default:
                        return
                }
                //DialogService.info(title, message).then(logoutUser)
            }

            function broadcastReplyCounterUpdatedHandler(roomMessageReplyCounterEvent) {
                var replyCounterEvent = eventDecorator.decorateRoomMessageEvent(roomMessageReplyCounterEvent);
                SessionData.updateReplyCounterOfRoomMessage(replyCounterEvent);
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_ROOM_MESSAGE,
                    message: replyCounterEvent
                })
            }

            function newNotificationHandler(newNotificationEvent) {
                SessionData.increaseNewNotificationsCounter();
                var notification = eventDecorator.decorateNotificationEvent(newNotificationEvent);
                UiChannel.dispatch({
                    type: UiChannel.events.NW_BADGE_INCREMENT,
                    count: 1
                });
                UiChannel.dispatch({
                    type: UiChannel.events.NEW_NOTIFICATION,
                    notification: notification
                });
            }

            function privateConversationDeletedHandler(event) {
                UiChannel.dispatch({
                    type: UiChannel.events.PRIVATE_CONVERSATION_DELETED,
                    event: event
                })
            }

            function userTypingHandler(event) {
                UiChannel.dispatch({
                    type: UiChannel.events.USER_TYPING,
                    event: event
                })
            }

            function userFinishTypingHandler(event) {
                UiChannel.dispatch({
                    type: UiChannel.events.USER_FINISH_TYPING,
                    event: event
                })
            }

            function botMessageHandler(event) {

              
                if (event.messageType == "DEALER_USER_NO_RESPONSE") {
                    var message = event.dealerUser.firstName + " " + event.dealerUser.lastName + " doesn't seem to be available.  Hold on while we fetch someone else at the dealership.";
                    constructBotMessage(event.dealerUser, message, event.room.id)
                }
                if (event.messageType == "DEALERSHIP_NO_RESPONSE") {
                    var dealership;
                    if (event.room.initiator.retail) {
                        dealership = event.room.participant.userGroup.name
                    } else {
                        dealership = event.room.initiator.userGroup.name
                    }
                    var message = "No one at " + dealership + " seems to be available.  If you'd like to receive messages to your email or have someone call you back, please select these options when you close this chat.  You can minimize the chat window and continue to surf agdealer.com and we'll let you know when someone responds to your inquiry.";
                    constructBotMessage(event.retailUser, message, event.room.id)
                }
            }

            function constructBotMessage(privateUserAccount, message, roomId) {
                var privateRoom = _.find(SessionData.privateRooms.list, function (room) {
                    return room.id == roomId
                });

                var roomMessage = {
                    $type: "NO_RESPONSE",
                    $own: null,
                    $date: (new moment).toDate().getTime(),
                    $from: null,
                    $room: privateRoom.room,
                    $roomTitle:"",
                    id: Math.floor(1e8 + Math.random() * 9e8),
                    message: "",
                    inquiry: false,
                    $topic: message
                };

                privateRoom.messages.push(roomMessage);

            }
            return {
                broadcastReplyCounterUpdatedHandler: broadcastReplyCounterUpdatedHandler,
                chatUserAccountChangeHandler: chatUserAccountChangeHandler,
                chatUserHandler: chatUserHandler,
                chatUserUpdatedHandler: chatUserUpdatedHandler,
                keepAliveEventHandler: keepAliveEventHandler,
                newNotificationHandler: newNotificationHandler,
                privateRoomCreatedHandler: privateRoomCreatedHandler,
                privateRoomMessageEventHandler: privateRoomMessageEventHandler,
                roomBroadcastEventHandler: roomBroadcastEventHandler,
                roomChangedHandler: roomChangedHandler,
                roomListHandler: roomListHandler,
                roomMessageEventHandler: roomMessageEventHandler,
                roomMessageRemovedHandler: roomMessageRemovedHandler,
                roomUsersChangedHandler: roomUsersChangedHandler,
                topicChangeEventHandler: topicChangeEventHandler,
                userGroupUserChangedHandler: userGroupUserChangedHandler,
                userStatusChangedHandler: userStatusChangedHandler,
                chatUserRoomChangedHandler: chatUserRoomChangedHandler,
                privateConversationDeletedHandler: privateConversationDeletedHandler,
                userTypingHandler: userTypingHandler,
                userFinishTypingHandler: userFinishTypingHandler,
                botMessageHandler: botMessageHandler
            }
        }
        return {
            forSession: forSession
        }
    }]);
    angular.module('chatModule').factory("EventDecoratorFactory", ['AppUrl', "ApiContext", "RoomMessageDecoratorFactory", "NotificationsDecoratorFactory", function (AppUrl, ApiContext, RoomMessageDecoratorFactory, NotificationsDecoratorFactory) {
        function forSessionInfo(SessionData) {
            function decorateRoomMessageEvent(roomMessageEvent) {
                var room = SessionData.getRoomById(roomMessageEvent.room.id);
                return RoomMessageDecoratorFactory.decorateRoomMessageEvent(roomMessageEvent, room)
            }

            function decorateRoomListEvent(roomListEvent) {
                function reducePublicRoom(memo, room) {
                    var recreateTagsFromNames = function (tags) {
                        var pullAllBy = [];
                        _.forEach(tags, function (tag) {
                            pullAllBy.push(room.$tags[tag])
                        });
                        return pullAllBy
                    };
                    room.roomType = room.roomType || "PUBLIC";
                    room.$tags = reduceTags(room);
                    room.$users = roomListEvent.roomIdMap[room.id] || [];
                    room.participants = [];
                    room.recreateTagsFromNames = recreateTagsFromNames;
                    decorateRoom(room);
                    memo[room.id] = room;
                    return memo
                }

                function reducePrivateRoom(memo, room) {
                    room.roomType = room.roomType || "PRIVATE";
                    room.initiator = decorateChatUser(room.initiator);
                    room.participant = decorateChatUser(room.participant);
                    decorateRoom(room);
                    memo[room.id] = room;
                    return memo
                }
                roomListEvent.$publicRooms = _.reduce(roomListEvent.publicRooms, reducePublicRoom, {});
                roomListEvent.$privateRooms = _.reduce(roomListEvent.privateRooms, reducePrivateRoom, {});
                return roomListEvent
            }

            function reduceTags(room) {
                var tags = _.reduce(room.tags, function (tags, tag) {
                    tags[tag.name] = tag;
                    return tags
                }, {});
                delete room.tags;
                return tags
            }

            function decorateRoom(room) {
                room.unread = {
                    notification: 0,
                    normal: 0
                };
                room.$loaded = false;
                room.$title = getRoomTitle(room);
                room.messages = []
            }

            function getRoomTitle(room) {
                var roomHasValidTopic = !_.isEmpty(room.topic) && room.topic.trim().length != 0;
                return roomHasValidTopic ? room.name + " - " + room.topic : room.name
            }

            function decorateChatUserEvent(chatUserList) {
                _.each(chatUserList, decorateChatUser);
                return chatUserList
            }

            function decorateChatUser(chatUser) {
                var userGroup = chatUser.userGroup ? " " + chatUser.userGroup.name + " - " + chatUser.userGroup.address.city + ", " + chatUser.userGroup.address.regionAbbrievation : "";
                chatUser.$display = chatUser.firstName + " " + chatUser.lastName;
                chatUser.$userGroup = userGroup;
                chatUser.fullName = chatUser.firstName + " " + chatUser.lastName;
                chatUser.$avatar = chatUser.avatar ? ApiContext + "/files/user/avatar/" + chatUser.id + "/" + chatUser.avatar : AppUrl + "/images/unknown-user-avatar.png";

                return chatUser
            }

            function decorateRoomUpdatedEvent(roomView) {
                delete roomView.topic;
                return angular.extend(roomView, {
                    $tags: reduceTags(roomView)
                })
            }

            function decoratePublicRoom(publicRoom, users) {
                publicRoom.$tags = reduceTags(publicRoom);
                publicRoom.$users = users;
                publicRoom.participants = [];
                decorateRoom(publicRoom);
                return publicRoom
            }

            function decoratePrivateRoom(privateRoom) {
                privateRoom.initiator = decorateChatUser(privateRoom.initiator);
                privateRoom.participant = decorateChatUser(privateRoom.participant);
                decorateRoom(privateRoom);
                return privateRoom
            }

            function decorateNotificationEvent(notificationEvent) {
                return NotificationsDecoratorFactory.decorateNotification(notificationEvent)
            }
            return {
                decorateRoomMessageEvent: decorateRoomMessageEvent,
                decorateRoomListEvent: decorateRoomListEvent,
                decorateChatUserEvent: decorateChatUserEvent,
                decorateRoomUpdatedEvent: decorateRoomUpdatedEvent,
                decoratePublicRoom: decoratePublicRoom,
                decoratePrivateRoom: decoratePrivateRoom,
                decorateNotificationEvent: decorateNotificationEvent
            }
        }
        return {
            forSessionInfo: forSessionInfo
        }
    }]);
    angular.module('chatModule').factory("ErrorChannel", ['RelayDispatcher', function (RelayDispatcher) {
        var dispatchingChannelHandler = function (channel) {
            return {
                handle: function (data) {
                    channel.dispatch(data.body);
                    return data
                }
            }
        };
            var channel = RelayDispatcher.getDispatcher();
            channel.getDispatchingHandler = function () {
                return dispatchingChannelHandler(channel)
            };
            return channel
        }]);
    angular.module('chatModule').factory("PrivateChannel", ['TopicChannelManager', function (TopicChannelManager) {
        var dispatchingChannelHandler = function (channel) {
            return {
                handle: function (data) {
                    channel.dispatch(data.body);
                    return data
                }
            }
        };
        var stompMessageKeyExtractor = function (msg) {
   
                if (!msg || !msg.messageType) {
                    return null
                }
                return msg.messageType
            };
            var channel = TopicChannelManager.getChannel("$private", stompMessageKeyExtractor);
            channel.getDispatchingHandler = function () {
                return dispatchingChannelHandler(channel)
            };
            return channel
        }]);
    angular.module('chatModule').factory("PublicChannel", ['TopicChannelManager', function (TopicChannelManager) {
        var dispatchingChannelHandler = function (channel) {
            return {
                handle: function (data) {
                    channel.dispatch(data.body);
                    return data
                }
            }
        };
        var stompMessageKeyExtractor = function (msg) {
     
          
     
                if (!msg || !msg.messageType) {
                    return null
                }
                return msg.messageType
            };
            var channel = TopicChannelManager.getChannel("$public", stompMessageKeyExtractor);
            channel.getDispatchingHandler = function () {
                return dispatchingChannelHandler(channel)
            };
            return channel
        }]);
    angular.module('chatModule').factory("UiChannel", ['TopicChannelManager', function (TopicChannelManager) {
        var dispatchingChannelHandler = function (channel) {
            return {
                handle: function (data) {
                    channel.dispatch(data.body);
                    return data
                }
            }
        };

        var uiMessageKeyExtractor = function (msg) {
    
                 if (!msg || !msg.type) {
                    return null
                }
                return msg.type
            };
        var events = {
            ALERT_ME_MATCHED: "ALERT_ME_MATCHED",
            ALL_NOTIFICATIONS: "ALL_NOTIFICATIONS",
            CF_TOUR: "CF_TOUR",
            CHAT_USER_ROOMS_CHANGED: "CHAT_USER_ROOMS_CHANGED",
            CHAT_USER_UPDATED: "CHAT_USER_UPDATED",
            CONTACTS_UPDATED: "CONTACTS_UPDATED",
            NEW_ADMIN_MESSAGE: "NEW_ADMIN_MESSAGE",
            NEW_ROOM_MESSAGE: "NEW_ROOM_MESSAGE",
            NW_APP_QUIT: "NW_APP_QUIT",
            NW_APP_RESTART: "NW_APP_RESTART",
            NW_BADGE_CLEAR: "NW_BADGE_CLEAR",
            NW_BADGE_DECREMENT: "NW_BADGE_DECREMENT",
            NW_BADGE_INCREMENT: "NW_BADGE_INCREMENT",
            NW_NOTIFICATION: "NW_NOTIFICATION",
            NW_OPEN_WINDOW: "NW_OPEN_WINDOW",
            NW_RECONNECTED: "NW_RECONNECTED",
            NW_RECONNECTING: "NW_RECONNECTING",
            PREVIOUS_ADMIN_MESSAGES: "PREVIOUS_ADMIN_MESSAGES",
            ROOM_CHANGE: "ROOM_CHANGE",
            ROOM_CHANGED: "ROOM_CHANGED",
            ROOM_UNREAD: "ROOM_UNREAD",
            ROOM_UPDATED: "ROOM_UPDATED",
            ROOM_USERS_CHANGED: "ROOM_USERS_CHANGED",
            SESSION_INTERRUPTED: "SESSION_INTERRUPTED",
            SESSION_REFRESH_REQUEST: "SESSION_REFRESH_REQUEST",
            SESSION_USER_UPDATED: "SESSION_USER_UPDATED",
            STATE_CHANGE: "STATE_CHANGE",
            USER_GROUP_USERS_CHANGED: "USER_GROUP_USERS_CHANGED",
            UNREAD_NOTIFICATIONS: "UNREAD_NOTIFICATIONS",
            NEW_NOTIFICATION: "NEW_NOTIFICATION",
            PRIVATE_CONVERSATION_DELETED: "PRIVATE_CONVERSATION_DELETED",
            USER_TYPING: "USER_TYPING",
            USER_FINISH_TYPING: "USER_FINISH_TYPING"
        };
        var channel = TopicChannelManager.getChannel("$ui", uiMessageKeyExtractor);
        channel.getDispatchingHandler = function () {
            return dispatchingChannelHandler(channel)
        };
        return angular.extend(channel, {
            events: events
        })
    }]);
    angular.module('chatModule').factory("ChannelManager", ['PublicChannel', 'PrivateChannel', 'UiChannel', 'ErrorChannel', function (PublicChannel, PrivateChannel, UiChannel, ErrorChannel) {
        return {
            errorChannel: ErrorChannel,
            privateChannel: PrivateChannel,
            publicChannel: PublicChannel,
            uiChannel: UiChannel
        }
    }]);
