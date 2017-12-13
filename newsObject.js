// ********************************************************************************************************
// NewsWidget.js
// The NewsWidget module is an Angular JS-based client utilizing Thomson Reuters Elektron WebSocket API to
// request and retrieve realtime Machine Readable News (MRN) stories.  The widget provides a interface that
// displays the real-time headlines as they arrive offering the ability to display any associated news story
// if available.  In addition, the interface also filters out those headlines specific to a specific set of
// codes (RICs) associated with the story.
//
// Author:  Nick Zincone
// Version: 1.0
// Date:    November 2017.
// ********************************************************************************************************

// App
// Main Application entry point.  Perform app-specific intialization within our closure
(function()
{
    // Main application module.  This application depends on the Angular 'ngAnimate' module.
    // As the name implies, 'ngAnimate' provides animation using CSS styles which allows visual
    // feedback when the status of the service is updated.
    var app = angular.module('NewsWidget',['ngAnimate']);

    // Configuration
    app.constant('config', {
        //wsServer: '<host:port>',        // Address of our Elektron WebSocket server.  Eg: ads:15000
        wsServer:'ewa:15000',
        wsLogin: {                      // Elektron WebSocket login credentials
            user: 'user',
            appId: '256',
            position: '127.0.0.1'
        },
        //wsService: 'ELEKTRON_EDGE',     // Elektron WebSocket service hosting realtime market data
    });

    // ****************************************************************
    // Custom filters used when displaying data in our widget
    // ****************************************************************

    // ricList
    // Extract the RICs from the subject array and format as a simple list of rics, space separated.
    app.filter('ricList', function() {
        return( function(rics) {
            // Filter out the "R:" portion for each entry
            var result = rics.map(ric => ric.substr(2));

            if (result.length > 0) {
                var list = "";
                for (var i = 0; i < result.length; i++)
                    list = list + result[i] + " ";

                return(list);
            }
            return("");
        });
    });

    //******************************************************************************************
    // Sharable Services
    //
    // widgetStatus - Capture the status messages generated from the Elektron WebSocket server
    //                and display as a pull-down list to see history.
    //******************************************************************************************
    app.factory('widgetStatus', $timeout => {
        let statusList = [];

        return ({
            list: function () { return (statusList); },
            update: function (txt) {
                console.log(txt);
                let status = statusList[0];
                if (!status || status.msg != txt) {
                    if (status)
                        statusList[0].id = 1;

                    // Force the callback to always run asynchronously - prevents error:inprog (Already in Progress) error
                    $timeout(() => {statusList.unshift({ id: 0, msg: txt })}, 0);
                }
            }
        });
    });

    //**********************************************************************************************
    // User-defined Directives
    //
    // animateOnChange - Directive to show change in our view.
    //**********************************************************************************************
    app.directive('animateOnChange', $animate => {
        return ((scope, elem, attr) => {
            scope.$watch(attr.animateOnChange, (newVal, oldVal) => {
                if (newVal != oldVal) {
                    $animate.enter(elem, elem.parent(), elem, () => $animate.leave(elem));
                }
            })
        });
    });

    // Widget Controller
    // This controller manages all interaction, behavior and display within our application.
    app.controller('widgetController', function ($scope, $rootScope, widgetStatus, config )
    {
        // Some initialization
        $scope.statusList = widgetStatus.list();
        this.filter = "";
        this.selectedFilter = "";
        this.selectedStory = null;
        this.needsConfiguration = (config.wsServer === '<host:port>');

        // *****************************************************************
        // For simplicity, we capture all the MRN stories, in memory,  as
        // they stream to us.
        // *****************************************************************
        this.stories = [];               // Our data model.  Collection of ews stories.

        // Our Elektron WebSocket interface
        this.newsController = new TRWebSocketController();

        // Connect into our realtime server
        if ( !this.needsConfiguration ) {
            widgetStatus.update("Connecting to the WebSocket service on [host:port] " + config.wsServer + "...");
            this.newsController.connect(config.wsServer, config.wsLogin.user, config.wsLogin.appId, config.wsLogin.position);
        }

        this.selectStory = function(story) {
            this.selectedStory = story;
        }

        this.selectedStoryText = function() {
            if (this.selectedStory != null && this.selectedStory.body.length > 0 )
                return(this.selectedStory.body)

            return("No story available");
        }

        //*******************************************************************************
        // TRQuoteController.onStatus
        //
        // Capture all TRQuoteController status messages.
        //*******************************************************************************
        this.newsController.onStatus( (eventCode, msg) => {
            let status = this.newsController.status;

            switch (eventCode) {
                case status.connected:
                    // TRWebSocketController first reports success then will automatically attempt to log in to the TR WebSocket server...
                    widgetStatus.update("Connection to server is UP.");
                    widgetStatus.update("Login request with user: [" + config.wsLogin.user + "]");
                    break;

                case status.disconnected:
                    widgetStatus.update("Connection to server is Down/Unavailable");
                    break;

                case status.loginResponse:
                    this.processLogin(msg);
                    break;

                case status.msgStatus:
                    // Report potential issues with our requested market data item
                    this.error = (msg.Key ? msg.Key.Name+":" : "");
                    this.error += msg.State.Text;
                    widgetStatus.update("Status response for item: " + this.error);
                    break;

                case status.msgError:
                    // Report invalid usage errors
                    widgetStatus.update(`Invalid usage: ${msg.Text}. ${msg.Debug.Message}`);
                    break;

                case status.processingError:
                    // Report any general controller issues
                    widgetStatus.update(msg);
                    break;
            }
        });

        //*********************************************************************************
        // processLogin
        // Determine if we have successfully logged into our WebSocket server.  Within
        // our Login response, we need to check the following stanza:
        //
        // "State": {
        //     "Stream": <stream state>,    "Open" | "Closed"
        //     "Data": <data state>,        "Ok" | "Suspect"
        //     "Text": <reason>
        //  }
        //
        // If we logged in, open the news stream.
        //*********************************************************************************
        this.processLogin = function (msg) {
            widgetStatus.update("Login state: " + msg.State.Stream + "/" + msg.State.Data + "/" + msg.State.Text);

            if (this.newsController.loggedIn()) {
                widgetStatus.update("Requesting news headlines and stories...");
                this.newsController.requestNews("MRN_STORY", config.wsService);
            }
        };

        //********************************************************************************************
        // TRWebSocketController.onNews
        // Capture all news stories generated from MRN.  All stories presented here are complete and
        // decompressed.  We simply store each story within our data model.
        //********************************************************************************************
        this.newsController.onNews( (ric, story) => {
            $scope.$apply( () => {
                // Store the new story
                this.stories.unshift(story);

                // Simple trim to keep the stories in memory manageable
                if ( this.stories.length > 1000 )
                    this.stories.pop();
            });
        });
    });
})();
