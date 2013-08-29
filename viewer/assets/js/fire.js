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

	polymorph.run(example_data[keys[0]], example_data[keys[1]], 100, 9500, callback);

	setTimeout(function() {
		polymorph.run(example_data[keys[1]], example_data[keys[2]], 100, 9500, callback);
	}, 10000)

	setTimeout(function() {
		polymorph.run(example_data[keys[2]], example_data[keys[3]], 100, 9500, callback);
	}, 20000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[2]], example_data[keys[3]], 100, 9500, callback);
	}, 30000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[3]], example_data[keys[4]], 100, 9500, callback);
	}, 40000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[4]], example_data[keys[5]], 100, 9500, callback);
	}, 50000)
	
	setTimeout(function() {
		polymorph.run(example_data[keys[5]], example_data[keys[6]], 100, 9500, callback);
	}, 60000)

});

var polymorph = {
	/* linear interpolation */
	linterpol: function(ak,av,bk,bv,xk) {
		var xr = (bk-xk)/(bk-ak);
		return xr*av+(1-xr)*bv;
	},
	rotate: function(p1, p2) {
		var best1, best2, error = 1e10;
		for (var i1 = 0; i1 < p1.length; i1++) {
			for (var i2 = 0; i2 < p2.length; i2++) {
				var d = distance(p1[i1], p2[i2]);
				if (d < error) {
					error = d;
					best1 = i1;
					best2 = i2;
				}
			}
			if (error == 0) break;
		}

		return {
			p1: p1.slice(best1).concat(p1.slice(0, best1)),
			p2: p2.slice(best2).concat(p2.slice(0, best2))
		}
	},
	/* double up array elements to average out array lengths */
	resample: function(p1, p2) {

		function resampleRec(p1, p2) {
			if (p1.length < 1) {
				p1.length == 0;
			}
			if (p1.length == p2.length) return p1;
			if (p2.length == 0) return [];

			var pivot2Index = Math.floor(p2.length/2);
			var pivot2 = p2[pivot2Index];
			var pivot1;
			var pivot1Index;
			var pivotError = 1e10;
			var i0 = Math.max(p1.length-pivot2Index, 0);
			var i1 = Math.min(pivot2Index, p1.length-1);

			for (var i = i0; i <= i1; i++) {
				var d = distance(p1[i], pivot2);
				if (d < pivotError) {
					pivotError = d;
					pivot1 = p1[i];
					pivot1Index = i;
				}
			}

			var result;
			if (pivot1Index == pivot2Index) {
				result = p1.slice(0, pivot1Index);
			} else {
				result = resampleRec(p1.slice(0, pivot1Index+1), p2.slice(0, pivot2Index));
			}

			result.push(pivot1);

			if (p1.length-pivot1Index == p2.length-pivot2Index) {
				result = result.concat(p1.slice(pivot1Index+1));
			} else {
				result = result.concat(resampleRec(p1.slice(pivot1Index), p2.slice(pivot2Index+1)));
			}

			return result;
		}

		return resampleRec(p1, p2);
	},
	/* calculate morphing steps */
	steps: function(p1, p2, steps) {

		var animation = [];

		var temp = polymorph.rotate(p1, p2);
		p1 = temp.p1;
		p2 = temp.p2;
		
		/* check for polygon sizes and resample if nessecary */
		if (p1.length < p2.length) {
			p1 = polymorph.resample(p1, p2);
		} else if (p1.length > p2.length) {
			p2 = polymorph.resample(p2, p1);
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

function distance(point1, point2) {
	var dx = point1[0] - point2[0];
	var dy = point1[1] - point2[1];
	return dx*dx + dy*dy;
}
