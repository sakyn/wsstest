
/**
 * Model
 * @constructor
 */
DataModel = function () {

	let self = this;

	//Connections
	self.conn_server = ko.observable(false);
	self.working = ko.observable(false);
	self.last_change = ko.observable(moment().format("H:mm:ss")); // (time) Timestamp posledních dat

	self.totalClients = ko.observable(0);
	self.wsClients = ko.observable(0);
	self.activeClients = ko.observable(0);
	self.eventsCount = ko.observable(0);


	self.lastEvents = ko.observableArray([]);
	self.errors = ko.observableArray([]);
	self.stats = ko.observableArray([]);

	self.clientConnections = ko.observable(1);
	self.messageFreq = ko.observable(1000);

	/**
	 *  % max allowed clients
	 */
	self.percentLimit = ko.computed(function(){
		return ((self.totalClients()/500000) * 100).toFixed(2)
	});

	/**
	 * Stats mean
	 */
	self.statsMean = ko.computed(function(){

		let total = 0, i;
		for (i = 0; i < self.stats().length; i += 1) {
			total += self.stats()[i];
		}
		return Math.floor(total / self.stats().length);
	});

	/**
	 * Css class by clients
	 */
	self.statsCss = ko.computed(function(){
		if(self.statsMean() === self.totalClients()) return ["m-blue change metric-small", ""] ;

		return self.statsMean() > self.totalClients() ? ["m-red change metric-small", "arrow-down"] : ["m-green change metric-small", "arrow-up"];
	});

	self.changeProps = function(){
		socket.emit("command:changeProps", {numSockets: self.clientConnections(), dataFrequency: self.messageFreq()});
	};

	self.killKenny = function () {
		socket.emit("command:killKenny")
	};

	self.formAttr = ko.observable(location.hash == "#sakynek5" ? {}:{disabled: "disabled"});
};

/**
 * Activity icon...
 */
sWorking = function () {
	DashboardModel.working(true);
	setTimeout(function () {
		DashboardModel.working(false);
		DashboardModel.last_change(moment().format("H:mm:ss"));
	}, 200)
};

/**
 *
 */
socket = io("https://wss.ceskatelevize.cz/dashboard");


/**
 *
 */
if (typeof DashboardModel !== "function") DashboardModel = new DataModel();

/**
 *
 */
setTimeout(function () {
	ko.applyBindings(DashboardModel);
	sWorking();
}, 100);


/**
 *
 */
socket.on("connect", function () {
	sWorking();
	DashboardModel.conn_server(true);
	gaugeUpdate("cf-gauge-1", {'minVal':0,'maxVal':100,'newVal':0});

	socket.on("evt", function (e) {
		sWorking();
		DashboardModel.lastEvents.unshift(e.lastEvent);

		DashboardModel.lastEvents.splice(10);
	});

	socket.on("props", function (e) {
		sWorking();
		DashboardModel.clientConnections(e.numSockets);
		DashboardModel.messageFreq(e.dataFrequency);
	});

	socket.on("update", function (e) {
		sWorking();
		DashboardModel.totalClients(e.totalClients);
		DashboardModel.wsClients(e.wsClients);
		DashboardModel.activeClients(e.activeClients);
		DashboardModel.eventsCount(e.eventsCount);
		DashboardModel.stats(e.stats);
		DashboardModel.errors(e.errors);
		document.title = "(" + e.totalClients + ") WSS Dashboard";

		cf_rSVPs["svp-1"].chart.update(DashboardModel.percentLimit());
		cf_rRags["cf-rag-1"].update([0, (DashboardModel.totalClients() - DashboardModel.wsClients()), DashboardModel.wsClients()]);
		createSparkline($('.sparkline'), DashboardModel.stats(), DashboardModel.statsMean());
		gaugeUpdate("cf-gauge-1", {'minVal':0,'maxVal':DashboardModel.totalClients(), 'newVal':DashboardModel.activeClients()});

		$(".cf-figs .m-red p").text(DashboardModel.errors().length);
	});

	socket.on('disconnect', function () {
		sWorking();
		DashboardModel.conn_server(false);
	});

});


