$(document).ready(function(){
	
	var lang = ($('html').hasClass('site-de')) ? 'de' : 'en';
	
	switch (lang) {
		case 'de': 
			var date_format = 'DD.MM.YYYY HH:mm';
			var to_size = function(size) { return size.toFixed(2).replace(/\./g,',')+' km²' };
		break;
		case 'en': 
			var date_format = 'MM/DD/YYYY HH:mm';
			var to_size = function(size) { return Math.round(size * 247.105381).toFixed(0).replace(/\./g,',')+' ac.' };
		break;
	}
	
	var map = new L.Map('map', {
		minZoom: 6,
		maxZoom: 12,
		maxBounds: new L.LatLngBounds(
			new L.LatLng(28, -130), 
			new L.LatLng(52, 60)
		)
	});

	var tiles = new L.TileLayer('http://tilt.odcdn.de/terrain/{z}/{x}/{y}.jpg', {
		attribution: 'Application by <a href="http://www.opendatacity.de/">OpenDataCity</a> under <a href="http://creativecommons.org/licenses/by/3.0">CC BY</a>. Map Tiles: <a href="http://creativecommons.org/licenses/by/3.0">CC BY</a> <a href="http://stamen.com">Stamen Design</a>. Map Data: <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a> <a href="http://openstreetmap.org">OpenStreetMap</a>. Fire Data: <a href="http://inciweb.nwcg.gov/">InciWeb</a>',
		maxZoom: 18
	});
	
	map.setView(new L.LatLng(37.9, -119.9), 10).addLayer(tiles);
	
	var keys = [];
	var polys = {};
	for (k in _rimfire) {
		keys.push(k);
		polys[k] = [];
		$(_rimfire[k]["polygons"][0]).each(function(idx,ll){
			polys[k].push(new L.LatLng(ll[0],ll[1]));
		});
	}
	keys = keys.sort();
	
	var viewpolyStyle = {
		stroke: false,
		color: '#CC1313',
		opacity: 0.5,
		weight: 3,
		fill: true,
		fillColor: '#BE1313',
		fillOpacity: 0.8
	};

	var viewpoly = new L.Polygon(polys[keys[0]], viewpolyStyle);

	map.addLayer(viewpoly);

	var histpolyList = [];

	/* set inital time */
	$('#map-date').text(moment.unix(parseFloat(keys[0])).format(date_format)+' PST');

	/* set inital size */
	$('#map-size').text(to_size(parseFloat(_rimfire[keys[0]].size)));
	
	var morph_steps;
	var morph_speed = 60;
	var morph_duration = 2500;

	/* precalculate total number of steps */
	var total_steps = 0;
	for (var i = 1; i < keys.length; i++) {
		total_steps += Math.round(Math.round((keys[i] - keys[(i-1)]) / morph_speed)/50) + 1
	}
	var done_steps = 0;
	
	var morph = function(step, done_steps) {

		var this_step = 0;
		
		morph_duration = Math.round((keys[(step+1)] - keys[step]) / morph_speed)
		morph_steps = Math.round(morph_duration/50);

		var histpoly = new L.Polygon(polys[keys[step]], {
				stroke: false,
				color: '#000',
				opacity: 0.1,
				weight: 1,
				fill: true,
				fillColor: '#221100',
				fillOpacity: 0.1*Math.exp(-0.1*step)
			});

		map.addLayer(histpoly);
		histpolyList.push(histpoly);

		// console.log("duration", morph_duration, morph_steps);
		
		polymorph.run(_rimfire[keys[step]]["polygons"][0], _rimfire[keys[(step+1)]]["polygons"][0], morph_steps, morph_duration, function(end, pp, time){
			this_step++;
			done_steps++;
			if (!pp || pp.length === 0) {
				console.log("end");
				return;
			}

			/* update throbber */
			$('#map-throbber-bar').css('width', (100 * done_steps / total_steps).toFixed(2)+'%');
			
			var t = Math.round(polymorph.linterpol(0, keys[step], morph_steps, keys[(step+1)], this_step));
			var sz = Math.round(polymorph.linterpol(0, (_rimfire[keys[step]].size*100), morph_steps, (_rimfire[keys[(step+1)]].size*100), this_step));
			
			/* update date */
			$('#map-date').text(moment.unix(t).format(date_format)+' PST');

			/* update size */
			var szr = (Math.round(sz)/100).toString();
			if (szr.match(/\.[0-9]$/)) szr += "0";
			$('#map-size').text(to_size(parseFloat(szr)));
			
			viewpoly.setStyle(viewpolyStyle);
			
			var ll = [];
			$(pp).each(function(idx,p){
				ll.push(new L.LatLng(p[0],p[1]));
			});
			viewpoly.setLatLngs(ll);

			if (end && ((step+2) < keys.length)) {
				morph((step+1), done_steps);
			} else if (end) {
				/* reset play button */
				$('#map-container').removeClass('playing');
				$('#map-container').addClass('played');
				done_steps = 0;
			}
		});
	}
		
	var start = function() {
		if ($('#map-startstop').hasClass('playing')) return; // prevent double start
		$('#map-container').addClass('playing');
		morph(0, 0);
		removeHistpolys();
	}

	var removeHistpolys = function() {
		$(histpolyList).each(function(idx,histpoly){
			map.removeLayer(histpoly);
		});
		histpolyList.length = 0;
	}
	
	$('#map-startstop').click(function(evt){
		evt.preventDefault();
		start();
	});
	
	/* menu buttons */
	$('#button-info').click(function(evt){
		evt.preventDefault();
		if ($('#main').hasClass('show-info')) {
			$('#main').removeClass('show-info');
		} else {
			$('#main').attr('class', 'show-info');
		}
	});

	$('#button-share').click(function(evt){
		evt.preventDefault();
		if ($('#main').hasClass('show-share')) {
			$('#main').removeClass('show-share');
		} else {
			$('#main').attr('class', 'show-share');
		}
	});
	
	/* load park boundaries with geojson */
	$.getJSON('assets/data/yosemite.geo.json', function(data){
		L.geoJson(data, {
			style: function(f){
				return {
					stroke: true,
					color: '#260',
					opacity: 1,
					weight: 2,
					dashArray: '10,5',
					fill: true,
					fillColor: '#260',
					fillOpacity: 0.3
				}
			}
		}).addTo(map);
		viewpoly.bringToFront()
	});
	
	if (window.top === window) start();
	if (window.top !== window) $('html').addClass('in-frame');
	
	/* compare */

	var comparisons = ["berlin","koeln","muenchen","manhattan","london","paris","hamburg","sacramento"];
	var comparecity_current = null;
	var comparecity = null;

	var compare_city = function(city) {
		/* check if city is valid */
		if (comparisons.indexOf(city) < 0) return;
		if (comparecity_current === city) {
			/* remove */
			map.removeLayer(comparecity);
			comparecity_current = null;
		} else {
			comparecity_current = city
			$.getJSON('assets/data/'+city+'.geo.json', function(data){
				if (comparecity) map.removeLayer(comparecity);
				comparecity = L.geoJson(data, {
					style: function(f){
						return {
							stroke: true,
							color: '#FFF',
							opacity: 1,
							weight: 2,
							fill: true,
							fillColor: '#FFF',
							fillOpacity: 0.3
						}
					}
				}).addTo(map).on('click', function(e){
					map.removeLayer(comparecity);
				}).bringToFront();
				//viewpoly.bringToFront()
			});
		}
	}
	
	$('a', '#map-compare').click(function(evt){
		evt.preventDefault();
		var $b = $(this);
		var city = $b.attr('data-city');
		
		if (city === comparecity_current) {
			/* dishighlight button */
			$b.removeClass('highlight');
		} else {
			/* highlight button */
			$('a','#map-compare').removeClass('highlight');
			$b.addClass('highlight');
		}
		
		/* compare city */
		compare_city(city);
		
	});
	
	/* share */
	$('.share-pop').click(function(evt){
		evt.preventDefault();
		window.open($(this).attr('href'), "share", "width=500,height=300,status=no,scrollbars=no,resizable=no,menubar=no,toolbar=no");
		return false;
	});
	
});

var polymorph = {
	/* linear interpolation */
	betterInterpol: function(p1,p2,a) {
		return a*p2 + (1-a)*p1;
	},
	/* linear interpolation */
	linterpol: function(ak,av,bk,bv,xk) {
		var xr = (bk-xk)/(bk-ak);
		return xr*av+(1-xr)*bv;
	},
	cleanUp: function (p) {
		for (var i = 0; i < p.length; i++) {
			p[i][0] = parseFloat(p[i][0]);
			p[i][1] = parseFloat(p[i][1]);
		}
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

	reduce: function(p) {
		var cy = 0.01;
		var cx = cy*Math.cos(p[0][1]*3.14156/180);

		var indexes = [];
		for (var i = 0; i < p.length; i++) {
			var xi = Math.round(p[i][0]/cx);
			var yi = Math.round(p[i][1]/cy);
			indexes[i] = xi+'_'+yi;
		}

		var sx = 0;
		var sy = 0;
		var n = 0;
		var lastIndex = '_';
		var np = [];
		for (var i = 0; i < p.length; i++) {
			if (indexes[i] != lastIndex) {
				if (n > 0) {
					np.push([sx/n, sy/n]);
					sx = 0;
					sy = 0;
					n = 0;
				}
				lastIndex = indexes[i];
			}
			sx += p[i][0];
			sy += p[i][1];
			n ++;
		}

		np.push([sx/n, sy/n]);

		return np;
	},


	/* double up array elements to average out array lengths */
	resample: function(p1, p2) {

		var temp = polymorph.rotate(p1, p2);
		p1 = polymorph.reduce(temp.p1);
		p2 = polymorph.reduce(temp.p2);

		var max1 = p1.length-1;
		var max2 = p2.length-1;

		var a = [];
		for (var i1 = 0; i1 <= max1; i1++) a[i1] = new Array(p2.length);

		for (var i1 = 0; i1 <= max1; i1++) {
			for (var i2 = 0; i2 <= max2; i2++) {
				var minSum;
				if (i1 == 0) {
					if (i2 == 0) {
						minSum = 0;
					} else {
						minSum = a[i1][i2-1];
					}
				} else {
					if (i2 == 0) {
						minSum = a[i1-1][i2];
					} else {
						minSum = Math.min(a[i1-1][i2], a[i1-1][i2-1], a[i1][i2-1]);
					}
				}

				d = Math.pow(distance(p1[i1], p2[i2]), 0.1) + 1e-6;

				a[i1][i2] = minSum + d;
			}
		}

		var newp1 = [], newp2 = [];
		var i1 = max1, i2 = max2;
		var temp = [];
		while ((i1 > 0) || (i2 > 0)) {
			newp1.push(p1[i1]);
			newp2.push(p2[i2]);
			temp.push([i1, i2]);

			if (i1 == 0) {
				if (i2 == 0) {
					minSum = 0; // shouldn't happend
				} else {
					i2--;
				}
			} else {
				if (i2 == 0) {
					i1--;
				} else {
					var new1 = i1, new2 = i2, minSum = a[i1][i2];
					if (minSum > a[i1-1][i2-1]) {
						minSum = a[i1-1][i2-1];
						new1 = i1-1;
						new2 = i2-1;
					}
					if (minSum > a[i1-1][i2]) {
						minSum = a[i1-1][i2];
						new1 = i1-1;
						new2 = i2;
					}
					if (minSum > a[i1][i2-1]) {
						minSum = a[i1][i2-1];
						new1 = i1;
						new2 = i2-1;
					}
					i1 = new1;
					i2 = new2;
				}
			}
		}
		newp1.push(p1[0]);
		newp2.push(p2[0]);
		temp.push([0, 0]);


		return {p1:newp1, p2:newp2};
	},
	/* calculate morphing steps */
	steps: function(p1, p2, steps) {

		var animation = [];

		polymorph.cleanUp(p1);
		polymorph.cleanUp(p2);


		/* check for polygon sizes and resample if nessecary */
		var temp = polymorph.resample(p1, p2);
		p1 = temp.p1;
		p2 = temp.p2;
		
		/* return first polygon */
		animation.push(p1);

		/* calculate interpolated polygons */
		var pi = [];
		for (var i = 1; i < steps; i++) {
			var a = i/steps;
			pi = [];
			for (var j=0; j < p1.length; j++) {
				pi.push([
					polymorph.betterInterpol(p1[j][0], p2[j][0], a),
					polymorph.betterInterpol(p1[j][1], p2[j][1], a)
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
			callback((animation.length === 1), animation.shift());
			if (animation.length === 0) clearInterval(timer);
		}, interval);
		return timer;
	}
}

function distance(point1, point2) {
	var dx = point1[0] - point2[0];
	var dy = point1[1] - point2[1];
	return dx*dx + dy*dy;
}
