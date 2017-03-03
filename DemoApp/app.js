var watson = require('watson-developer-cloud');
var express = require('express');
var app = express();
var cfenv = require("cfenv")
var appEnv = cfenv.getAppEnv()
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var cors = require('cors');
var path = require('path');

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json())
app.use(cors());

const tone_detection = require('./tone_detection.js');

require('dotenv').config({
    silent: true
});

var WORKSPACE_ID = '<workspace ID>';

if (process.env.VCAP_SERVICES) {
    services = JSON.parse(process.env.VCAP_SERVICES);
    console.log(services.tone_analyzer);
    const conversation = new watson.ConversationV1({
        username: services.conversation[0].credentials.username
        , password: services.conversation[0].credentials.password
        , version_date: '2016-09-20'
        , version: 'v1'
    });
    const tone_analyzer = new watson.ToneAnalyzerV3({
        username: services.tone_analyzer[0].credentials.username
        , password: services.tone_analyzer[0].credentials.password
        , version_date: '2016-05-19'
    });
}
else {
    console.log("No services bound");
}

app.use('/', express.static('public'))

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/public/chatui.html'));
});

function initialize() {
    var payload = {
        workspace_id: WORKSPACE_ID
        , context: {}
        , input: {
            "text": "Hi"
        }
    };
    invokeToneConversation(payload, maintainToneHistoryInContext);
}

io.on('connection', function (socket) {
    initialize()
    console.log(JSON.stringify(process.env.CONVERSATION_USERNAME));
    socket.on("chat message", function (msg) {
        var context1 = msg.context;
        var msg1 = msg.input.text;
        var payload = {
            workspace_id: WORKSPACE_ID
            , context: context1
            , input: {
                "text": msg1
            }
        };
        invokeToneConversation(payload, maintainToneHistoryInContext);
    });
});

const maintainToneHistoryInContext = false;

function invokeToneConversation(payload, maintainToneHistoryInContext) {
    tone_detection.invokeToneAsync(payload, tone_analyzer).then(tone => {
        tone_detection.updateUserTone(payload, tone, maintainToneHistoryInContext);
        conversation.message(payload, function (err, data) {
            if (err) {
                console.error(JSON.stringify(err, null, 2));
            }
            else {
                io.emit('chat', data);
            }
        });
    }).catch(function (err) {
        console.log(JSON.stringify(err, null, 2));
    });
}

http.listen(appEnv.port, appEnv.bind, function () {
    console.log("Server starting on " + appEnv.url);
})
