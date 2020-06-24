const express = require('express');
let path = require('path');
var bodyParser = require('body-parser');
var rp = require('request-promise');
const web_path = path.join(__dirname, './');

const app = express();
const port = 8080;

// RDP constant variables
const auth_hostname = 'https://api.refinitiv.com';
const RDP_version = '/v1';
const auth_category_URL = '/auth/oauth2';
const auth_endpoint_URL = '/token';
const client_secret = '';
const streaming_category_URL = '/streaming/pricing';
const streaming_category_version = '/v1/';

var hostname_service_endpoint = auth_hostname + streaming_category_URL + streaming_category_version;
var rdp_gateway_token_url = auth_hostname + auth_category_URL + RDP_version + auth_endpoint_URL;

app.use(express.static(web_path));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({
    extended: true
})); // for parsing application/x-www-form-urlencoded

app.get("/quoteObject.html", function (req, res) {
    res.sendFile(path.join(web_path, "quoteObject.html"));
});

app.get("/quoteObjectERT.html", function (req, res) {
    res.sendFile(path.join(web_path, "quoteObjectERT.html"));
});

//[Modify By Wasin W.]
//
// "/requesttoken" HTTP Post
// handle "/requesttoken" HTTP Post from ERTRESTController.js. The function redirects posted data to RDP Authentication server via get_Access_Token() function
//
//
app.post('/token', function (req, res) {
    get_Access_Token(req.body, res);
})

//[Modify By Wasin W.]
//
// "/ERT_discovery" HTTP Get
// handle "/ERT_discovery" HTTP Get from ERTRESTController.js. The function redirects getted data to RDP Service Discovery via get_service_discovery() function
//
//
app.post('/streaming/pricing', function (req, res) {
    get_service_discovery(req.body, res);
})


//[Modify By Wasin W.]
//
// get_Access_Token(data, response)
// Send HTTP Post request to RDP Authentication gateway, pass HTTP response data back to ERTRESTController.js.
//
//
function get_Access_Token(data, res) {
    let authen_options = {
        method: 'POST',
        uri: rdp_gateway_token_url,
        form: data,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic'
        },
        json: true,
        resolveWithFullResponse: true,
        auth: {
            username: data.client_id,
            password: ''
        },
        simple: true,
        transform2xxOnly: true
    };

    return rp(authen_options)
        .then(function (response) {
            //console.log('response.statusCode =' + response.statusCode);
            //console.log(`response = ${JSON.stringify(response)}`);
            if (response.statusCode == 200) {
                console.log('RDP-GW Authentication succeeded. RECEIVED:')
                res.send(response.body);
            }
        })
        .catch(function (error) {
            console.log(`RDP-GW authentication result failure: ${error} statusCode =${error.statusCode}`);
            //res.send(error);
            res.status(error.statusCode).send(error);
        });
}

//[Modify By Wasin W.]
//
// get_service_discovery(data, response)
// Send HTTP Post request to RDP Service Discovery gateway, pass HTTP response data back to ERTRESTController.js.
//
//
function get_service_discovery(payload, res) {
    let ERT_service_options = {
        method: 'GET',
        uri: hostname_service_endpoint,
        qs: {
            transport: payload.transport,
            dataformat: payload.dataformat
        },
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + payload.access_token
        },
        json: true,
        resolveWithFullResponse: true
    };

    return rp(ERT_service_options)
        .then(function (response) {
            if (response.statusCode == 200) {
                console.log('ERT in Cloud RealTime Service Discovery succeeded. RECEIVED:')
                res.send(response.body);
            }
        }).catch(function (error) {
            console.error(`ERT in Cloud RealTime Service Discovery result failure: ${error} state = ${error.readyState}`);
            //res.send(error);
            res.status(error.statusCode).send(error);
        });

};


app.listen(port, () => console.log(`Application is running at port ${port}`));