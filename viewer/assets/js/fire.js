$(document).ready(function(){
	
	var map = new L.Map('map');

	var tiles = new L.TileLayer('http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg', {
		attribution: 'hello',
		maxZoom: 18
	});
	
	map.setView(new L.LatLng(37.9, -119.9), 11).addLayer(tiles);
	
	var keys = [];
	var polys = {};
	for (k in example_data) {
		keys.push(k);
		polys[k] = [];
		$(example_data[k]).each(function(idx,ll){
			polys[k].push(new L.LatLng(ll[1],ll[0]));
		});
	}
	keys = keys.sort();
	
	var viewpoly = new L.Polygon(polys[keys[0]], {
		stroke: true,
		color: '#f00',
		opacity: 0.6,
		weight: 3,
		fill: true,
		fillColor: '#f00'
	});

	map.addLayer(viewpoly);
	
	var callback = function (pp) {
		var ll = [];
		$(pp).each(function(idx,p){
			ll.push(new L.LatLng(p[1],p[0]));
		});
		viewpoly.setLatLngs(ll);
		viewpoly.redraw();
	}

	var toDos = [];

	polymorph.run(example_data[keys[0]], example_data[keys[1]], 100, 10000, callback);

	setTimeout(function() {
		polymorph.run(example_data[keys[1]], example_data[keys[2]], 100, 10000, callback);
	}, 10000)

	setTimeout(function() {
		polymorph.run(example_data[keys[2]], example_data[keys[3]], 100, 10000, callback);
	}, 20000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[2]], example_data[keys[3]], 100, 10000, callback);
	}, 30000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[3]], example_data[keys[4]], 100, 10000, callback);
	}, 40000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[4]], example_data[keys[5]], 100, 10000, callback);
	}, 50000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[5]], example_data[keys[6]], 100, 10000, callback);
	}, 60000)

});

var polymorph = {
	/* linear interpolation */
	linterpol: function(ak,av,bk,bv,xk) {
		var xr = (bk-xk)/(bk-ak);
		return xr*av+(1-xr)*bv;
	},
	/* double up array elements to average out array lengths */
	resample: function(polygon, steps) {
		var resample_steps = (polygon.length/(steps-polygon.length));
		for (var i=((steps-polygon.length)-1); i>=0; i--) {
			var j = Math.floor(resample_steps*i);
			polygon.splice(j,0,polygon[j]);
		}
		return polygon;
	},
	/* calculate morphing steps */
	steps: function(p1, p2, steps) {

		var animation = [];
	
		/* check for polygon sizes and resample if nessecary */
		if (p1.length < p2.length) {
			p1 = polymorph.resample(p1, p2.length);
		} else if (p1.length > p2.length) {
			p2 = polymorph.resample(p2, p1.length);
		}
		
		/* return first polygon */
		animation.push(p1);

		/* calculate interpolated polygons */
		var pi = [];
		for (var i=2; i < steps; i++) {
			pi = [];
			for (var j=0; j < p1.length; j++) {
				pi.push([
					polymorph.linterpol(1, p1[j][0], steps, p2[j][0], i),
					polymorph.linterpol(1, p1[j][1], steps, p2[j][1], i)
				]);
			} 
			animation.push(pi);
		}
	
		/* return final polygon */
		animation.push(p2);
		
		return animation;
	
	},
	/* execute polymorphing animation */
	run: function(p1, p2, steps, duration, callback) {
		var interval = Math.round(duration/steps);
		var animation = polymorph.steps(p1, p2, steps);
		var timer = setInterval(function(){
			callback(animation.shift());
			if (animation.length === 0) clearInterval(timer);
		}, interval);
	}
}
