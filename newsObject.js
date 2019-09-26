// ********************************************************************************************************
// NewsWidget.js
// The NewsWidget module is an Angular JS-based client application utilizing streaming services provided 
// by Elektron RealTime (ERT) to request and retrieve Machine Readable News (MRN) headlines and stories.  
// The interface provides the ability to connect to the streaming services via the TREP (ADS) local 
// installation or via the ERT (Elektron Real Time) in the Cloud.   
//
// The widget provides a interface that displays the real-time headlines as they arrive offering the 
// ability to display any associated news story if available.  In addition, the interface also filters out 
// those headlines specific to a specific set of codes (RICs) associated with the story.
//
// Note: When requesting for streaming services from EDP/ERT, applications must be authenticated using 
//       the HTTP EDP authentication services prior to connecting into the ERT services over WebSockets. 
//       To adhere to the "Same Origin" security policies, a simple server-side application (provided) 
//       will act as an application proxy managing EDP authentication.  Refer to the instructions for setup.       
//
// Authors: Nick Zincone
// Version: 2.0
// Date:    October 2018.
// ********************************************************************************************************

// App
// Main Application entry point.  Perform app-specific intialization within our closure
(function()
{ 
    // Main application module.  This application depends on the Angular 'ngAnimate' module.
    // As the name implies, 'ngAnimate' provides animation using CSS styles which allows visual
    // feedback when the status of the service is updated.
    var app = angular.module('NewsWidget',['ngAnimate']);
    

    // Application session configuration
    // Define the session (TREP, EDP/ERT) you wish to use to access streaming services.  To define your session,
    // update the following setting:
    //      session: undefined
    //
    // Eg:  session: 'EDP'     // EDP/ERT Session
    //      session: 'ADS'     // TREP/ADS Session
    app.constant('config', {
        session: 'EDP',         // 'ADS' or 'EDP'.
        
        // TREP (ADS) session.
        // This section defines the connection and authentication requirements to connect directly into the 
        // streaming services from your locally installed TREP installation.
        // Load this example directly within your browswer.
        adsSession: {
            wsServer: 'ewa',               // Address of our ADS Elektron WebSocket server.  Eg: 'elektron'
            wsPort: '15000',               // Address port of our ADS Elektron Websccket server. Eg: 15000
            wsLogin: {                     // Elektron WebSocket login credentials
                user: 'user',              // User name.  Optional.  Default: desktop login.
                appId: '256',              // AppID. Optional.  Default: '256'
                position: '127.0.0.1'      // Position.  Optional. Default: '127.0.0.1'
            }          
        },
        
        // ERT (Elektron Real Time) in Cloud session.
        // This section defines authenticastion to access EDP (Elektron Data Platform)/ERT.
        // Start the local HTTP server (provided) and within your browser, specify the URL: http://localhost:8080/quoteObject.html
        edpSession: {
            wsLogin: {
                user: '',
                password: '',
                clientId: undefined
            },
            restAuthHostName: 'https://api.edp.thomsonreuters.com/auth/oauth2/beta1/token',
            restServiceDiscovery: 'https://api.edp.thomsonreuters.com/streaming/pricing/v1/',
            wsLocation: 'us-east-1a',
            wstransport: 'websocket',
            wsdataformat: 'tr_json2'
        },
        //wsService: 'ELEKTRON_EDGE'        // Optional. Elektron WebSocket service hosting realtime market data
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
            update: function (txt,msg) {
                (msg != null ? console.log(txt,msg) : console.log(txt));
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


        //***********************************
        // Translation code 
        // added by James Sullivan 2019/09/19
        //***********************************
         
        // Enter an API key from the Google API Console:
        //   https://console.developers.google.com/apis/credentials
        const apiKey = "";

        var storyTranslationObj = {
            sourceLang: 'en',
            targetLang: 'ja',
            textToTranslate: 'This is a news story.',
            format: "text"
        };

        var headlineTranslationObj = {
            sourceLang: 'en',
            targetLang: 'ja',
            textToTranslate: 'This is a news headline.',
            format: "text"
        };

        function translationURL(data) {
            var url = "https://www.googleapis.com/language/translate/v2/" +
            "?key=" + apiKey +
            "&q=" + encodeURI(data.textToTranslate) +
            "&target=" + data.targetLang +
            "&source=" + data.sourceLang +
            "&format=" + data.format;
            return url
        }
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
        this.selectedLanguage = ""
        this.needsConfiguration = (config.session === undefined);

        // *****************************************************************
        // For simplicity, we capture all the MRN stories, in memory,  as
        // they stream to us.
        // *****************************************************************
        this.stories = [];               // Our data model.  Collection of ews stories.

        // Define the WebSocket interface to manage our streaming services
        this.ertController = new ERTWebSocketController();
        
        // EDP Authentication
        // Only applicable if a user chooses an ERT Session.
        this.edpController = new ERTRESTController();
       
        // Initialize our session
        switch (config.session) {
            case 'ADS':
                widgetStatus.update("Connecting to the WebSocket streaming service on ["+ config.adsSession.wsServer + ":" + config.adsSession.wsPort + "]");
                this.ertController.connectADS(config.adsSession.wsServer, config.adsSession.wsPort, config.adsSession.wsLogin.user, 
                                                config.adsSession.wsLogin.appId, config.adsSession.wsLogin.position);
                break;
            case 'EDP':
                widgetStatus.update("Authenticating with EDP using " + config.edpSession.restAuthHostName + "...");
                this.edpController.get_access_token({
                    'username': config.edpSession.wsLogin.user,
                    'password': config.edpSession.wsLogin.password,
                    'clientId': config.edpSession.wsLogin.clientId
                });            
                break;
        }

        this.selectStory = function(story) {
            if(story != null && story.body.length > 0 && 
                !(this.selectedLanguage == '' || apiKey == '' || story.language == this.selectedLanguage)){
                storyTranslationObj.textToTranslate = story.body.replace('\r\n', '<br>');
                storyTranslationObj.targetLang = this.selectedLanguage;
                storyTranslationObj.sourceLang = story.language;   
                this.makeStoryTranslationRequest(storyTranslationObj, story)
            }
            this.selectedStory = story;
        }

        this.makeStoryTranslationRequest = function(data, mySelectedStory) {
            var obj = {key: apiKey, source: data.sourceLang, target: data.targetLang, q: data.textToTranslate.replace(/\n/gm, '(yyyyyy)'), format: data.format}
            let json = JSON.stringify(obj);
            var s = new XMLHttpRequest(); 
            s.open("POST", "https://www.googleapis.com/language/translate/v2?key=" + apiKey, true);
            //Send the proper header information along with the request
            s.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            s.setRequestHeader("Accept", "application/json");
            s.onloadend = function() {
                if (s.status == 200) {
                  var translation = JSON.parse(s.responseText).data.translations[0].translatedText;
                  // Google translate destroys line breaks so ugly hacks are necessary
                  mySelectedStory.translatedBody = translation.replace(/[(（]yyyyyy[)）]/gm, '\r\n').replace(/<br>/gm, '\r\n');
                } else {
                  console.log("story translation error " + this.status);
                }
              }
            s.send(json);
        }

        this.selectedStoryText = function() {
            var translation = ''
            if(this.selectedStory != null && this.selectedStory.body.length > 0 && 
                (this.selectedLanguage == '' || apiKey == '' || this.selectedStory.language == this.selectedLanguage)){
                return(this.selectedStory.body)
            } else if (this.selectedStory != null && this.selectedStory.body.length > 0 && this.selectedStory.hasOwnProperty('translatedBody')) {
                return(this.selectedStory.translatedBody)
            } else {
                return("No story available");
            } 
            
        }
        
        //***********************************************************************************
        // ERTRESTController.onStatus
        //
        // Capture all ERTRESTController status messages.
        // EDP/ERT uses OAuth 2.0 authentication and requires clients to use access tokens to 
        // retrieve streaming content.  In addition, EDP/ERT requires clients to continuously 
        // refresh the access token to continue uninterrupted service.  
        //
        // The following callback will capture the events related to retrieving and 
        // continuously updating the tokens in order to provide the streaming interface these
        // details to maintain uninterrupted service. 
        //***********************************************************************************
        this.edpController.onStatus((eventCode, msg) => {
            let status = this.edpController.status;

            switch (eventCode) {
                case status.getRefreshToken: // Get Access token form EDP (re-refresh Token case)
                    this.auth_obj = msg;
                    widgetStatus.update("EDP Authentication Refresh success.  Refreshing ERT stream...");                    
                    this.ertController.refreshERT(msg);
                    break;
                case status.getService: // Get Service Discovery information form EDP
                    // Connect into ERT in Cloud Elektron WebSocket server
                    this.ertController.connectERT(msg.hostList, msg.portList, msg.access_token, config.edpSession.appId, config.edpSession.position);
                    break;
                case status.authenError: // Get Authentication fail error form EDP
                    widgetStatus.update("Elektron Real Time in Cloud authentication failed.  See console.", msg);                    
                    break;
                case status.getServiceError: // Get Service Discovery fail error form EDP
                    widgetStatus.update("Elektron Real Time in Cloud Service Discovery failed.  See console.", msg);
                    break;
            }
        });         

        //*******************************************************************************
        // ERTWebSocketController.onStatus
        //
        // Capture all ERTWebSocketController status messages.
        //*******************************************************************************
        this.ertController.onStatus( (eventCode, msg) => {
            let status = this.ertController.status;

            switch (eventCode) {
                case status.connected:
                    // ERTWebSocketController first reports success then will automatically 
                    // attempt to log in to the ERT WebSocket server...
                    console.log(`Successfully connected into the ERT WebSocket server: ${msg.server}:${msg.port}`);
                    break;

                case status.disconnected:
                    widgetStatus.update(`Connection to ERT streaming server: ${msg.server}:${msg.port} is down/unavailable`);
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
                    
                case status.tokenExpire:
                    widgetStatus.update("Elektron Data Platform Authentication Expired");
                    break;

                case status.refreshSuccess:
                    widgetStatus.update("Elektron Data Platform Authentication Refresh success")
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

            if (this.ertController.loggedIn()) {
                widgetStatus.update("Requesting news headlines and stories...");
                this.ertController.requestNews("MRN_STORY", config.wsService);
            }
        };



        
        
        
        //********************************************************************************************
        // TRWebSocketController.onNews
        // Capture all news stories generated from MRN.  All stories presented here are complete and
        // decompressed.  We simply store each story within our data model.
        //********************************************************************************************
        this.ertController.onNews( (ric, story) => {
            $scope.$apply( () => {

            // Abstract API request function
            function makeHeadlineTranslationRequest(data, storiesPointer) {
                var url = translationURL(data)
                var r = new XMLHttpRequest(); 
                r.open("GET", url, true);
                //Send the proper header information along with the request
                r.setRequestHeader("Content-Type", "application/json");
                r.setRequestHeader("Accept", "application/json");

                r.onreadystatechange = function () {
                if (r.readyState != 4 || r.status != 200) return; 
                    var translation = JSON.parse(r.responseText).data.translations[0].translatedText;
                    story.translatedHeadline = translation;
                    storiesPointer.unshift(story);
                };
                return r.send();
            }

            // Store the new story
            if(story.headline.length > 0) {
                if(this.selectedLanguage == '' || apiKey == '' || story.language == this.selectedLanguage) {
                    // 'no need to translate'
                    story.translatedHeadline = story.headline;
                    this.stories.unshift(story);
                } else {
                    // 'translating from ' + story.language + ' to ' + this.selectedLanguage
                    headlineTranslationObj.textToTranslate = story.headline;
                    headlineTranslationObj.targetLang = this.selectedLanguage;
                    headlineTranslationObj.sourceLang = story.language;    
                    makeHeadlineTranslationRequest(headlineTranslationObj, this.stories);
                }
            }

            // Simple trim to keep the stories in memory manageable
            if ( this.stories.length > 1000 )
                this.stories.pop();
            });
        });
    });
})();


