let express = require('express');
let app = express();
let http = require('http');
let fs = require('fs');
let request = require('request');

let sio = require('socket.io');
let _ = require('lodash');
let bodyParser = require('body-parser');
let cio = require('socket.io-client');

let props, server;

let iId = typeof process.env.NODE_APP_INSTANCE === "undefined" ? 1 : (parseInt(process.env.NODE_APP_INSTANCE) + 1);

server = http.createServer(app);
server.listen((8000 + iId), '0.0.0.0');

props = { numSockets: '1', dataFrequency: 1000 };

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	next();
});

let instanceId = iId + "-" + new Array(10).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
	.map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');

console.log("Starting WS server, listening on port "+(8000 + iId)+", ID: " + instanceId);

let eventCount = 0;
let errors = [];



let io = sio.listen(server);


/**
 * Separate NSP
 */
let backend = cio.connect('https://wssdashboard.devct.cz/backend', {reconnect: true, secure: true, rejectUnauthorized: false});

backend.on("connect", function(){
	console.log("Backend connected...")
});

backend.on('command:changeProps', function (d) {
	props = d;
	io.emit("command:changeProps", d);
	console.log(d)
});

backend.on('command:killKenny', function () {
	console.log("command:killKenny");
	io.emit("command:killKenny");
});

/**
 * Update dashboard
 */
let update = function(){
	backend.emit("update", {
		instanceId: instanceId,
		totalClients: io.engine.clientsCount,
		wsClients: _.filter(io.sockets.connected, function(socket){ return socket.conn.transport.name === "websocket"; }).length,
		errors: errors,
		eventsCount: eventCount
	})
};

/**
 * Errors XHR fallback
 */
app.post('/', function (req, res) {
	errors.unshift(req.body);
	console.log(req.body, "ERROR");
	res.send("ok");
});

/**
 * test frontend
 */
app.get('/test',function(req,res){
	res.sendFile(__dirname + '/front.html');
});



/**
 *
 * @param {object} e
 * @param socket
 */
let addEvent = function(e, socket){
	eventCount++;
};

setInterval(function(){
	update();
}, 2000);


/**
 * Bind events
 */
io.on('connection', function (socket) {

	addEvent({type: "Connect", value: ""}, socket);

	socket.on('clientEvent', function(evt){
		addEvent(evt, socket);
	});

	socket.on('disconnect', function () {
		addEvent({type: "Disconnect", value: ""}, socket);
	});

	socket.conn.on('upgrade', function(transport) {
		addEvent({type: "Switch transport", value: "websocket"}, socket);
	});

	socket.emit("command:changeProps", props);
});


