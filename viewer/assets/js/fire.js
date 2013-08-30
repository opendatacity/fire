$(document).ready(function(){
	
	var map = new L.Map('map', {
		minZoom: 6,
		maxZoom: 12,
		maxBounds: new L.LatLngBounds(
			new L.LatLng(28, -130), 
			new L.LatLng(52, 60)
		)
	});

	var tiles = new L.TileLayer('http://tilt.odcdn.de/terrain/{z}/{x}/{y}.jpg', {
		attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Map Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>. Fire Data by <a href="http://inciweb.nwcg.gov/">InciWeb</a>',
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
	
	var viewpoly = new L.Polygon(polys[keys[0]], {
		stroke: true,
		color: '#f00',
		opacity: 0.5,
		weight: 3,
		fill: true,
		fillColor: '#f00',
		fillOpacity: 0.4
	});

	map.addLayer(viewpoly);
	
	/* set inital time */
	$('#map-date').text(moment.unix(parseInt(keys[0],10)).format('DD.MM.YYYY HH:mm')+' PST');

	/* set inital size */
	$('#map-size').text((Math.round(_rimfire[keys[0]].size*100)/100).toString().replace(/\./g,',')+' km²');
	
	var morph_steps = 50;
	var morph_duration = 2500;
	
	var morph = function(step) {
		var this_step = 0;
		polymorph.run(_rimfire[keys[step]]["polygons"][0], _rimfire[keys[(step+1)]]["polygons"][0], morph_steps, morph_duration, function(end, pp){
			this_step++;
			if (!pp || pp.length === 0) {
				console.log("end");
				return;
			}
			
						
			/* update throbber */
			$('#map-throbber-bar').css('width', Math.round((((step*morph_steps)+this_step)/((keys.length-1)*morph_steps))*1000)/10+'%');
			
			var t = Math.round(polymorph.linterpol(0, keys[step], morph_steps, keys[(step+1)], this_step));
			var sz = Math.round(polymorph.linterpol(0, (_rimfire[keys[step]].size*100), morph_steps, (_rimfire[keys[(step+1)]].size*100), this_step));
			
			/* update date */
			$('#map-date').text(moment.unix(t).format('DD.MM.YYYY HH:mm')+' PST');

			/* update size */
			var szr = (Math.round(sz)/100).toString();
			if (szr.match(/\.[0-9]$/)) szr += "0";
			$('#map-size').text(szr.replace(/\./g,',')+' km²');
			
			
			/* glim effect */
			var col = (this_step%2===0)?"#f00":"#f10";
			
			viewpoly.setStyle({
				color: col,
				fillColor: col
			});
			
			var ll = [];
			$(pp).each(function(idx,p){
				ll.push(new L.LatLng(p[0],p[1]));
			});
			viewpoly.setLatLngs(ll);
			if (end && ((step+2) < keys.length)) {
				morph((step+1));
			} else if (end) {
				/* reset play button */
				$('#map-container').removeClass('playing');
				$('#map-container').addClass('played');
			}
		});
	}
		
	var start = function() {
		if ($('#map-startstop').hasClass('playing')) return; // prevent double start
		$('#map-container').addClass('playing');
		morph(0);
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

	$('#button-social').click(function(evt){
		evt.preventDefault();
		if ($('#main').hasClass('show-social')) {
			$('#main').removeClass('show-social');
		} else {
			$('#main').attr('class', 'show-social');
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

	$('#button-legal').click(function(evt){
		evt.preventDefault();
		if ($('#main').hasClass('show-legal')) {
			$('#main').removeClass('show-legal');
		} else {
			$('#main').attr('class', 'show-legal');
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
			callback((animation.length === 1), animation.shift());
			if (animation.length === 0) clearInterval(timer);
		}, interval);
		return timer;
	}
}
