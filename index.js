var util = require('util');
var crypto = require('crypto');
var static = require('node-static');
var fileServer = new static.Server('./public');
require('konsole/overrideConsole');
console.addDefaultListener();

function getSessionId(callback) {
    var hash = crypto.createHash('sha512');
    crypto.randomBytes(512, function (err, buffer) {
        if (err) callback(err, null);
        hash.update(buffer);
        callback(null, hash.digest('base64').toString('utf8').replace(/=/g, '0'));
    });
}

function parseCookieHeader(rawCookie) {
    var cookies = {};
    if (typeof rawCookie === "string") {
        var cookieArray = rawCookie.split(';') || [];
        cookieArray.forEach(function (el) {
            var cookie = el.split('=') || [];
            if (cookie[0] && cookie[1]) {
                cookies[cookie[0].trim()] = cookie[1].trim();
            }
        });
    }
    return cookies;
}

var sessions = {

};

var httpServer = require('http').createServer(
    function (req, res) {
        var cookies = parseCookieHeader(req.headers.cookie);
        req.on('end', function () {
            if (cookies['sid'] && sessions[cookies['sid']]) {
                var session = sessions[cookies['sid']];
                console.log('session set', session);
                session.visits++;
                fileServer.serve(req, res);
            }
            else {
                getSessionId(function (err, sid) {
                    if (err) throw err;
                    res.setHeader("Set-Cookie", ['sid=' + sid + ';HttpOnly;Max-Age=' + 365 * 24 * 60 * 60]);
                    sessions[sid] = {sid:sid, visits:0};
                    fileServer.serve(req, res);
                });
            }
        });
        console.log("REQUEST\n", util.inspect(req.headers, null, 1, true));
    }).listen(3000);


var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server:httpServer});

wss.on('connection', function (ws) {
    var cookies = parseCookieHeader(ws.upgradeReq.headers.cookie);
    if (cookies['sid'] && sessions[cookies['sid']]) {
        var session = sessions[cookies['sid']];
        ws.send(JSON.stringify(session));
    }
    else {
        ws.close();
    }
    ws.on('message', function () {
        console.log("MESSAGE\n", util.inspect(arguments, null, 1, true));
    });
    ws.on('close', function () {
        console.log("CLOSE\n", util.inspect(arguments, null, 1, true));
    });
    ws.on('error', function () {
        console.log("ERROR\n", util.inspect(arguments, null, 1, true));
    });
});



