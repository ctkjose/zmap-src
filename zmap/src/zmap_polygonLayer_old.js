/*
	ZMAP default build uses a polygon functionality using SVG.
	This is the original code using a canvas, for deployemnts without svg support.

	This code is not a drop-in replacement for the current polygon support.
	When using this code check for difference in the API implemented here.
*/
zmap.polygon = function(points){

	this.pathType = 1; //polygon (closed path)
	if(typeof(points) == "object"){
		if(Array.isArray(points)){
			this.points = Array.concat.apply(this.points, points);
		}else if(points instanceof zmap.polygon){
			if(!this.points) return points;
			this.points = Array.concat.apply(this.points, points.points);
		}
	}

	return this;
};
zmap.polygon.fromGeoJSONFeature = function(obj){
	//https://macwright.org/2015/03/23/geojson-second-bite.html
	if(!obj) return undefined;
	if(typeof(obj) != "object") return undefined;
	if(!obj["geometry"]) return undefined;
	if(!obj.geometry.type) return undefined;
	if(!obj.geometry.coordinates) return undefined;

	var type = obj.geometry.type;
	var data, idx;

	var poly = new zmap.polygon();
	if(type == "Polygon"){
		poly.pathType = 1; //polygon (closed path)
		idx = 0;
		data = obj.geometry.coordinates[idx];
		for(var i=0; i< data.length; i++){
			poly.points.push( [data[i][1], data[i][0]] ); //flip (lon,lat) to (lat,lon)
		}
	}else if(type == "LineString"){
		poly.pathType = 2; //polyline (open path)
		data = obj.geometry.coordinates;
		for(var i=0; i< data.length; i++){
			poly.points.push( [data[i][1], data[i][0]] ); //flip (lon,lat) to (lat,lon)
		}
	}else if(type == "Point"){
		poly.pathType = 3; //unrelated points (open path)
		poly.points.push( [obj.geometry.coordinates[i][1], obj.geometry.coordinates[i][0]] );
	}else{
		return undefined;
	}
	
	return poly;
};
zmap.polygon.fromGeoJSONCoordinates = function(data, ringIdx){
	var idx = (typeof(rindIdx) == "number") ? ringIdx : 0; //which ring to load

	if(!data) return undefined;
	if(!Array.isArray(data)) return undefined;
	if(!data[idx]) return undefined;

	var poly = new zmap.polygon();
	for(var i=0; i< data[idx].length; i++){
		poly.points.push( [data[idx][i][1], data[idx][i][0]] ); //flip (lon,lat) to (lat,lon)
	}

	return poly;
};
zmap.polygon.prototype = {
	points: [],
	isLatLngInside: function(p) {
		p = zmap.LatLng(p);
		// ray casting algorithm for detecting if point is in polygon

		var x = p.lat, y = p.lon;
		var inside = false;
		for (var i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
			var xi = this.points[i][0], yi = this.points[i][1];
			var xj = this.points[j][0], yj = this.points[j][1];
	
			var intersect = ((yi > y) != (yj > y))
				&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
			if (intersect) inside = !inside;
		}
	
		return inside;
	}
}

zmap.polygonLayer = function(locations, options){
	this.id = zmap.createUID();

	if(locations){
		if(Array.isArray(locations)){
			this.points = [].concat(locations);
		}else if(locations instanceof zmap.polygon){
			this.points = [].concat(locations.points);
		}
	}

	this.options  = {
		strokeStyle: "#3388ff",
		fillStyle: "rgba(0, 140, 255, 0.2)",
		fillOpacity: 1,
		lineCap: "round",
		lineJoin: "round",
		lineWidth: 1,
	};
	if(options){
		zmap.decorate(this.options, options);
	}
};
zmap.polygonLayer.prototype = {
	id: '', //uid asigned by zmap
	type: "overlay",
	canvas: undefined,
	kj: "none",
	lastCenter: undefined,
	points: [], // array of [lat, lon]
	bounds: {tl:null, br:null, ptl: null, pbr: null}, //bound corners in LatLng and points
	
	refreshDOM: function(owner){
		this.owner = owner;

		var g = this.canvas.getContext('2d');
		if(!g) return;

		g.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.updateBoundsFromCenterPoint(owner.centerTile);
		
		g.lineCap = this.options.lineCap;
		g.lineJoin = this.options.lineJoin;
		g.globalAlpha = this.options.fillOpacity;
		g.lineWidth = this.options.lineWidth;
		if (this.options.strokeStyle) g.strokeStyle = this.options.strokeStyle;
		if(this.options.fillStyle) g.fillStyle = this.options.fillStyle;
		
		var w = this.bounds.pbr.x - this.bounds.ptl.x;
		var h = this.bounds.pbr.y - this.bounds.ptl.y;
		if((this.bounds.ptl.x == 0) && (this.bounds.ptl.y == 0) && (w  == owner.container.w) && (h== owner.container.h)){
			if(this.options.fillStyle) g.fillRect(0,0, w, h);
			return;
		}

        g.beginPath();


		for (var i = 0; i < this.points.length; i++) {
			var p = map.pixelFromLatLng(this.points[i]);
			p.x -= this.bounds.ptl.x;
            p.y -= this.bounds.ptl.y;
			
			if(i==0){
				g.moveTo(p.x, p.y);
				continue;
			}
			
			g.lineTo(p.x, p.y);
		}
		g.closePath();

        if(this.options.fillStyle) g.fill();    
        if(this.options.strokeStyle) g.stroke();
		
	},
	updateBoundsFromCenterPoint: function(center){
		if(this.lastCenter && (this.lastCenter.toString() == center.toString())){
			return;
		}
		this.lastCenter = center.copy();
		var map = this.owner;

		//Update points and compute bounds
		 // top left    
		var maxLat = this.points[0][0];
		var minLon = this.points[0][1];

		// bottom right
		var minLat = this.points[0][0];
		var maxLon = this.points[0][1];
    
		for (var i = 0; i < this.points.length; i++) {
			var pLatLng = this.points[i];
			
			minLat = Math.min(minLat, pLatLng[0]);
			maxLat = Math.max(maxLat, pLatLng[0]);
			minLon = Math.min(minLon, pLatLng[1]);
			maxLon = Math.max(maxLon, pLatLng[1]);
		}

		this.bounds.tl = new zmap.LatLng(maxLat, minLon);
		this.bounds.br = new zmap.LatLng(minLat, maxLon);

		this.bounds.ptl = map.pixelFromLatLng(this.bounds.tl);
		this.bounds.pbr = map.pixelFromLatLng(this.bounds.br);

		var w = this.bounds.pbr.x - this.bounds.ptl.x;
		var h = this.bounds.pbr.y - this.bounds.ptl.y;

		if((this.bounds.ptl.x <= 0) && (this.bounds.ptl.y <= 0) && (w  >= map.container.w) && (h >= map.container.h)){
			w = map.container.w;
			h = map.container.h;

			this.bounds.ptl.x = 0;
			this.bounds.ptl.y = 0;

			this.bounds.pbr.x = w;
			this.bounds.pbr.y = h;
		}
		this.canvas.width = w;
		this.canvas.height = h;

		this.canvas.style.left = this.bounds.ptl.x + 'px';
		this.canvas.style.top = this.bounds.ptl.y + 'px';
		
	},
	buildDOM: function(owner, o){
		var a = document.createElement('div');
		var layers = zmap.dom.get(".zmap-layers", o);

		zmap.dom.addClass(a,"zmap-layer zmap-layer-overlay");
		a.setAttribute("id", this.id);
		layers.appendChild(a);
		this.o = a;

		this.canvas = document.createElement('canvas');
		this.canvas.classList.add("zmap-poly", "zmap-poly-canvas");
		this.o.appendChild(this.canvas);
		return a;
	},
	updatePosition: function(marker){

		var owner = this.getOwner();
		var p = owner.pixelFromLatLng(marker.location);
		
		p.x = p.x - marker.options.iconAnchor[0];
		p.y = p.y - marker.options.iconAnchor[1];

		var trans = 'translate3d(' + p.x + 'px,' + p.y + 'px, 0px)' + ' scale3d(' + p.scale + ',' + p.scale + ', 1)';
		
		marker.o.style["transform"] = trans;
        
	},
	addControl: function(control){
		control.id = zmap.createUID();
		if(!control.o) return control;

		this.items[control.id] = control;

		this.o.appendChild(control.o);
	},

};
zmap.extend(zmap.polygonLayer, zmap.layer);


zmap.circleLayer = function(p, options){
	this.options  = {
		strokeStyle: "#3388ff",
		fillStyle: "rgba(0, 140, 255, 0.2)",
		fillOpacity: 1,
		lineCap: "round",
		lineJoin: "round",
		lineWidth: 1
	};

	this.kj = "jose";

	if(options){
		if(options.radius ){
			this.radius = options.radius;
		}
		zmap.decorate(this.options, options);
	}
	this.points.push( zmap.LatLng(p).toArray() );

	console.log(options);

};
zmap.circleLayer.prototype = {
	radius: 10,
	refreshDOM: function(owner){
		this.owner = owner;

		var g = this.canvas.getContext('2d');
		if(!g) return;

		g.clearRect(0, 0, this.canvas.width, this.canvas.height);

		var cLatLng = zmap.LatLng(this.points[0]);
		var pCenter = map.pointFromLatLng(cLatLng);

		//this.options.lineWidth = 1;
		var top = cLatLng.moveBy(this.radius, 0);
		var pTop = map.pointFromLatLng(top);

		var r = pCenter.distanceTo(pTop); //new radius

		var tl = top.moveBy(this.radius, 270);
		
		var ptl = map.pointFromLatLng(tl);
		
		var sf = (this.options.lineWidth*2);
		var w = (r*2) + sf;
		var h = w;

		sf = this.options.lineWidth;
		
		this.canvas.width = w;
        this.canvas.height = h;

        this.canvas.style.left = (ptl.x - sf) + 'px';
        this.canvas.style.top = (ptl.y - sf) + 'px';
		

		g.lineCap = this.options.lineCap;
		g.lineJoin = this.options.lineJoin;
		g.lineWidth = this.options.lineWidth;

		if (this.options.strokeStyle) g.strokeStyle = this.options.strokeStyle;
		if(this.options.fillStyle) g.fillStyle = this.options.fillStyle;
		
		g.beginPath();
		g.arc(r + sf, r+sf, r, 0, 2 * Math.PI);
		g.closePath();

		if(this.options.fillStyle) g.fill();    
		if(this.options.strokeStyle) g.stroke();      
		
	}
}
zmap.extend(zmap.circleLayer, zmap.polygonLayer);



zmap.polylineLayer = function(locations, options){
	this.id = zmap.createUID();

	if(locations){
		if(Array.isArray(locations)){
			this.points = [].concat(locations);
		}else if(locations instanceof zmap.polygon){
			this.points = [].concat(locations.points);
		}
	}

	this.options  = {
		strokeStyle: "#3388ff",
		fillStyle: "rgba(0, 140, 255, 0.2)",
		fillOpacity: 1,
		lineCap: "round",
		lineJoin: "round",
		lineWidth: 1,
	};
	if(options){
		zmap.decorate(this.options, options);
	}
};


zmap.polylineLayer.prototype = {

	refreshDOM: function(owner){
		this.owner = owner;

		var g = this.canvas.getContext('2d');
		if(!g) return;

		g.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.updateBoundsFromCenterPoint(owner.centerTile);
		
		g.lineCap = this.options.lineCap;
		g.lineJoin = this.options.lineJoin;
		g.globalAlpha = this.options.fillOpacity;
		g.lineWidth = this.options.lineWidth;
		if (this.options.strokeStyle) g.strokeStyle = this.options.strokeStyle;
		if(this.options.fillStyle) g.fillStyle = this.options.fillStyle;
		
		var w = this.bounds.pbr.x - this.bounds.ptl.x;
		var h = this.bounds.pbr.y - this.bounds.ptl.y;
		if((this.bounds.ptl.x == 0) && (this.bounds.ptl.y == 0) && (w  == owner.container.w) && (h== owner.container.h)){
			if(this.options.fillStyle) g.fillRect(0,0, w, h);
			return;
		}

        g.beginPath();


		for (var i = 0; i < this.points.length; i++) {
			var p = map.pixelFromLatLng(this.points[i]);
			p.x -= this.bounds.ptl.x;
            p.y -= this.bounds.ptl.y;
			
			if(i==0){
				g.moveTo(p.x, p.y);
				continue;
			}
			
			g.lineTo(p.x, p.y);
		}
		//g.closePath();

        //if(this.options.fillStyle) g.fill();    
        if(this.options.strokeStyle) g.stroke();
	}
}
zmap.extend(zmap.polylineLayer, zmap.polygonLayer);