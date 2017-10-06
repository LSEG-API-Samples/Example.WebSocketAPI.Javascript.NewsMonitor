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
// Date:    October 2017.
// ********************************************************************************************************

// App
// Main Application entry point.  Perform app-specific intialization within our closure
(function() 
{
    // Main application module.  This application depends on the Angular 'ngAnimate' module.
    // As the name implies, 'ngAnimate' provides animation using CSS styles which allows visual 
    // feedback when a field is updated in realtime.
    var app = angular.module('NewsWidget',['ngAnimate']);
    
    // Configuration
    app.constant('config', {
        //wsServer: '<host:port>',        // Address of our Elektron WebSocket server.  Eg: ads:15000
        wsServer: '10.67.4.99:15000',
        wsLogin: {                      // Elektron WebSocket login credentials
            user: 'user',
            appId: '256',
            position: '127.0.0.1',
            id: 500                     // Request ID - used to easily identify login response
        },
        wsService: 'ELEKTRON_EDGE',     // Elektron WebSocket service hosting realtime market data
        wsStreamingID: 10,              // All MarketPrice streaming requests use the same ID.
        streaming: true                 // We should always be streaming, but for testing we can change
    });
    
    // ****************************************************************
    // Custom filters used when displaying data in our widget
    // ****************************************************************
    
    // substr
    // Enable the manipulation of strings using the native substr() functionality.
    app.filter('substr', function() {
        return( function(input, start, len) {
            if ( input ) return(input.substr(start,len));
        });
    });
    
    // trArr2Str
    // Walks through the array and formats the string elements, space separated.
    app.filter('trArr2Str', function() {
        return( function(ricArray) {
            if (ricArray && ricArray.length > 0) {
                var result = "";
                for (var i = 0; i < ricArray.length; i++)
                    result = result + ricArray[i] + " "; 
                
                return(result);
            }
        });
    });    

    //******************************************************************************************
    // Sharable Services
    //
    // widgetStatus - Capture the status messages generated from the Elektron WebSocket server
    //                and display as a pull-down list to see history.
    //******************************************************************************************
    app.factory('widgetStatus', function ($timeout) {
        var statusList = [];

        return ({
            list: function () { return (statusList); },
            update: function (txt) {
                console.log(txt);
                var status = statusList[0];
                if (!status || status.msg != txt) {
                    if (status)
                        statusList[0].id = 1;

                    // Force the callback to always run asynchronously - prevents error:inprog (Already in Progress) error
                    $timeout(function() {
                        statusList.unshift({ id: 0, msg: txt });
                    }, 0);
                }
            }
        });
    });

    //**********************************************************************************************
    // User-defined Directives
    //
    // animateOnChange - Directive to show change in our view.
    //**********************************************************************************************
    app.directive('animateOnChange', function ($animate)
    {
        return (function (scope, elem, attr) {
            scope.$watch(attr.animateOnChange, function(newVal,oldVal)
            {
                if (newVal != oldVal) {
                    $animate.enter(elem, elem.parent(), elem, function () {
                        $animate.leave(elem);
                    });
                }
            })
        });
    });

    // Widget Controller
    // This controller manages all interaction, behavior and display within our application.
    app.controller('widgetController', function ($scope, $rootScope, widgetStatus, config )
    {
        // Some initialization
        var self = this;
        $scope.statusList = widgetStatus.list();
        this.filter = "";
        this.selectedFilter = "";
        this.selectedStory = null;
        this.needsConfiguration = (config.wsServer === '<host:port>');
        
        // *****************************************************************
        // For simplicity, we capture all the MRN stories, in memory,  as 
        // they stream to us.  The following properties keep track of these
        // stories, depending on the current view of interest.
        // *****************************************************************
        this.allStories = [];               // In-memory news stories
        this.filteredStories = null;        // Filtered stories
        this.stories = this.allStories;     // Stories in our current view
        
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
        this.newsController.onStatus(function(eventCode, msg) {
            switch (eventCode) {                    
                case this.status.connected:
                    // TRWebSocketController first reports success then will automatically attempt to log in to the TR WebSocket server...
                    widgetStatus.update("Connection to server is UP.");
                    widgetStatus.update("Login request with user: [" + config.wsLogin.user + "]");
                    break;
                    
                case this.status.disconnected:
                    widgetStatus.update("Connection to server is Down/Unavailable");
                    break;
                    
                case this.status.loginResponse:
                    self.processLogin(msg);
                    break;
                    
                case this.status.msgStatus:
                    // Report potential issues with our requested market data item
                    self.error = (msg.Key ? msg.Key.Name+":" : "");
                    self.error += msg.State.Text;
                    widgetStatus.update("Status response for item: " + self.error);                
                    break;
                    
                case this.status.processingError:
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

            if (this.newsController.loggedIn())
                this.newsController.requestNewsStory(config.wsService);
        }; 

        
        //********************************************************************************************
        // TRWebSocketController.onNewsStory
        // Capture all news stories generated from MRN.  All stories presented here are complete and
        // decompressed.  The goal here is to capture each story for presentation.
        //********************************************************************************************        
        this.newsController.onNewsStory(function(story) {
            // Before capturing our story, search the subjects for RICs - anything that begins with "R:"
            var subjects = story.subjects.filter(subject => subject.search("R:") >= 0);
            
            // Filter out the "R:" include our list of RICs as part of this story - used for filtering
            story.rics = subjects.map(ric => ric.substr(2));
            
            // Retrieve date in a ready-made format to be used within the Angular date filter
            story.date = new Date(story.versionCreated);
            
            // Store the new story
            self.allStories.unshift(story);
            
            // Check to see if we applied a filter to the current view.  If so, check if story should be included
            if ( self.filteredStories ) {
                var found = false;
                for (var i=0; i < story.rics.length; i++)
                    if ( story.rics[i] === self.filter )  found = true;
                        
                if ( found )
                    self.filteredStories.unshift(story);
            }
            
            // Propagate all model changes into the view
            $scope.$apply();  
        });

        //*******************************************************************************
        // requestFilter
        // Based on user input from our widget UI, request that current headlines are 
        // filtered based on the user selection.
        //*******************************************************************************
        this.requestFilter = function()
        {
            if ( this.selectedFilter.trim() != this.filter ) {
                this.filter = this.selectedFilter;
                if (this.filter.trim()) {
                    this.filteredStories = this.allStories.filter(story => {                    
                        for (var i = 0; i < story.rics.length; i++)
                            if (this.filter === story.rics[i]) return true;
                        return false;                
                    });
                    this.stories = this.filteredStories;
                } else {
                    this.filteredStories = null;
                    this.stories = this.allStories;
                }                
            }
        }       
    });
})();
