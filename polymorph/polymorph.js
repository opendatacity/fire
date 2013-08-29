#!/usr/bin/env node


/* create example polygons */

var r = function(){ return (Math.floor(Math.random()*100)/10) };

var p1 = [];
var p2 = [];
for (var i = 0; i < 3478; i++) {
	p1.push([r(),r()]);
	p2.push([r(),r()]);
	if (i%3===0||i%7===0) {
		p2.push([r(),r()]);
		p2.push([r(),r()]);
		p2.push([r(),r()]);
	}
}

/* linear interpolation */
var linterpol = function(ak,av,bk,bv,xk) {
	var xr = (bk-xk)/(bk-ak);
	return xr*av+(1-xr)*bv;
}

/* double up array elements to average out array lengths */
var resample = function(polygon, steps) {
	var resample_steps = (polygon.length/(steps-polygon.length));
	for (var i=((steps-polygon.length)-1); i>=0; i--) {
		var j = Math.floor(resample_steps*i);
		polygon.splice(j,0,polygon[j]);
	}
	return polygon;
}

var polymorph = function(p1, p2, steps, callback) {
	
	/* check for polygon sizes and resample if nessecary */
	if (p1.length < p2.length) {
		p1 = resample(p1, p2.length);
	} else if (p1.length > p2.length) {
		p2 = resample(p2, p1.length);
	}
		
	/* return first polygon */
	callback(p1, false);
	
	/* calculate interpolated polygons */
	var pi = [];
	for (var i=2; i < steps; i++) {
		pi = [];
		for (var j=0; j < p1.length; j++) {
			pi.push([
				linterpol(1, p1[j][0], steps, p2[j][0], i),
				linterpol(1, p1[j][1], steps, p2[j][1], i)
			]);
		} 
		callback(pi, false);
	}
	
	/* return final polygon */
	callback(p2, true);
	
}

polymorph(p1, p2, 3, function(p){
	console.log(p[0][0]);
});
