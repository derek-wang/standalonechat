﻿
    angular.module('chatModule', ['ngAnimate', 'ngSanitize', 'ui.bootstrap', 'ngCookies', 'ngToast', 'angularMoment']);
angular.module('chatModule').constant("ApiContext", "http://app.automotocast.ca/api").constant("RequestContext", "").constant("AppName", "Auto Moto Web Chat").constant("AppUrl", "http://app.automotocast.ca/standaloneChat/").constant("AppVersion", "0");
    angular.module('chatModule').run(["$templateCache", function ($templateCache) {
        "use strict";
        $templateCache.put("partials/errorDialog.html", '<div class=modal-header><h3 class=modal-title>{{modal.title}}</h3></div><div class=modal-body><p>{{modal.message}}</p></div><div class=modal-footer><button class="btn btn-primary" ng-click=$close()>Close</button></div>');
        $templateCache.put("partials/infoDialog.html", '<div class=modal-header><h3 class=modal-title>{{modal.title}}</h3></div><div class=modal-body><p>{{modal.message}}</p></div><div class=modal-footer><button class="btn btn-primary" ng-click=$close()>OK</button></div>');
        $templateCache.put("partials/signedInDialog.html", ' <div class="ChatModal_Green" id="modal-body"> <form name="userForm" valid-submit="signIn()" novalidate> <div class="MiddleItems"> <h2 id="modal1Title"><img ng-src="{{AppUrl}}/images/Chat_icon.png"/> CHAT WITH <span>{{$root.groupName | uppercase}}</span></h2> <p id="modal1Desc"> SELECT AN AVAILABLE CONTACT FOR THIS DEALER: </p><div class="OnOF_Status" style="height:180px !important" ng-scrollbar rebuild-on-change> <ul class="CheckItems_List check_image"> <li ng-repeat="x in $root.Dealers | orderBy:&apos;firstName&apos;"> <span class="{{x.online==true?&apos;OnlineTextColor&apos;:&apos;&apos;}}"> <input type="checkbox" id="checkboxOnline{{x.id}}" ng-model="x.selected" ng-click="updateSelection($index, Dealers)" ng-required="!Dealerselected"/> <label for="checkboxOnline{{x.id}}"> <img ng-src="{{x.avatar}}" class="Small_Profile" title="" alt="" imageonload/><span><b>{{x.firstName+" "+x.lastName}}</b> - <b>{{x.online==true?&apos;ONLINE&apos;:&apos;OFFLINE&apos;}}</b></span> </label> </span> </li></ul> </div><p ng-show="!Dealerselected && userForm.$submitted" class="help-block">Please select dealer</p><p ng-if="$root.Dealers==0" class="help-block" style="color:red">{{$root.groupName}}not found in the database</p><br><div class="FieldRow" ng-class="{&apos;has-error&apos; : userForm.firstName.$invalid && !userForm.firstName.$pristine}"> <input type="text" name="firstName" class="FocusField" ng-model="$root.user.firstName" required placeholder="Enter Your First Name"> <p ng-show="userForm.firstName.$error.required && userForm.$submitted" class="help-block">First Name is required.</p></div><div class="FieldRow" ng-class="{&apos;has-error&apos; : userForm.lastName.$invalid && !userForm.lastName.$pristine}"> <input type="text" name="lastName" class="FocusField" ng-model="$root.user.lastName" required placeholder="Enter Your Last Name"> <p ng-show="userForm.lastName.$error.required && userForm.$submitted" class="help-block">First Name is required.</p></div><div class="FieldRow" ng-class="{&apos;has-error&apos; : userForm.email.$invalid && !userForm.email.$pristine}"> <input type="email" name="email" class="FocusField" ng-model="$root.user.email" required placeholder="Enter Your Email"> <p ng-show="userForm.email.$error.required && userForm.$submitted" class="help-block">Email is required.</p><p ng-show="userForm.email.$error.email && userForm.$submitted" class="help-block">Enter a valid email.</p></div><div class="FieldRow"><button type="submit" class="Btn_Yellow">START YOUR CHAT NOW</button></div><div class="BottomFixed"> <i class="fa fa-info-circle"></i> LEARN MORE ABOUT DEALER CHAT<span>DEALER CHAT POWERED BY <img ng-src="{{AppUrl}}/images/LogoWhite.PNG"/></span></div></div></form> </div>');
        $templateCache.put("partials/ChatDialog.html", ' <div class="ChatWindow"> <div class="ChatHeader"> <div class="LogoDiv"> <img ng-src="{{AppUrl}}/images/logo.png" alt="logo"> </div><div class="CloseWindow"> <ul> <li> <a ng-click="shrink()"><img ng-src="{{AppUrl}}/images/W-minimize.png" alt="minimize" title="Window Minimize"></a> </li><li> <a ng-click="ShowMessageHistoryPopup()"> <img ng-src="{{AppUrl}}/images/W-Close.png" alt="minimize" title="Window Close"> </a> </li></ul> </div><div class="clear"></div></div><div class="BodyDiv" id="modal-body"> <div class="overlay" id="HideBtnSlide_Menu" ng-click="HideSlideMenu()" ng-show="MenuSideBar"> </div><div id="EmailDropDownShow" ng-show="ShowMessageHistoryWindow"> <div class="check_image"> <ul> <li> <input type="checkbox" id="EmailMe" ng-model="emailChatHistory"> <label for="EmailMe">Email Me Chat History </label> </li><li> <input type="checkbox" id="SendResponses" ng-model="emailOfflineMessages"> <label for="SendResponses"> Send Responses to My Email </label> </li><li> <input type="checkbox" id="HaveDealer" ng-model="callbackRequestCheckbox"> <label for="HaveDealer">Have Dealer Call Me </label> </li><li> <input type="text" style="width:100%" id="phone" ng-model="phoneNumber" ng-show="callbackRequestCheckbox" placeholder="Enter your phone number" phone-input> </li><div class="clear"></div></ul> </div><div class="BtnCloseChat"> <button type="button" ng-click="cancel()" ng-show="!IndivisualCloseRequest"> CLOSE CHAT WINDOW </button> </div><div class="BtnCloseChat"> <button type="button" ng-click="IndivisualClose()" ng-show="IndivisualCloseRequest"> CLOSE CHAT WINDOW </button> </div></div><uib-tabset active="Activetab" vertical="true" data-ng-init="activecurrenttab()"> <div class="searchContact"> Your Conversations </div><uib-tab ng-repeat="tab in privateRooms.users" ng-click="setCurrentRoom(privateRooms.list[tab.roomId])"> <uib-tab-heading> <div class="ProfilePhoto"> <img ng-src="{{tab.$avatar}}" imageonload> <span class="{{tab.online==true?&apos;online&apos;:&apos;offline&apos;}}"></span> </div><div class="ProfileName"> <span class="userName">{{tab.fullName}}</span> <span ng-repeat="roomEvent in privateRooms.list[tab.roomId].messages | filter:{inquiry:false,bot:false,$type:&apos;MESSAGE&apos;}" ng-if="$last">{{roomEvent.message}}</span> </div><div class="ProfileTime"> <span class="no_msg" ng-show="privateRooms.list[tab.roomId].unread.notification>0">{{privateRooms.list[tab.roomId].unread.notification}}</span> </div><span class="CloseConversations"> <img ng-src="{{AppUrl}}/images/Close.png" alt="Close" title="Close" ng-click="ShowIndivisualMessageHistoryPopup()"> </span> <div class="clear"></div></uib-tab-heading> <div class="tabContent"> <div class="chatHeader2"> <span class="menu fa fa-bars" id="BtnSlide_Menu" ng-click="ShowSlideMenu()"></span> <div class="OnlinePName"> <div class="onlineStatusname"> <img ng-src="{{tab.$avatar}}" imageonload>{{tab.fullName}}<div class="{{tab.online==true?&apos;OnlineStatus&apos;:&apos;OfflineStatus&apos;}}"> <span> </span>{{tab.online==true?&apos;Online&apos;:&apos;Offline&apos;}}</div></div></div><div class="SerchPName"> <ul> <li class="SerchLi"> <span class="fa fa-search"></span> <input type="search" placeholder="Search" ng-model="searchMessage"/> </li><li class="ListIcons"> <i class="fa fa-list-ul" aria-hidden="true" ng-click="ShowIndivisualMessageHistoryPopup()"></i> </li></ul> </div></div><form name="userForm"> <div class="ItemDescription_Slider"> <div style="text-align:center;max-height:21px" ng-show="!privateRooms.list[tab.roomId].$loaded"><img src="{{AppUrl}}/images/ajax-loader.gif"/></div><div id="banner-slide" style="background: white;"> <div uib-chetterfoxcarousel active="active" interval="myInterval" no-wrap="true"> <div uib-slide ng-repeat="slide in privateRooms.list[tab.roomId].messages | filter:{inquiry:true}" index="$index"> <div class="ItemDescription_SlideItem arrow_box"> <div class="Description_Image"><img ng-src="{{slide.linkMetadata.metaImage}}"/></div><div class="Description_Text"> <div class="ItemName_BG">{{slide.linkMetadata.metaTitle}}<a target="_blank" href="{{slide.linkMetadata.originalUrl}}"> <label>VIEW LISTING</label></a></div><div class="Desc_Large">{{slide.linkMetadata.metaDescription}}</div></div><div class="clear"></div></div></div></div></div><div class="ClientChat_Row" ng-scrollbar rebuild-on-change bottom> <div> <ul> <li ng-repeat="roomEvent in privateRooms.list[tab.roomId].messages | filter:{inquiry:false,message:searchMessage}" class="{{roomEvent.$own==true?&apos;AdminChat&apos;:&apos;&apos;}}"> <div ng-if="roomEvent.$type==&apos;MESSAGE&apos; && roomEvent.bot==false"> <div ng-if="roomEvent.$own==false"> <div class="Client_Dp"> <img ng-src="{{tab.$avatar}}" imageonload/> </div><div class="Client_Words"> <p>{{roomEvent.message}}</p><div style="margin-right:10px;text-align:right" class="row no-gutter attachments" ng-show="roomEvent.files.length>0"> <div ng-repeat="file in roomEvent.files"> <cf-thumb file=::file height=184 width=245></cf-thumb> <span style="color:black" class=img-thumbnail-title><a id=download-{{::file.id}}href="{{ApiContext}}/files/download/{{::file.id}}" download>{{::file.name}}</a></span> </div></div><p style="padding-top:0px" ng-if="appended.message" ng-repeat="appended in roomEvent.appendedMessage" class=chat-message-content ng-bind-html="appended.message"></p><span>{{roomEvent.$date | date:&apos;medium&apos;}}</span> </div></div><div ng-if="roomEvent.$own==true"> <div class="Client_Words"> <p>{{roomEvent.message}}</p><div style="margin-right:10px;text-align:right" class="row no-gutter attachments" ng-show="roomEvent.files.length>0"> <div ng-repeat="file in roomEvent.files"> <cf-thumb file=::file height=184 width=245></cf-thumb> <span style="color:black" class=img-thumbnail-title><a id=download-{{::file.id}}href="{{ApiContext}}/files/download/{{::file.id}}" download>{{::file.name}}</a></span> </div></div><p style="padding-top:0px" ng-if="appended.message" ng-repeat="appended in roomEvent.appendedMessage" class=chat-message-content ng-bind-html="appended.message"></p><span>{{roomEvent.$date | date:&apos;medium&apos;}}</span> </div><div class="Client_Dp"> <img ng-src="{{AppUrl}}/images/AGD.PNG"/> </div></div></div><div ng-if="roomEvent.$type==&apos;NO_RESPONSE&apos;"> <div class="MessageSent Success_Sent"> <label><i class="fa fa-paper-plane"></i> MESSAGE SENT</label>{{roomEvent.$topic}}</div></div><div ng-if="roomEvent.bot==true && roomEvent.message.indexOf(&apos;orphaned&apos;)> -1"> <div class="MessageSent Success_Sent">{{roomEvent.message}}</div></div><div class="clear"></div></li></ul> </div></div><div class=typing-indicator ng-show="isTyping && privateRooms.list[tab.roomId].roomType==&apos;PRIVATE&apos; && privateRooms.list[tab.roomId].id==typingRoomId"> <span class="Chatterfoxglyphicon Chatterfoxglyphicon-pencil"></span>{{tab.fullName}}is typing... </div><div class="MessageArea"> <textarea class="MessageBox" ng-change="typing(privateRooms.list[tab.roomId], Message)" ng-keypress="addMessageOnEnter($event,privateRooms.list[tab.roomId],Message)" placeholder="Enter message here.." ng-model="Message" required></textarea> <button type="button" class="SendMsg_Btn" ng-disabled="userFieldForm.$invalid" ng-click="sendRoomMessage(privateRooms.list[tab.roomId], Message)"><i class="fa fa-paper-plane"></i></button> <div class="clear"></div><div class="BottomFixed Not_Fixed_Black"> <i class="fa fa-info-circle"></i> LEARN MORE ABOUT DEALER CHAT<span>DEALER CHAT POWERED BY <img ng-src="{{AppUrl}}/images/LogoBlack.PNG"></span></div><div class="clear"></div></div></div><div class="clear"></div></form> </div></uib-tab> </uib-tabset> </div></div>');
    }]);
    angular.element(document).ready(function () {
        function ucwords(str) {
            return (str + '')
                .replace(/^([a-z\u00E0-\u00FC])|\s+([a-z\u00E0-\u00FC])/g, function ($1) {
                    return $1.toUpperCase();
                });
        }
        var body = '<div ng-controller="chatWindowController" class="ChatFile chatModule Chatterfox" id="chatModule" ng-cloak> <div class="overlay" ng-show="loading"> </div> <div class="Chatterfoxspinner" ng-show="loading"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div> <toast> </toast> <div class="modalBtnList"> <ul> <li><a ng-click="signedInDialog($event)" class="Btn_Yellow BtnIcon_chat">Chat With Dealer</a></li></ul> </div><div ng-show="$root.ShowNotificationBar" class="ChatNotification" ng-draggable="dragOptions"> <span ng-show="$root.NotificationCount>0">{{$root.NotificationCount}}</span> <div class="Chat_icon"></div></div></div>';


        var myEl = angular.element(document.getElementsByName("ChatterFox")[0]);
        myEl.prepend(body);

        setTimeout(function () {
          angular.bootstrap(document, ['chatModule']);
        }, 500);

        
    });