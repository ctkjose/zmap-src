
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
		strokeWidth: 2,
		strokeOpacity: 1,
		fillStyle: "#3388ff",
		fillOpacity: 0.2,
		lineCap: "round",
		lineJoin: "round",
		svgPrimitive: "polygon", //allowed options: "polygon", "polyline", "circle"
	};
	if(options){
		zmap.decorate(this.options, options);
	}
};
zmap.polygonLayer.polyline = function(locations, options){
	var ly = new zmap.polygonLayer(locations, options);

	ly.options.svgPrimitive = "polyline";
	return ly;
};
zmap.polygonLayer.polygon = function(locations, options){
	var ly = new zmap.polygonLayer(locations, options);
	return ly;
},
zmap.polygonLayer.circle = function(center, options){
	var ly = new zmap.polygonLayer([zmap.LatLng(center).toArray()], options);
	ly.options.svgPrimitive = "circle";

	if(options && options.radius ){
		ly.radius = options.radius;
	}
	return ly;
};
zmap.polygonLayer.prototype = {
	id: '', //uid asigned by zmap
	type: "overlay",
	canvas: undefined,
	lastCenter: undefined,
	points: [], // array of [lat, lon]
	bounds: {tl:null, br:null, ptl: null, pbr: null}, //bound corners in LatLng and points
	setView: function(x,y,w,h){
		this.canvas.setAttribute("width",w);
		this.canvas.setAttribute("height",h);
		this.canvas.setAttribute("viewBox", "0 0 " + w + " "  + h );

		this.canvas.style.left = x + 'px';
		this.canvas.style.top = y + 'px';
	},
	draw_circle: function(){
		if(this.svgNode.nodeName != "circle"){
			var g = this.svgNode.parentNode;
			var svgNS = "http://www.w3.org/2000/svg";
			this.svgNode.parentNode.removeChild(this.svgNode);
			this.svgNode = document.createElementNS(svgNS,"circle");
			g.appendChild(this.svgNode);
		}

		this.svgNode.setAttribute("stroke-linecap", this.options.lineCap);
		this.svgNode.setAttribute("stroke-linejoin", this.options.lineJoin);

		if(this.options.fillStyle){
			this.svgNode.setAttribute("fill", this.options.fillStyle);
		}
		if(this.options.fillOpacity){
			this.svgNode.setAttribute("fill-opacity", this.options.fillOpacity);
		}

		if(this.options.strokeStyle){
			this.svgNode.setAttribute("stroke", this.options.strokeStyle);
		}
		if(this.options.strokeWidth > 0){
			this.svgNode.setAttribute("stroke-width", this.options.strokeWidth);
		}
		if(this.options.strokeOpacity){
			this.svgNode.setAttribute("stroke-opacity", this.options.strokeOpacity);
		}


		var cLatLng = zmap.LatLng(this.points[0]);
		var pCenter = map.pointFromLatLng(cLatLng);

		//this.options.lineWidth = 1;
		var top = cLatLng.moveBy(this.radius, 0);
		var pTop = map.pointFromLatLng(top);

		var r = pCenter.distanceTo(pTop); //new radius

		var tl = top.moveBy(this.radius, 270);
		
		var ptl = map.pointFromLatLng(tl);
		
		var sf = (this.options.strokeWidth*2);
		var w = (r*2) + sf;
		var h = w;

		sf = this.options.strokeWidth;
		
		this.setView(ptl.x, ptl.y, w, h);
		

		this.svgNode.setAttribute("cx", r+sf);
		this.svgNode.setAttribute("cy", r+sf);
		this.svgNode.setAttribute("r", r);
	},
	draw_polygon: function(opOpenPath){

		this.updateBoundsFromCenterPoint(this.owner.centerTile);

		if(opOpenPath == undefined) opOpenPath = false;

		this.svgNode.setAttribute("stroke-linecap", this.options.lineCap);
		this.svgNode.setAttribute("stroke-linejoin", this.options.lineJoin);

		if(this.options.fillStyle){
			this.svgNode.setAttribute("fill", this.options.fillStyle);
		}
		if(this.options.fillOpacity){
			this.svgNode.setAttribute("fill-opacity", this.options.fillOpacity);
		}

		if(this.options.strokeStyle){
			this.svgNode.setAttribute("stroke", this.options.strokeStyle);
		}
		if(this.options.strokeWidth > 0){
			this.svgNode.setAttribute("stroke-width", this.options.strokeWidth);
		}
		if(this.options.strokeOpacity){
			this.svgNode.setAttribute("stroke-opacity", this.options.strokeOpacity);
		}
	
	
		var path = "";
		var cmd="L";
		for (var i = 0; i < this.points.length; i++) {
			var p = map.pixelFromLatLng(this.points[i]);
			p.x -= this.bounds.ptl.x;
            p.y -= this.bounds.ptl.y;
			
			cmd=(i==0) ? "M" : "L";
			path = path + cmd + p.x + " " + p.y;
		}
		
		path += " z"; //close path

		this.svgNode.setAttribute("d", path);
	},
	draw_polyline: function(){

		this.updateBoundsFromCenterPoint(this.owner.centerTile);

		if(this.svgNode.nodeName != "polyline"){
			var svgNS = "http://www.w3.org/2000/svg";
			var g = this.svgNode.parentNode;
			this.svgNode.parentNode.removeChild(this.svgNode);
			this.svgNode = document.createElementNS(svgNS,"polyline");
			g.appendChild(this.svgNode);
		}

		this.svgNode.setAttribute("stroke-linecap", this.options.lineCap);
		this.svgNode.setAttribute("stroke-linejoin", this.options.lineJoin);

		this.svgNode.setAttribute("fill", "none");

		if(this.options.strokeStyle){
			this.svgNode.setAttribute("stroke", this.options.strokeStyle);
		}
		if(this.options.strokeWidth > 0){
			this.svgNode.setAttribute("stroke-width", this.options.strokeWidth);
		}
		if(this.options.strokeOpacity){
			this.svgNode.setAttribute("stroke-opacity", this.options.strokeOpacity);
		}
	
	
		var points = "";

		for (var i = 0; i < this.points.length; i++) {
			var p = map.pixelFromLatLng(this.points[i]);
			p.x -= this.bounds.ptl.x;
            p.y -= this.bounds.ptl.y;
			
			if(i>0) points +=",";
			points += p.x + " " + p.y;
		}
		
		this.svgNode.setAttribute("points", points);
	},
	refreshDOM: function(owner){
		this.owner = owner;

		var fn = "draw_" + this.options.svgPrimitive;
		if(typeof(this[fn]) == "function"){
			this[fn]();
		}			
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
		
		this.setView(this.bounds.ptl.x,this.bounds.ptl.y, w, h);
		
	},
	buildDOM: function(owner, o){
		var a = document.createElement('div');
		var layers = zmap.dom.get(".zmap-layers", o);

		zmap.dom.addClass(a,"zmap-layer zmap-layer-overlay");
		a.setAttribute("id", this.id);
		layers.appendChild(a);
		this.o = a;

		this.canvas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.canvas.classList.add("zmap-poly", "zmap-poly-svg");
		this.canvas.setAttribute("xmlns","http://www.w3.org/2000/svg");

		var svgNS = "http://www.w3.org/2000/svg";
		var g = document.createElementNS(svgNS,"g");
		this.svgNode = document.createElementNS(svgNS,"path");
		this.svgNode.setAttribute("d", "M0 0");
	
		g.appendChild(this.svgNode);

		this.canvas.appendChild(g);
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