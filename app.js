const httpsEnabled = true;
const socketLimit = 500000;

let express = require('express');
let app = express();
let http = require('http').createServer();
let https = require('https');
let fs = require('fs');

let sio = require('socket.io');
let _ = require('lodash');
let bodyParser = require('body-parser');


let server, pk, crt, ca;

if(httpsEnabled){

	pk = fs.readFileSync('./certs/private.key').toString();
	crt = fs.readFileSync('./certs/ct.crt').toString();
	ca = fs.readFileSync('./certs/ca.crt').toString();

	server = https.createServer({key:pk, cert:crt, ca:ca }, app);
	server.listen(9443, '0.0.0.0');

	console.log("Starting secure WSS server, listening on port 9443");
}else{
	server = http.createServer(app);
	server.listen(9080, '0.0.0.0');

	console.log("Starting non-secure WS server, listening on port 9080");
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));


app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	next();
});


let io = sio.listen(server,{key:pk,cert:crt,ca:ca});

let events = [];
let eventCount = 0;
let stats = [0];
let errors = [];

let props = { numSockets: '1', dataFrequency: 1000 };


/**
 * Separate NSP
 */
let dashboard = io.of('/dashboard');

/**
 * Update dashboard
 */
let update = function(){
	dashboard.emit("update", {
		totalClients: io.engine.clientsCount,
		wsClients: _.filter(io.sockets.connected, function(socket){ return socket.conn.transport.name === "websocket"; }).length,
		activeClients: getActiveClients(),
		stats: stats,
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
 * Backend
 */
app.get('/dashboard',function(req,res){
	res.sendFile(__dirname + '/index.html');
});

/**
 * test frontend
 */
app.get('/test',function(req,res){
	res.sendFile(__dirname + '/front.html');
});

/**
 * Test
 */
setInterval(function(){
	update();
	dashboard.emit("props", props);
}, 1000);

/**
 * Snip number of clients
 */
setInterval(function(){
	stats.push(io.engine.clientsCount);
	stats.splice(10);
}, 6000);


/**
 * Filter clients, active in last 5s
 * @returns {Number}
 */
let getActiveClients = function(){
	let ids = [];
	_.each(events, function(event){
		if(ids.indexOf(event.id) > -1) return false;
		if(event.time >= (+ new Date() - 5000)){
			ids.push(event.id);
		}
	});

	return ids.length;
};

/**
 *
 * @param {object} e
 * @param socket
 */
let addEvent = function(e, socket){
	eventCount++;
	/**
	dashboard.emit("evt", {
		lastEvent: _.extend(e, {time: + new Date(), id: socket.id, ip: socket.request.connection.remoteAddress}),
		eventsCount: eventCount,
	})
	 */
};

/**
 * Bind events
 */
io.on('connection', function (socket) {

	if(io.engine.clientsCount >= socketLimit) {
		socket.disconnect();
		addEvent({type: "Disconnect", value: "MAX LIMIT"}, socket);
	}

	//addEvent({type: "Connect", value: ""}, socket);
	//update();

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


//Dashboard connection, send stats
dashboard.on('connection', function (socket) {

	socket.emit("props", props);

	update();

	socket.on('command:changeProps', function (d) {
		props = d;
		io.emit("command:changeProps", d)
		console.log(d)
	});

	socket.on('command:killKenny', function () {
		console.log("command:killKenny");
		props = { numSockets: '1', dataFrequency: 1000 };
		io.emit("command:killKenny");
	});

});


