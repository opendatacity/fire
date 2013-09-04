#!/usr/bin/env node

var fs = require("fs");
var url = require("url");
var path = require("path");
var colors = require("colors");
var moment = require("moment");
var scrapyard = require("scrapyard");

var FILE_INCIDENTS = path.resolve(__dirname, '../data/incidents.json');

var incidents = JSON.parse(fs.readFileSync(FILE_INCIDENTS));

var scraper = new scrapyard({
	cache: '../cache', 
	debug: false,
	timeout: 300000,
	retries: 5,
	connections: 10
});

var get_incidents = function(_url, callback) {
	scraper.scrape(_url, "html", function(err,$){
		if (err) {
			console.error(err);
		} else {
			$("table.data tbody tr", "#content").each(function(idx,e){
				var $e = $(e);

				var incident_href = $e.find('td[headers=incident] a').attr('href');
				callback(false, {
					"id": incident_href.replace(/^\/incident\/([0-9]+)\/$/,'$1'),
					"url": url.resolve(_url, incident_href),
					"type": $e.find('td[headers=unit]').eq(0).text(),
					"unit": $e.find('td[headers=unit]').eq(1).find("a").text(),
					"state": $e.find('td[headers=contained] span').text().toLowerCase(),
					"size": $e.find('td[headers=size]').text().replace(/[^0-9]/g,''),
					"updated": $e.find('td[headers=updated]').text(),
					"timestamp": moment().unix()
				});
			});
			/* get next page */
			var next_link = $("div.tab_nav a", "#content").last();
			if (next_link.text().match(/^next/)) {
				get_incidents(url.resolve(_url, next_link.attr('href')), callback);
			} else {
				callback(true);
			}
	    }
	});
};

var save_incidents = function() {
	fs.writeFileSync(FILE_INCIDENTS, JSON.stringify(incidents, null, '\t'));
}

var build_incidents = function(callback) {
	get_incidents("http://inciweb.nwcg.gov/", function(done, data){
		
		if (!done) {

			/* parse ago */
			var match_minutes = data.updated.match(/^\s*([0-9]+) min. ago$/);
			var match_hour = data.updated.match(/^\s*([0-9]+):([0-9]+) hrs. ago$/);
			var match_hours = data.updated.match(/^\s*([0-9]+) hrs. ago$/);
			var match_day = data.updated.match(/^\s*([0-9]+) day(s)? ago$/);
			
			var updated_old = data.updated;

			if (match_minutes) {
				data.updated = moment().subtract("minutes", parseInt(match_minutes[1],10)).unix();
			} else if (match_hour) {
				data.updated = moment().subtract("minutes", (parseInt(match_hour[1],10)*60)+parseInt(match_hour[2],10)).unix();
			} else if (match_hours) {
				data.updated = moment().subtract("minutes", (parseInt(match_hours[1],10)*60)).unix();
			} else if (match_day) {
				data.updated = moment().subtract("minutes", (parseInt(match_day[1],10)*60*24)).unix();
			} else {
				data.updated = moment(data.updated, "MM-DD-YYYY").unix();
			}

			if (data.updated < 0) console.log("[ERR]".inverse.red.bold, "time parse:".red, updated_old, "=>".cyan, data.updated);

			if (!(data.id in incidents)) {
				/* new incident */
				data.checkme = true;
				incidents[data.id] = data;
				
			} else {

				/* known incident, check for update */
				if ((incidents[data.id].state !== data.state) || (incidents[data.id].size !== data.size) || (incidents[data.id].timestamp <= data.updated)) {

					if (incidents[data.id].state !== data.state) console.log("["+data.id+"]", "state change");
					if (incidents[data.id].size !== data.size) console.log("["+data.id+"]", "size change");
					if (incidents[data.id].timestamp <= data.updated) console.log("["+data.id+"]", "timestamp", incidents[data.id].timestamp, data.updated);

					/* something has changed, update */
					incidents[data.id].state = data.state;
					incidents[data.id].size = data.size;
					incidents[data.id].upated = data.updated;
					incidents[data.id].timestamp = data.timestamp;
					incidents[data.id].checkme = true;
				}

			}

		} else {
						
			/* done, save incidents and call back */
			save_incidents();
			callback();

		}
		
	});
};

var update_incident = function(id, callback) {
	
	if (!("history" in incidents[id])) 
	
	scraper.scrape(incidents[id].url, "html", function(err,$){
		if (err) {

			callback(id);

		} else {
			/* get feed links */
			$("ul.feed-list li.feed-ge a", "#rightnav").each(function(idx,e){
				
				if ($(e).attr("href").match(/rmgsc\.cr\.usgs\.gov/)) {
					
					/* get kml url */
					var kml_url = $(e).attr("href");
					console.log("[kml]".cyan.inverse.bold, $(e).attr("href"));
					
					/* calculate timestamp from url */
					var kml_t = kml_url.match(/([0-9]{1,2})-([0-9]{1,2})-([0-9]{4}) ([0-9]{2})([0-9]{2})\.kml$/);
					var kml_timestamp = moment([
						parseInt(kml_t[3],10), //year
						parseInt(kml_t[1],10), // month
						parseInt(kml_t[2],10), // day
						parseInt(kml_t[4],10), // hour 
						parseInt(kml_t[5],10), // minute
						0, // second
						0 // millisecond
					]).unix();
					
					if (kml_timestamp < 0) {
						console.log(kml_t);
						process.exit();
					}
					
					if (!(kml_timestamp in incidents[id].history)) {
					
						incidents[id].history[kml_timestamp] = [];
					
						scraper.scrape(kml_url, "xml", function(err, xml){
										
							incidents[id].history[kml_timestamp] = {
								"polygons": [],
								"coordinates": null,
								"description": ""
							}
												
							xml.kml.Document[0].Placemark.forEach(function(pm){
								if ("MultiGeometry" in pm) {
									pm.MultiGeometry[0].Polygon.forEach(function(pg){
										var poly = [];
										pg.outerBoundaryIs[0].LinearRing[0].coordinates[0].split(/\s+/).forEach(function(pp){
											if (pp !== "") {
												pp = pp.split(/,/g);
												poly.push([pp[0],pp[1]]);
											}
										});
										incidents[id].history[kml_timestamp].polygons.push(poly);
									});
								}
								if ("description" in pm) {
									/* description */
									incidents[id].history[kml_timestamp].description = pm.description[0];
								}
								if ("Point" in pm) {
									/* point */
									var coo = pm.Point[0].coordinates[0].split(/,/g);
									incidents[id].history[kml_timestamp].coordinates = [coo[0],coo[1]];
								}
							});

							if (Object.keys(incidents[id].history).length === 0) {
								console.log("[PARSE ERR].red.bold.inverse", id, kml_timestamp, kml_url);
							}

							callback(id);
						
						});
						
					} else {
						callback(id);
					}
					
				} else {
					callback(id);
				}
			});
		}
	});
};

var update = function(callback) {
	build_incidents(function(){
		var incidents_count = 0;
		var incidents_checked = 0;
		for (id in incidents) {
			if (incidents[id].checkme === true) {
				incidents_count++;
				console.log("[chck]".inverse.cyan.bold, "check:", id);
				update_incident(id, function(id){
					incidents[id].checkme = false;
					incidents_checked++;
					if (incidents_checked % 20 === 0) save_incidents();
					if (incidents_checked === incidents_count) {
						save_incidents();
						callback();
					}
				});
			}
		}
	});
};

update(function(){
	console.log("done.");
})
