#!/usr/bin/env node

var fs = require("fs");
var url = require("url");
var path = require("path");
var colors = require("colors");
var moment = require("moment");
var scrapyard = require("scrapyard");
var simplify = require("simplify-geometry");

var scraper = new scrapyard({
	cache: '../cache', 
	debug: false,
	timeout: 3600000,
	retries: 5,
	connections: 10
});

var FILE_RIMFIRE = path.resolve(__dirname, '../data/rimfire.json');
var FILE_REDUCED = path.resolve(__dirname, '../viewer/assets/data/rimfire.js');
var URL_RIMFIRE = "http://rmgsc.cr.usgs.gov/outgoing/GeoMAC/current_year_fire_data/KMLS/";

if (fs.existsSync(FILE_RIMFIRE)) {
	/* load data from file */
	var data = JSON.parse(fs.readFileSync(FILE_RIMFIRE));
} else {
	/* initialize new data object */
	var data = {
		"dates": [],
		"kml": [],
		"data": {}
	};
}

/* reduced data object */
var _reduced = {}

var rim = {
	datetime: function(str) {
		var _t = str.match(/([0-9]{1,2})-([0-9]{1,2})-([0-9]{4})( |%20)([0-9]{2})([0-9]{2})\.kml$/);
		return moment([
			parseInt(_t[3],10), //year
			(parseInt(_t[1],10)-1), // month
			parseInt(_t[2],10), // day
			parseInt(_t[5],10), // hour 
			parseInt(_t[6],10), // minute
			0, // second
			0 // millisecond
		]).unix();	
	},
	size: function(acres) {
		return (parseFloat(acres)*0.00404685642);
	},
	index: function(callback) {
		scraper.scrape(URL_RIMFIRE, "html", function(err, $){
			if (err) {
				console.log("[err]".inverse.red.bold, "Could not fetch index");
			} else {
				var stack = [];
				$('table a').each(function(idx,e){
					if ($(e).text().match(/^CA-STF-HV2F/)) {
						stack.push($(e).attr('href'));
					}
				});
				callback(stack);
			}
		});
	},
	scrape: function(callback) {
		rim.index(function(_stack){
			
			/* remove double urls from stack */
			_stack.filter(function(v){
				return (data.kml.indexOf(v) < 0);
			});
			
			/* check if stack is empty */
			if (_stack.length === 0) {
				callback();
				return;
			}

			var _scraped = 0;

			_stack.forEach(function(_url){

				console.log("[fetching]".cyan.inverse.bold, _url.white);
				scraper.scrape(url.resolve(URL_RIMFIRE, _url), "xml", function(err, x){

					/* increent number of scraped elements */
					_scraped++;

					/* get timestamp from url */
					var _datetime = rim.datetime(_url);

					/* data object */
					var _data = {
						description: [],
						center: [],
						polygons: [],
						size: null
					}

					/* extract data */
					x["kml"]["Document"][0]["Placemark"].forEach(function(placemark){
						
						/* extract description */
						if ("description" in placemark) {
							placemark["description"][0].split(/\r\n/g).forEach(function(line){
								_data.description.push(line.replace(/<([^>]+)>/g,'').replace(/^\s+|\s+$/g,''));
							});
							/* filter empty description items */
							_data.description = _data.description.filter(function(v){
								return (v && v !== "");
							});
						}
						
						/* extract center coordinates */
						if ("Point" in placemark) {
							var _center = placemark["Point"][0]["coordinates"][0].replace(/[\r\n\s]+/g,'').split(/,/g);
							_data.center = [_center[1], _center[0]];
						}
						
						/* extract polygon */
						if ("Polygon" in placemark) {
							placemark["Polygon"].forEach(function(polygon){
								var _polygon = []
								polygon["outerBoundaryIs"][0]["LinearRing"][0]["coordinates"][0].split(/[\r\n\s]+/g).forEach(function(_point){
									_point = _point.split(/,/g);
									if (_point[1] && _point[0]) _polygon.push([
										parseFloat(_point[1]),
										parseFloat(_point[0])
									]);
								});
								_data.polygons.push(_polygon);
							});
						}

						if ("MultiGeometry" in placemark) {
							placemark["MultiGeometry"][0]["Polygon"].forEach(function(polygon){
								var _polygon = []
								polygon["outerBoundaryIs"][0]["LinearRing"][0]["coordinates"][0].split(/[\r\n\s]+/g).forEach(function(_point){
									_point = _point.split(/,/g);
									if (_point[1] && _point[0]) _polygon.push([
										parseFloat(_point[1]),
										parseFloat(_point[0])
									]);
								});
								_data.polygons.push(_polygon);
							});
						}
						
					});
					
					if (_data.polygons.length === 0) {
						console.log(JSON.stringify(x,null,'\t'));
						process.exit();
					}
					
					/* extract further data from extracted data */
					_data.description.forEach(function(_line){
						switch (_line.split(/:\s+/g).shift()) {
							case "Acres":
								_data.size = rim.size(_line.split(/:\s+/g).pop());
							break;
						}
					});
					
					/* add data to data object */
					if (data.dates.indexOf(_datetime) < 0) data.dates.push(_datetime);
					data.data[_datetime] = _data;

					/* add data url to fetched elements */
					data.kml.push(_url);

					/* check if queue is worked off */
					if (_scraped === _stack.length) {
						
						/* sort dates */
						data.dates.sort()
						
						/* call back */
						callback();

					}

				});
					
			});
		});
	},
	/* get a rough size estimation for a polygon: the bounding box size */
	polysize: function(pg){
		var b = [pg[0][0],pg[0][0],pg[0][1],pg[0][1]];
		pg.forEach(function(p){
			if (b[0] < p[0]) b[0] = p[0];
			if (b[1] > p[0]) b[1] = p[0];
			if (b[2] < p[1]) b[2] = p[1];
			if (b[3] > p[1]) b[3] = p[1];
		});
		return ((b[0]-b[1])*(b[2]-b[3]))
	},
	reduce: function(callback){
	
		var _lastsize = 0;
		var _lasttime = 0;
		var _num = 0;
	
		/* shrink everything */
		data.dates.forEach(function(t){
			
			// console.log("time:", ((t-_lasttime)/3600), "h");
			
			_num++;
			
			var _r = {
				"center": data["data"][t]["center"],
				"size": data["data"][t]["size"],
				"polygons": []
			}

			data["data"][t]["polygons"].forEach(function(p){
				/* simplify polygon */
				_r["polygons"].push(simplify(p, 0.0001));
			});

			/* work magic to determine biggest polygon */
			_r["polygons"].sort(function(a,b){
				return rim.polysize(b) - rim.polysize(a);
			});
			
			/* check if this polygon set is same as last by comparing sum of polygons sizes */
			var _thissize = 0;
			_r["polygons"].forEach(function(p){
				_thissize += rim.polysize(p);
			});

			/* straighten out minor errors */
			_thissize = Math.round(_thissize*100000);

			if (_thissize !== _lastsize && ((((t-_lasttime)/3600) > 4) || (_num === data.dates.length))) {
				_reduced[t] = _r;
				_lastsize = _thissize;
				_lasttime = t;
			}
			
		});
		
		callback();
		
	},
	run: function(){
		rim.scrape(function(){
			rim.reduce(function(){

				/* save */
				console.log("[saving]".green.inverse.bold, FILE_RIMFIRE.white);
				fs.writeFileSync(FILE_RIMFIRE, JSON.stringify(data, null,'\t'));

				console.log("[saving]".green.inverse.bold, FILE_REDUCED.white);
				fs.writeFileSync(FILE_REDUCED, 'var _rimfire = '+JSON.stringify(_reduced)+';');

				/* the end */
				console.log("[done]".magenta.inverse.bold, "made with datalove <3".magenta.bold);
				
			});

		});
	}
};

rim.run();
