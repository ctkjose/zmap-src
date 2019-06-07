//Geospatial and geometry support
//Portions adapted or ported from:
//  Latitude/longitude spherical geodesy tools (c) Chris Veness 2002-2019
//	https://www.movable-type.co.uk/scripts/latlong.html
//	
zmap.geo = {
	projection: undefined,
	wrap360: function(degrees) {
        if (0<=degrees && degrees<360) return degrees; // avoid rounding due to arithmetic ops if within range
        return (degrees%360+360) % 360; // sawtooth wave p:360, a:360
    },
	//Constrain degrees to range -180..+180 (e.g. for longitude); -181 => 179, 181 => -179.
    wrap180: function(degrees) {
        if (-180<degrees && degrees<=180) return degrees; // avoid rounding due to arithmetic ops if within range
        return (degrees+540)%360-180; // sawtooth wave p:180, a:±180
    },
	//Constrain degrees to range -90..+90 (e.g. for latitude); -91 => -89, 91 => 89.
	wrap90: function(degrees) {
        if (-90<=degrees && degrees<=90) return degrees; // avoid rounding due to arithmetic ops if within range
        return Math.abs((degrees%360 + 270)%360 - 180) - 90; // triangle wave p:360 a:±90 TODO: fix e.g. -315°
    },
	//Provides basic projection and conversion using OSM standard WGS-84 coordinate system.
	//  https://wiki.openstreetmap.org/wiki/Mercator
	//  https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
	wgs84:{
		kEarthRadius: 6378137.0,
		kinverse: 298.257223563,
		degreeCoordinateToTile: function(lat, lng, zoom){
			//lat, lng in degrees
			//zoom is the slippy map zoom level
			//uses psedudo mercartor projection see:
			
			var kDegree2Rad = (Math.PI / 180);
			var z = (typeof(zoom) == "number") ? zoom: 1;
			var scale = Math.pow(2,z)
			var rlat = lat * kDegree2Rad;
			var rlng = rlng * kDegree2Rad;
			var x = (lng+180)/360 * scale;
			var y = (1-Math.log(Math.tan(rlat) + 1/Math.cos(rlat))/Math.PI)/2 * scale;
			
			var o = {x:x,y:y,z:z};
			return o;
		},
		tileCoordinateToDegrees: function(x,y, zoom){
			var kDegree2Rad = (Math.PI / 180);
			var z = (typeof(zoom) != "undefined") ? zoom: 1;
	
			var lng = (x/Math.pow(2,z)*360-180);
			
			var n = Math.PI-2 * Math.PI * y/Math.pow(2, z);
			var lat = (kDegree2Rad * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
	
			return {lat:lat, lng: lng};
		},
		tileCoordinateToLatLng: function(x,y, zoom){
			var o = this.tileCoordinateToDegrees(x,y,zoom);
			return new zmap.LatLng(o);
		},
		project:function(lat, lng, zoom, tileSize){
			console.log("Poject(%f,%f,%d)", lat, lng, zoom);
			//lat, lng in degrees
			
			//uses psedudo mercartor projection see:
			//  https://wiki.openstreetmap.org/wiki/Mercator
			//  https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
			var kDegree2Rad = (Math.PI / 180);
			var rlat = lat * kDegree2Rad;
			var rlng = lng * kDegree2Rad;
	
			var siny = Math.sin(rlat);
			// Truncating to 0.9999 effectively limits latitude to 89.189. This is
			// about a third of a tile past the edge of the world tile.
			siny = Math.min(Math.max(siny, -0.9999), 0.9999);
	
			var y = Math.log(Math.tan( rlat / 2 + Math.PI/4 ));
			var out = {
				meters: {
					x: (lng/kDegree2Rad) * this.kEarthRadius,
					y: y * this.kEarthRadius
				},
				degrees: { //coordinates in degrees
					x: lng,
					y: y/kDegree2Rad
				},
				world: { //world coordinates are not adjusted by zoom
					x: (0.5 + lng/360),
					y: (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI))
				},
				
			};
	
			var tz = 256;
			var z = 1;
			
			if(typeof(zoom) == "number") z = zoom;
			if(typeof(tileSize) == "number") tz = tileSize;
	
			var scale = Math.pow(2, zoom);
	
			out.pixel = { //pixel coordinates, world coord adjusted by tile size and zoom
				tlesize: tz,
				z: z,
				x: Math.floor(scale * tz * out.world.x),
				y: Math.floor(scale * tz * out.world.y),
			};
	
			
			//tile Coordinates, world coords adjusted by zoom
			out.tile = {
				z: z,
				x: Math.floor(scale * out.world.x),
				y: Math.floor(scale * out.world.y),
			};
			
			return out;
		}
	}
};

zmap.bbox = function(l1, l2){
	this.minLat  =0;
	this.minLng = 0;
	this.maxLat = 0;
	this.maxLng = 0;


	if(arguments.length == 4){
		//explicit format expected: minimum latitude, minimum longitude, maximum latitude, maximum longitude
		this.minLat = Number(arguments[0]);
		this.minLng = Number(arguments[1]);
		this.maxLat = Number(arguments[2]);
		this.maxLng = Number(arguments[3]);
	}else if(l1 && l2){
		l1 = zmap.LatLng(l1); //northwest corner
		l2 = zmap.LatLng(l2); //souteast corner

		this.minLat = Math.min(l1.lat, l2.lat);
		this.minLng = Math.min(l1.lng, l2.lng);
		this.maxLat = Math.max(l1.lat, l2.lat);
		this.maxLng = Math.max(l1.lng, l2.lng);
	}

};
zmap.bbox.fromNominatimAPI = function(bbox){
		
	var b = new zmap.bbox();
	//NominatimAPI format:  south Latitude, north Latitude, west Longitude, east Longitude
	if(bbox && Array.isArray(bbox)){
		b.minLat = Number(bbox[0]);
		b.maxLat = Number(bbox[1]);

		b.minLng = Number(bbox[2]);
		b.maxLng = Number(bbox[3]);

	}else if(zmap.isString(bbox)){
		var s = bbox;
		if((s.substr(0,1) == "[") && (s.substr(-1,1) == "]")){
			s = s.substr(1,s.length-2);
		}
		var p = s.split(",");
		p = p.map(function(n){
			return n.substr(1,n.length-2);
		});

		b.minLat = Number(p[0]);
		b.maxLat = Number(p[1]);

		b.minLng = Number(p[2]);
		b.maxLng = Number(p[3]);
	}

	return b;
}
zmap.bbox.prototype = {
	clone: function() {
		return new zmap.box(this.getNorthwest(), this.getSoutheast());
	},
	//Returns the LatLng that defines the northwest corner
	getNorthwest: function () {
		return new new zmap.LatLng(this.minLat, this.minLng);
	},
	//Returns the LatLng that defines the southeast corner
	getSoutheast: function () {
		return new zmap.LatLng(this.maxLat, this.maxLng);
	},
	getNorth: function(){
		return this.maxLat;
	},
	getSouth: function(){
		return this.minLat;
	},
	getEast: function(){
		return this.maxLng;
	},
	getWest: function(){
		return this.minLng;
	},
	//returns a new bbox with corners extened or shrinked by a percentage
	resizeBy: function(percent){
		//percent = 0.25
		if(typeof(percent) != "number") return undefined;
		var latFx = (this.maxLat - this.minLat) * percent;
		var lngFx = (this.maxLng - this.minLng) * percent;

		return new zmpa.bbox(
			this.minLat - latFx, this.maxLng + lngFx,
			this.maxLat + latFx, this.minLng - lngFx,
		);
	},
	// extend the bounds to include a LatLng latitude and longitude
    encloseLatLng: function(loc) {
		loc = zmap.LatLng(loc);
		if (loc.lat > this.maxLat) this.maxLat = loc.lat;
		if (loc.lat < this.minLat) this.minLat = loc.lat;
		if (loc.lon > this.maxLng) this.maxLng = loc.lon;
		if (loc.lon < this.minLng) this.minLng = loc.lon;
	},
	// Returns the center LatLng of the bounds.
	getCenter: function () {
		return new zmap.LatLng(
		        (this.minLat + this.maxLat) / 2,
		        (this.minLng + this.maxLng) / 2);
	},
	// determine if a location is within this extent
    contains: function(loc) {
		loc = zmap.LatLng(loc);
		return (loc.lat >= this.minLat &&
			loc.lat <= this.maxLat &&
			loc.lng >= this.minLng &&
			loc.lng <= this.maxLng);
	},
	toString: function(){
		//minimum latitude, minimum longitude, maximum latitude, maximum longitude
		return this.minLat + "," + this.minLng + "," + this.maxLat + "," + this.minLng;
	},
}


zmap.LatLng = function(lat, lng) {

	if(typeof(this.lat) === "undefined" ){
		//calling as function
		if(lat && (typeof(lat) == "object") && (lat instanceof zmap.LatLng)) return lat;
		return new zmap.LatLng(lat, lng);

		
	}
	//calling as constructor
	if(lat && (typeof(lat) == "string") && (lat.substr(0,1)=="{")){
		var r = /\{\s?(\-?[0-9]+\.?[0-9]*)\s?,\s?(\-?[0-9]+\.?[0-9]*)\s?\}/;
		var m = r.exec(lat);
		if(m && m.length == 3){
			this.lat = parseFloat(m[1]);
			this.lng = parseFloat(m[2]);
		}
	}else if(lat && (typeof(lat) == "object") && Array.isArray(lat) && (lat.length==2)){
		this.lat = parseFloat(lat[0]);
		this.lng = parseFloat(lat[1]);
	}else if(lat && (typeof(lat) == 'object') && lat.hasOwnProperty('lat') &&  lat.hasOwnProperty('lng') ) {
		this.lat = parseFloat(lat.lat);
		this.lng = parseFloat(lat.lng);
	}else{

		if (isNaN(lat) || isNaN(lng)) {
			console.log('Invalid LatLng object: (' + lat + ', ' + lng + ')');
			return undefined;
		}

		this.lat = parseFloat(lat);
		this.lng = parseFloat(lng);
	}
};

zmap.LatLng.prototype = {
	lat: 0,
	lng: 0,

	clone: function() {
		return new zmap.LatLng(this.lat, this.lng);
	},
	// returns approximate distance between start and end locations in meters
	distanceTo: function(l2, r) {
		if(!l2) return 0;
		l2 = zmap.LatLng(l1);
		return zmap.LatLng.distance(this, l2, r);
	},
	// @method equals(otherLatLng: LatLng, maxMargin?: Number): Boolean
	// Returns `true` if the given `LatLng` point is at the same position (within a small margin of error). The margin of error can be overridden by setting `maxMargin` to a small number.
	equals: function(l1, maxMargin) {
		if(!l1) return false;
		l1 = zmap.LatLng(l1);

		var margin = Math.max( Math.abs(this.lat - l1.lat), Math.abs(this.lng - l1.lng));
		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	},
	//returns primitive array
	toArray: function(){ 
		return [this.lat, this.lng];
	},
	toString: function() {
		return "{" + this.lat.toFixed(3) + ", " + this.lng.toFixed(3) + "}";
	},
	toStringWithFormat: function(format,dp){
		//format could be "d"=degrees, "dm"=deg+min, "dms"=deg+min+sec
		var f = "dms";
		if(typeof(dp) != "number"){
			dp = 4;
		}

		if(typeof(format) == "string" && ([ 'd', 'dm', 'dms', 'n' ].indexOf(format) >= 0)){
			f = format;
		}

		if (format == 'n') { // signed numeric degrees
			return "{" + this.lat.toFixed(dp) + "," + this.lng.toFixed(dp) + "}";
        }

        if (![ 'd', 'dm', 'dms', 'n' ].includes(format)) throw new RangeError(`invalid format ‘${format}’`);

       
	
		var toDMS = function(deg, f, dp){
			var d,m,s, dms;
			var sep = "";
			deg = Math.abs(deg);
			if(f == "d"){
				dp = 4;
				d = deg.toFixed(dp);                       // round/right-pad degrees
			    if (d<100) d = '0' + d;                    // left-pad with leading zeros (note may include decimals)
			    if (d<10) d = '0' + d;
                dms = d + '°';
			}else if(f == "dm"){
				dp = 2;
				d = Math.floor(deg);                       // get component deg
                m = ((deg*60) % 60).toFixed(dp);           // get component min & round/right-pad
                if (m == 60) { m = (0).toFixed(dp); d++; } // check for rounding up
                d = ('000'+d).slice(-3);                   // left-pad with leading zeros
                if (m<10) m = '0' + m;                     // left-pad with leading zeros (note may include decimals)
                dms = d + '°' + sep + m + '′';
			}else if(f == "dms"){
				dp = 0;
				d = Math.floor(deg);                       // get component deg
                m = Math.floor((deg*3600)/60) % 60;        // get component min
                s = (deg*3600 % 60).toFixed(dp);           // get component sec & round/right-pad
                if (s == 60) { s = (0).toFixed(dp); m++; } // check for rounding up
                if (m == 60) { m = 0; d++; }               // check for rounding up
                d = ('000'+d).slice(-3);                   // left-pad with leading zeros
                m = ('00'+m).slice(-2);                    // left-pad with leading zeros
                if (s<10) s = '0' + s;                     // left-pad with leading zeros (note may include decimals)
                dms = d + '°' + sep + m + '′' + sep + s + '″';
			}
			return dms;
		};
		
		var lat = zmap.geo.wrap90(this.lat);
		var plat = (lat<0 ? 'S' : 'N');
		lat = toDMS(lat, f, dp);

		var lng = zmap.geo.wrap180(this.lng);
		var plng = (lng<0 ? 'W' : 'E')
		lng = toDMS(lng, f, dp);

		var out = lat + plat + ", "  + lng + plng
		return out;
    },
	toTilePoint: function(z){
		var p = zmap.geo.wgs84.degreeCoordinateToTile(this.lat,this.lng, z);
		return new zmap.point(p);
	},
	toGeoJSON() {
        return { type: 'Point', coordinates: [ this.lng, this.lat ] };
    },
	//returns a new LatLng, displaced by distanceMeters in a direction set by bearing (in degrees) 
	moveBy: function(distanceMeters, bearing, earthRadius) {
		var r = zmap.geo.wgs84.kEarthRadius;
		if (earthRadius) r = earthRadius;
		var deg2rad = Math.PI / 180.0;
		var distRadians = distanceMeters / r;

		var rbearing = bearing * deg2rad

		var lat1 = this.lat * deg2rad;
		var lng1 = this.lng * deg2rad;

		var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distRadians) + Math.cos(lat1) * Math.sin(distRadians) * Math.cos(rbearing));
		var lng2 = lng1 + Math.atan2(Math.sin(rbearing) * Math.sin(distRadians) * Math.cos(lat1), Math.cos(distRadians) - Math.sin(lat1) * Math.sin(lat2));
		
		lat2 *= 180/Math.PI;
		lng2 *= 180/Math.PI;

		return new zmap.LatLng(lat2, lng2);
	},
	isInsidePolygon: function(locations) {
		var polyPoints = locations; //an array of arrays [lat,lng]
		var x = this.lat, y = this.lng;
		
		var inside = false;
		for (var i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
			var xi = polyPoints[i][0], yi = polyPoints[i][1];
			var xj = polyPoints[j][0], yj = polyPoints[j][1];
			
			var intersect = ((yi > y) != (yj > y))
				&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
			if (intersect) inside = !inside;
		}
		
		return inside;
	}
};

// returns approximate distance between start and end locations in meters
// see http://rosettacode.org/wiki/Haversine_formula
zmap.LatLng.distance = function(l1, l2, earthRadius) {
	var r = zmap.geo.wgs84.kEarthRadius;
	if (earthRadius) r = earthRadius;

	var deg2rad = Math.PI / 180.0;
	var c = zmap.LatLng.angle(l1, l2);

	var lat1 = l1.lat * deg2rad;
	var lat2 = l2.lat * deg2rad;
	var lng1 = l1.lng * deg2rad;
	var lng2 = l2.lng * deg2rad;
	var sinDLat = Math.sin((lat2 - lat1)/ 2);
	var sinDLon = Math.sin((lng2 - lng1)/ 2);
	var a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return r * c;
};
//get circular angle in radians between to LatLng
zmap.LatLng.angle = function(l1, l2, earthRadius) {
	var r = zmap.geo.wgs84.kEarthRadius;
	if (earthRadius) r = earthRadius; 
	
	var deg2rad = Math.PI / 180.0;

	var lat1 = l1.lat * deg2rad;
	var lat2 = l2.lat * deg2rad;
	var lng1 = l1.lng * deg2rad;
	var lng2 = l2.lng * deg2rad;
	//var dlng = (l2.lng - l1.lng) * deg2rad;
	var dlng = (lng2 - lng1);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlng);
    const y = Math.sin(dlng) * Math.cos(lat2);

    var c = Math.atan2(y, x);
	
	return c;
}
// Returns bearing in degrees from one point to another
//also known as initial bearing
//for final bearing use:  zmap.geo.wrap360(zmap.LatLng.bearing(l1,l2) + 180)
zmap.LatLng.bearing = function(l1, l2) {
	var deg2rad = Math.PI / 180.0;
	var c = zmap.LatLng.angle(l1, l2);
	var bearing = c/deg2rad;

	// map it into 0-360 range
	return zmap.geo.wrap360(bearing);
};
//Return a LatLng for the mid-point
zmap.LatLng.midpointLatLng  =function(l1,l2){
	var deg2rad = Math.PI / 180.0;
	var lat1 = l1.lat * deg2rad;
	var lat2 = l2.lat * deg2rad;
	var lng1 = l1.lng * deg2rad;
	var lng2 = l2.lng * deg2rad;
	var dlng = (lng2 - lng1);

	
	var Bx = Math.cos(lat2) * Math.cos(dlng);
	var By = Math.cos(lat2) * Math.sin(dlng);

	var x = Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By);
	var y = Math.sin(lat1) + Math.sin(lat2);
	
	var lat = Math.atan2(y, x) / deg2rad;
	var lng = lng1 + Math.atan2(By, Math.cos(lat1) + Bx);
	lng = lng/deg2rad;

	return new zmap.LatLng(lat,lng);
}

// Interpolates along a great circle, f between 0 and 1
//
// * FIXME: could be heavily optimized (lots of trig calls to cache)
// * FIXME: could be inmproved for calculating a full path
zmap.LatLng.interpolate = function(l1, l2, f) {
	if (l1.lat === l2.lat && l1.lng === l2.lng) {
		return new zmap.LatLng(l1.lat, l1.lng);
	}
	var deg2rad = Math.PI / 180.0,
		lat1 = l1.lat * deg2rad,
		lon1 = l1.lng * deg2rad,
		lat2 = l2.lat * deg2rad,
		lon2 = l2.lng * deg2rad;

	var d = 2 * Math.asin(
		Math.sqrt(
		  Math.pow(Math.sin((lat1 - lat2) * 0.5), 2) +
		  Math.cos(lat1) * Math.cos(lat2) *
		  Math.pow(Math.sin((lon1 - lon2) * 0.5), 2)));

	var A = Math.sin((1-f)*d)/Math.sin(d);
	var B = Math.sin(f*d)/Math.sin(d);
	var x = A * Math.cos(lat1) * Math.cos(lon1) +
	  B * Math.cos(lat2) * Math.cos(lon2);
	var y = A * Math.cos(lat1) * Math.sin(lon1) +
	  B * Math.cos(lat2) * Math.sin(lon2);
	var z = A * Math.sin(lat1) + B * Math.sin(lat2);

	var latN = Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
	var lonN = Math.atan2(y,x);

	latN = latN/deg2rad;
	lonN = lonN/deg2rad;

	return new zmap.LatLng(latN, lonN);
};






zmap.point = function(x, y, z) {

	if(x && (typeof(x) == "object") && Array.isArray(x) && (x.length==2)){
		this.x = parseFloat(x[0]);
		this.y = parseFloat(x[1]);
	}else if(x && (typeof(x) == "object") && Array.isArray(x) && (x.length==3)){
		this.x = parseFloat(x[0]);
		this.y = parseFloat(x[1]);
		this.z = parseFloat(x[2]);
	}else if(x && (typeof(x) == 'object') && x.hasOwnProperty('x') &&  x.hasOwnProperty('y') ) {
		this.x = parseFloat(x.x);
		this.y = parseFloat(x.y);

		if(x.hasOwnProperty('z')) this.z = x.z;
	}else{
	
		this.x = x;
		this.y = y;
		this.z = (typeof(z) != "undefined") ? z : 1;
	}
};

zmap.point.prototype = {

	x: 0,
	y: 0,
	z: 0,

	toString: function() {
		return "["  + this.x.toFixed(3) +
			   ", " + this.y.toFixed(3) +
			   " @" + this.z.toFixed(3) + "]";
	},
	toLatLng: function(zoom){
		var z = (typeof(zoom) != "undefined") ? zoom: this.z;
		return zmap.geo.wgs84.tileCoordinateToLatLng(this.x, this.y, z);
	},
	// Quickly generate a string representation of this coordinate to index it in hashes. 
	getKey: function() {
		return this.z + ':' + this.x + ':' + this.y;
	},
	// Clone this object.
	copy: function() {
		return new zmap.point(this.x, this.y, this.z);
	},
	// Get the actual, rounded-number tile that contains this point.
	floor: function() {
		return new zmap.point(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
	},
	round: function() {
		return new zmap.point(Math.round(this.x), Math.round(this.y), Math.round(this.z));
	},
	// Recalculate this tile at a different zoom level and return the
	// new object.
	zoomTo: function(nzoom) {
		if(this.z == nzoom) return this;
		var power = Math.pow(2, nzoom - this.z);
		return new zmap.point(this.x * power, this.y* power, nzoom);
	},
	// Recalculate this Coordinate at a different relative zoom level and return the
	// new object.
	zoomBy: function(distance) {
		if(distance == 0) return this;
		var power = Math.pow(2, distance);
		return new zmap.point(this.x * power, this.y * power, this.zoom + distance);
	},
	// Move this coordinate up by `dist` coordinates
	up: function(dist) {
		if (dist === undefined) dist = 1;
		return new zmap.point(this.x, this.y - dist, this.z);
	},
	// Move this coordinate right by `dist` coordinates
	right: function(dist) {
		if (dist === undefined) dist = 1;
		return new zmap.point(this.x + dist, this.y, this.z);
	},
	// Move this coordinate down by `dist` coordinates
	down: function(dist) {
		if (dist === undefined) dist = 1;
		return new zmap.point(this.x, this.y + dist, this.z);
	},
	// Move this coordinate left by `dist` coordinates
	left: function(dist) {
		if (dist === undefined) dist = 1;
		return new zmap.point(this.x-dist,this.y ,this.z);
	},
	distanceTo: function(p){
		return zmap.point.distance(this, p);
	},
	divideBy: function(n){
		return new zmap.point(this.x/n, this.y/n, this.z);
	},
	multiplyBy: function(n){
		return new zmap.point(this.x*n, this.y*n, this.z);
	},
	subtract: function(p){
		return new zmap.point(this.x/p.x, this.y/p.y, this.z);
	},
	// @method scaleBy(scale: Point): Point
	// Multiply each coordinate of the current point by each coordinate of
	// `scale`. In linear algebra terms, multiply the point by the
	// [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
	// defined by `scale`.
	scaleBy: function(p){
		return new zmap.point(this.x*p.x, this.y*p.y, this.z);
	},

	// @method equals(otherPoint: Point): Boolean
	// Returns `true` if the given point has the same coordinates.
	equals: function (p) {
		return p.x === this.x && p.y === this.y;
	},

	// @method contains(otherPoint: Point): Boolean
	// Returns `true` if both coordinates of the given point are less than the corresponding current point coordinates (in absolute values).
	contains: function (p) {
		return Math.abs(p.x) <= Math.abs(this.x) &&
		       Math.abs(p.y) <= Math.abs(this.y);
	},
	
};


zmap.point.toPoint = function(x, y, z) {

	if(x && (typeof(x) == "object") && (x instanceof zmap.point)) return x;

	var p = new zmap.point(0,0,0);


	if(x && (typeof(x) == "object") && Array.isArray(x) && (x.length==2)){
		p.x = parseFloat(x[0]);
		p.y = parseFloat(x[1]);
	}else if(x && (typeof(x) == "object") && Array.isArray(x) && (x.length==3)){
		p.x = parseFloat(x[0]);
		p.y = parseFloat(x[1]);
		p.z = parseFloat(x[2]);
	}else if(x && (typeof(x) == 'object') && x.hasOwnProperty('x') &&  lat.hasOwnProperty('y') ) {
		p.x = parseFloat(lat.x);
		p.y = parseFloat(lat.y);

		if(x.hasOwnProperty('z')) p.z = x.z;
	}else{
	
		p.x = x;
		p.y = y;
		p.z = (typeof(z) != "undefined") ? z : 0;
	}

	return p;
};

// Get the euclidean distance between two points
zmap.point.distance = function(p1, p2) {
	return Math.sqrt(
		Math.pow(p2.x - p1.x, 2) +
		Math.pow(p2.y - p1.y, 2));
};

// Get a point between two other points, biased by `t`.
zmap.point.interpolate = function(p1, p2, t) {
	return new zmap.Point(
		p1.x + (p2.x - p1.x) * t,
		p1.y + (p2.y - p1.y) * t);
};


//https://cdn.jsdelivr.net/npm/geodesy@2.0.1/utm.js
zmap.LatLng.prototype.toUTM = function(earthRadius){
	var a = 6371000;
	if (earthRadius) a = earthRadius;
	var f = 1/298.257223563
	var digits = 0; //used to format utm string

	var deg2rad = Math.PI / 180.0;

	if (!(-80<=this.lat && this.lat<=84)) return ""; //outside utm range
	var falseEasting = 500e3;
	var falseNorthing = 10000e3;

	var zone = Math.floor((this.lng+180)/6) + 1; // longitudinal zone
    var centalMeridian = ((zone-1)*6 - 180 + 3) * deg2rad; // longitude of central meridian λ0

	// ---- handle Norway/Svalbard exceptions
	// grid zones are 8° tall; 0°N is offset 10 into latitude bands array
    var mgrsLatBands = 'CDEFGHJKLMNPQRSTUVWXX'; // X is repeated for 80-84°N
    var latBand = mgrsLatBands.charAt(Math.floor(this.lat/8+10));
       
	// adjust zone & central meridian for Norway
	if (zone==31 && latBand=='V' && this.lon>= 3) { zone++; centalMeridian += (6) * deg2rad; }
	// adjust zone & central meridian for Svalbard
	if (zone==32 && latBand=='X' && this.lon<  9) { zone--; centalMeridian -= (6) * deg2rad; }
	if (zone==32 && latBand=='X' && this.lon>= 9) { zone++; centalMeridian += (6) * deg2rad; }
	if (zone==34 && latBand=='X' && this.lon< 21) { zone--; centalMeridian -= (6) * deg2rad; }
	if (zone==34 && latBand=='X' && this.lon>=21) { zone++; centalMeridian += (6) * deg2rad; }
	if (zone==36 && latBand=='X' && this.lon< 33) { zone--; centalMeridian -= (6) * deg2rad; }
	if (zone==36 && latBand=='X' && this.lon>=33) { zone++; centalMeridian += (6) * deg2rad; }

	var lat = this.lat * deg2rad;      // latitude ± from equator φ
    var lon = (this.lng * deg2rad) - centalMeridian; // longitude ± from central meridian λ

	var k0 = 0.9996; // UTM scale on the central meridian

	// ---- easting, northing: Karney 2011 Eq 7-14, 29, 35:

	var e = Math.sqrt(f*(2-f)); // eccentricity
	var n = f / (2 - f);        // 3rd flattening
	var n2 = n*n, n3 = n*n2, n4 = n*n3, n5 = n*n4, n6 = n*n5;

	var coslon = Math.cos(lon), sinlon = Math.sin(lon), tanlon = Math.tan(lon);

	var tanlat = Math.tan(lat); // τ ≡ tanφ, T1 ≡ tanφʹ; prime (ʹ) indicates angles on the conformal sphere
	var SIGMA = Math.sinh(e * Math.atanh(e * tanlat/ Math.sqrt(1+tanlat*tanlat)) );
	
	var T1 = tanlat * Math.sqrt(1+ SIGMA * SIGMA) - SIGMA * Math.sqrt(1+tanlat * tanlat);

	var Xi1 = Math.atan2(T1, coslon);
    var H1 = Math.asinh(sinlon / Math.sqrt(T1 * T1 + coslon * coslon));

	var A = a/(1+n) * (1 + 1/4*n2 + 1/64*n4 + 1/256*n6); // 2πA is the circumference of a meridian

	var ALPHA = [ null, // note ALPHA is one-based array (6th order Krüger expressions)
            1/2*n - 2/3*n2 + 5/16*n3 +   41/180*n4 -     127/288*n5 +      7891/37800*n6,
                  13/48*n2 -  3/5*n3 + 557/1440*n4 +     281/630*n5 - 1983433/1935360*n6,
                           61/240*n3 -  103/140*n4 + 15061/26880*n5 +   167603/181440*n6,
                                   49561/161280*n4 -     179/168*n5 + 6601661/7257600*n6,
                                                     34729/80640*n5 - 3418889/1995840*n6,
                                                                  212378941/319334400*n6 ];

	var Xi = Xi1;
    for (var j=1; j<=6; j++){
		Xi += ALPHA[j] * Math.sin(2 * j * Xi1) * Math.cosh( 2 * j * H);
	}

	var H = H1;
    for (var j=1; j<=6; j++){
		H += ALPHA[j] * Math.cos(2*j*Xi1) * Math.sinh(2*j*H);
	}

	var x = k0 * A * H;
    var y = k0 * A * Xi;

    // ---- convergence: Karney 2011 Eq 23, 24

    var pK = 1;
    for (var j=1; j<=6; j++) pK += 2 * j * ALPHA[j] * Math.cos(2 * j * Xi1) * Math.cosh( 2 * j * H);
    var qK = 0;
    for (var j=1; j<=6; j++) qK += 2 * j * ALPHA[j] * Math.sin(2 * j * Xi1) * Math.sinh( 2 * j * H);

	var kY1 = Math.atan(T1 / Math.sqrt(1 + T1 * T1) * tanlon);
    var kY2 = Math.atan2(qK, pK);

	var GAMMA = kY1 + kY2;

    // ---- scale: Karney 2011 Eq 25

    var sinlat = Math.sin(lat);
    var kK1 = Math.sqrt(1 - e*e*sinlat*sinlat) * Math.sqrt(1 + tanlat*tanlat) / Math.sqrt(T1*T1 + coslon*coslon);
    var kK2 = A / a * Math.sqrt(pK*pK + qK*qK);

    var k = k0 * kK1 * kK2;


	// ------------
    // shift x/y to false origins
    x = x + falseEasting;             // make x relative to false easting
    if (y < 0) y = y + falseNorthing; // make y in southern hemisphere relative to false northing

    // round to reasonable precision
    x = Number(x.toFixed(6)); // nm precision
    y = Number(y.toFixed(6)); // nm precision
    var convergence = Number( (GAMMA/deg2rad).toFixed(9));
    var scale = Number(k.toFixed(12));

    var h = this.lat>=0 ? 'N' : 'S'; // hemisphere

	var utm = {
		zone: zone,
		hemisphere: h,
		northing: y,
		easting: x,
		scale: scale,
		convergence: convergence,
		value: zone + " " + h + " " + x.toFixed(digits) + " " + y.toFixed(digits)
	};

	return utm;
};
//https://cdn.jsdelivr.net/npm/geodesy@2.0.1/utm.js
/*
 * Note that MGRS grid references get truncated, not rounded (unlike UTM coordinates); grid
     * references indicate a bounding square, rather than a point, with the size of the square
     * indicated by the precision - a precision of 10 indicates a 1-metre square, a precision of 4
     * indicates a 1,000-metre square (hence 31U DQ 48 11 indicates a 1km square with SW corner at
     * 31 N 448000 5411000, which would include the 1m square 31U DQ 48251 11932).
*/
zmap.LatLng.prototype.toMGRS = function(earthRadius){
	var a = 6371000;
	if (earthRadius) a = earthRadius;
	var f = 1/298.257223563
	var digits = 10;
	var sep = "";

	var deg2rad = Math.PI / 180.0;
	
	/*
	* Latitude bands C..X 8° each, covering 80°S to 84°N
	*/
	var latBands = 'CDEFGHJKLMNPQRSTUVWXX'; // X is repeated for 80-84°N
	
	
	/*
	* 100km grid square column (‘e’) letters repeat every third zone
	*/
	var e100kLetters = [ 'ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ' ];
	
	
	/*
	* 100km grid square row (‘n’) letters repeat every other zone
	*/
	const n100kLetters = [ 'ABCDEFGHJKLMNPQRSTUV', 'FGHJKLMNPQRSTUVABCDE' ];


	var utm = this.toUTM(earthRadius);

	// MGRS zone is same as UTM zone
	var zone = utm.zone;

	// grid zones are 8° tall, 0°N is 10th band
	var band = latBands.charAt(Math.floor(this.lat/8+10)); // latitude band

	// columns in zone 1 are A-H, zone 2 J-R, zone 3 S-Z, then repeating every 3rd zone
	var col = Math.floor(utm.easting / 100e3);
	// (note -1 because eastings start at 166e3 due to 500km false origin)
	var e100k = e100kLetters[(zone-1)%3].charAt(col-1);

	// rows in even zones are A-V, in odd zones are F-E
	var row = Math.floor(this.northing / 100e3) % 20;
	var n100k = n100kLetters[(zone-1)%2].charAt(row);

	// truncate easting/northing to within 100km grid square
	var easting = utm.easting % 100e3;
	var northing = utm.northing % 100e3;

	// round to nm precision
	easting = Number(easting.toFixed(6));
	northing = Number(northing.toFixed(6));

	
	var eRounded = Math.floor(easting/Math.pow(10, 5-digits/2));
    var nRounded = Math.floor(northing/Math.pow(10, 5-digits/2));

	
	var mgrs = {
		utm: utm,
		eastingLetter: e100k,
		northingLetter: n100k,
		zone: zone,
		band: band,
		value: zone.toString().padStart(2,'0') + band + sep + e100k + n100k + sep + eRounded.toString().padStart(digits/2, '0') + sep + nRounded.toString().padStart(digits/2, '0')
	};
	return mgrs;

}