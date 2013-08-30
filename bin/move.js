#!/usr/bin/env node

var fs = require("fs");
var path = require("path");
var optimist = require("optimist");

var argv = optimist.argv;

var to_center = [-119.95388, 37.913055];

var FILE_IN = path.resolve(argv._[0]);
var FILE_OUT = path.resolve(argv._[1]);

var geojson = JSON.parse(fs.readFileSync(FILE_IN));

var get_center = function(pg){
	var b = [pg[0][0],pg[0][0],pg[0][1],pg[0][1]];
	pg.forEach(function(p){
		if (b[0] < p[0]) b[0] = p[0];
		if (b[1] > p[0]) b[1] = p[0];
		if (b[2] < p[1]) b[2] = p[1];
		if (b[3] > p[1]) b[3] = p[1];
	});
	return [((b[0]+b[1])/2),((b[2]+b[3])/2)];
};

var from_center = null;

var move_shape = function(coords) {
	var shift = [(from_center[0]-to_center[0]),(from_center[1]-to_center[1])];
	coords.forEach(function(v,k){
		coords[k] = [(v[0]-shift[0]),(v[1]-shift[1])]
	});
	return coords;
}

switch (geojson["features"][0]["geometry"]["type"]) {
	case "Polygon":
		var from_center = get_center(geojson["features"][0]["geometry"]["coordinates"][0]);
		geojson["features"][0]["geometry"]["coordinates"][0] = move_shape(geojson["features"][0]["geometry"]["coordinates"][0]);
	break;
	case "MultiPolygon":
		var centers = [];
		geojson["features"][0]["geometry"]["coordinates"].forEach(function(v){
			centers.push(get_center(v[0]));
		});
		var from_center = get_center(centers);
				
		geojson["features"][0]["geometry"]["coordinates"].forEach(function(v,k){
			geojson["features"][0]["geometry"]["coordinates"][k][0] = move_shape(v[0])
		});
	break;
}

fs.writeFileSync(FILE_OUT, JSON.stringify(geojson,null,'\t'));
