self.zmap = {
	decorate: function(a){
		var k = arguments, l = null;
		for( i = 1; i < k.length; i++ ) {
		  if( (l = k[ i ]) ) {
			for (var j in l){ a[j] = l[j]; }
		  }
		}
		return a;
	},
    extend: function(child, parent) {
        for (var property in parent.prototype) {
            if (typeof child.prototype[property] == "undefined") {
                child.prototype[property] = parent.prototype[property];
            }
        }
        return child;
    },
	fn: {
		addMarker: function(marker){
			this._ly.markers.addMarker(marker);
		},
		pointFromLatLng: function(latlng){
			var px = this.pixelFromLatLng(latlng);

			return new zmap.point(px.x, px.y, px.z);
		},
		pixelFromLatLng: function(latlng){
			var l = zmap.LatLng(latlng);
			return this.pixelFromPoint(l.toTilePoint(this.state.zoom));
		},
		pixelFromPoint: function(p){
			
			var tz = this.options.tileSize;
			var z = this.state.zoom;		
			var w = this.container.w;
			var h = this.container.h;
			var c = this.centerTile;
			p = p.zoomTo(z);

			var scale = Math.pow(2, c.z - p.z);
			var x =  Math.round((w* 0.5) + (p.x - c.x) * tz * scale);
			var y = Math.round((h* 0.5) + (p.y - c.y) * tz * scale);

			x = x.toFixed(0);
			y = y.toFixed(0);

			return {x: x, y: y, z:z, scale:scale};

		},
		//returns a point reperesenting a map coordinate from a pixel in map view port
		//the new point coordinate is the distance from map center, in tile widths.
		pixelToTilePoint: function(point){
			point = zmap.point.toPoint(point);
			var out = this.centerTile.copy();
			out.x += (point.x - this.container.w/2)/this.options.tileSize;
			out.y += (point.y - this.container.h/2)/this.options.tileSize;
			return out;
        },
		setCenter: function(p){

			var lat = this.center.lat;
			var lng = this.center.lng;
			var zoom = this.state.zoom;
			
			if(arguments.length == 1){
				if(p && (p instanceof zmap.LatLng)){
					lat = p.lat;
					lng = p.lng;
				}else if(p && (p instanceof zmap.point)){
					p = p.toLatLng(zoom);
					lat = p.lat;
					lng = p.lng;
				}else if(p && (typeof(p) == "object") && Array.isArray(p) && (p.length==2)){
					lat = parseFloat(p[0]);
					lng = parseFloat(p[1]);
				}else if(p && (typeof(p) == 'object') && p.hasOwnProperty(lat) &&  p.hasOwnProperty(lng) ) {
					lat = parseFloat(p.lat);
					lng = parseFloat(p.lng);
				}
			}else if(arguments.length >= 2){
				lat = parseFloat(arguments[0]);
				lng = parseFloat(arguments[1]);

				if(arguments.length == 3){
					zoom = parseInt(arguments[2]);
				}
			}
			
			if(this.state.zoom != zoom){
				this.state.zoom = zoom;
			}

			this.center = new zmap.LatLng(lat, lng);
			this.centerTile = this.center.toTilePoint(this.state.zoom);
			return this;
		},
		updateMapDimensions: function(w, h){
			if(typeof(w) !== "number") w = this.o.offsetWidth;
			if(typeof(h) !== "number") w = this.o.offsetHeight;


			this.container.w = w;
			this.container.h = h;
		},
		installEventHandlers: function(){

			var map = this;
			this.o.addEventListener("keydown", function(e){
				var key = e.keyCode;
				var skey = "" + key;
				var triggers = {
						"37" :  function(){ map.panLeft(); },
						"39" :  function(){ map.panRight(); },
						"40" :  function(){ map.panDown(); },
						"38" :  function(){ map.panUp(); },
						"187" : function(){ map.zoomBy(1); },
						"189" : function(){ map.zoomBy(-1); },
					//zoomIn:  [187, 107, 61, 171],
					//zoomOut: [189, 109, 54, 173]
				};

				if( triggers.hasOwnProperty(skey)){
					var tFn = triggers[skey];
					if(tFn && (typeof(tFn) == "function")) tFn();
				}

			});

			var layers = this.olayers; //zmap.dom.get(".zmap-layers", this.o);
			layers.addEventListener("interactionEnd", function(e){
				layers.style.cursor = 'default';
			});
			layers.addEventListener("interactionStart", function(e){
				layers.style.cursor = 'grabbing';
			});
			layers.addEventListener("interactionDrag", function(e){
				
				if( (Math.abs(e.deltaX) < 5) && (Math.abs(e.deltaY) < 5) ){
					map.panBy(e.deltaX, e.deltaY);
				}
			});
			layers.addEventListener("interactionClick", function(e){
				map.publish("click", map, e);
			});
		},
		buildDefaultControls: function(){
			this._ly.controls.buildControlZoom();
		},
		buildMapLayers: function(){
			
			this.o.setAttribute("tabindex", 0);

			zmap.dom.addClass(this.o,"zmap-container");
			zmap.dom.css(this.o, {"position":"relative", "outline":"none"});

			var layers = document.createElement('div');
			
			zmap.dom.addClass(layers,"zmap-layers");
			this.o.appendChild(layers);
			this.olayers = layers;

			zmap.makeTouchFriendly(layers);
			this._ly.markers = new zmap.markerLayer();
			this.addLayer(this._ly.markers);

			this._ly.controls = new zmap.controlLayer();
			this.addLayer(this._ly.controls);
		},
		addLayer: function(ly){
			var o = ly.buildDOM(this, this.o);

			ly.o = o;
			ly.idx = this.layers.length;
			ly.owner = this;

			this.state.zindex++;

			if(ly.type == "tiles"){
				ly.zindex = 100 + this.state.zindex;
			}else if(ly.type == "overlay"){
				ly.zindex = 200 + this.state.zindex;
			}else if(ly.type == "markers"){
				ly.zindex = 600 + this.state.zindex;
			}else if(ly.type == "controls"){
				ly.zindex = 800 + this.state.zindex;
			}else{
				ly.zindex = 400 + this.state.zindex;
			}

			zmap.dom.css(o, {"z-index":ly.zindex, "opacity":1});
			this.layers.push(ly);

			return this;
		},
		requestDraw: function(){
			//defer draw until browser is ready
			var map = this;
			zmap.requestAnimation(function(){
				map.draw();
			});
			return this;
		},
		draw: function(){
			this.drawLayers();
			this.publish("draw", map)
		},
		drawLayers: function(){
			for(var i in this.layers){
				var o = this.layers[i];
				o.refreshDOM(this);
			}
		},
		enforceBounds: function(point) {
			return point;
	
            if (this.coordLimits) {

                coord = coord.copy();

                // clamp pan:
                var topLeftLimit = this.coordLimits[0].zoomTo(coord.zoom);
                var bottomRightLimit = this.coordLimits[1].zoomTo(coord.zoom);
                var currentTopLeft = this.pointCoordinate(new MM.Point(0, 0))
                    .zoomTo(coord.zoom);
                var currentBottomRight = this.pointCoordinate(this.dimensions)
                    .zoomTo(coord.zoom);

                // this handles infinite limits:
                // (Infinity - Infinity) is Nan
                // NaN is never less than anything
                if (bottomRightLimit.row - topLeftLimit.row <
                    currentBottomRight.row - currentTopLeft.row) {
                    // if the limit is smaller than the current view center it
                    coord.row = (bottomRightLimit.row + topLeftLimit.row) / 2;
                } else {
                    if (currentTopLeft.row < topLeftLimit.row) {
                        coord.row += topLeftLimit.row - currentTopLeft.row;
                    } else if (currentBottomRight.row > bottomRightLimit.row) {
                        coord.row -= currentBottomRight.row - bottomRightLimit.row;
                    }
                }
                if (bottomRightLimit.column - topLeftLimit.column <
                    currentBottomRight.column - currentTopLeft.column) {
                    // if the limit is smaller than the current view, center it
                    coord.column = (bottomRightLimit.column + topLeftLimit.column) / 2;
                } else {
                    if (currentTopLeft.column < topLeftLimit.column) {
                        coord.column += topLeftLimit.column - currentTopLeft.column;
                    } else if (currentBottomRight.column > bottomRightLimit.column) {
                        coord.column -= currentBottomRight.column - bottomRightLimit.column;
                    }
                }
            }

            return coord;
        },
		// Get the current zoom level of the map, returning a number
        getZoom: function() {
            return this.state.zoom;
        },
		setZoom: function(v){
			var z = this.state.zoom;
			if( v < this.options.minZoom ){
				z = this.options.minZoom;
			}else if( v > this.options.maxZoom ){
				z = this.options.maxZoom;
			}else{
				z = v;
			}

			if(z == this.state.zoom) return;
			var power = Math.pow(2, z - this.centerTile.z);
			this.centerTile.x *= power;
			this.centerTile.y *= power;
			this.centerTile.z = z;
			
			this.state.zoom = z;
			this.center = this.centerTile.toLatLng(this.state.zoom);

			this.requestDraw();
            this.dispatchCallback('zoom', [this, z]);
			return this;
		},
		zoom: function(v) {
            if (v !== undefined) {
                return this.setZoom(v);
            } else {
                return this.getZoom();
            }
        },
		//zooming
        zoomBy: function(offset) {
			var z = this.state.zoom + offset;
			this.setZoom(z);
            return this;
        },
		//change center to new LatLng
		panTo: function(p){
			if(p){
				if(p instanceof zmap.marker){
					p = p.location;
				}else{
					p = zmap.LatLng(p);
				}
				this.setCenter(p).requestDraw();
				this.publish('move', [this, this.center]);
			}
			return this;
		},
		//move center by X, Y pixels
		panLeft: function() { return this.panBy(this.options.panMove, 0); },
        panRight: function() { return this.panBy(this.options.panMove * -1, 0); },
        panDown: function() { return this.panBy(0, this.options.panMove * -1); },
        panUp: function() { return this.panBy(0, this.options.panMove); },
		panBy: function(dx, dy) {

			this.state.isPanning = true;
            this.centerTile.x -= dx / this.options.tileSize;
            this.centerTile.y -= dy / this.options.tileSize;

			this.center = this.centerTile.toLatLng(this.state.zoom);
            
			this.requestDraw();
			this.state.isPanning = false;

			this.publish('panned', [this, dx, dy]);
            this.publish('move', [this, this.center]);
            return this;
        },

		
		
		// A utility function for finding the offset of the
		// mouse click from the top-left of the page
		pointFromEvent: function(e){
			// start with just the mouse (x, y)
			return me.pointFromPixel(e.clientX, e.clientY);
		},
		pointInPixel: function(x, y) {

			var point = new zmap.point(x, y, this.state.zoom);

			// correct for scrolled document
			point.x += document.body.scrollLeft + document.documentElement.scrollLeft;
			point.y += document.body.scrollTop + document.documentElement.scrollTop;

			// correct for nested offsets in DOM
			for (var node = this.o; node; node = node.offsetParent) {
				point.x -= node.offsetLeft;
				point.y -= node.offsetTop;
			}
			return point;
		}
	},
	configure: function(options){
		
		this.options = {
			markerIcon: "zmap-marker-red.svg",
			urlAssets: "./"
		};

		//find url to zmap assets folder
		var o = document.createElement("div");
		o.classList.add("zmap-marker-image");
		document.body.appendChild(o);
		var style =  window.getComputedStyle(o);
		var u = (style["backgroundImage"] ||  style["background-image"]);
		
		document.body.removeChild(o);	
		if(u.indexOf("url") >= 0){
			u = u.replace(/^url\(["']?/, "").replace(/zmap-marker-red\.svg["']?\)$/, "");
			this.options.urlAssets = u;
		}
		
		if(options) zmap.decorate(this.options, options);
	},
	create: function(sel, options){
		var def = {
			zoom: 14,
		};

		if(!this.options){ //not configured...
			this.configure();
		}

		var map = {
			o: undefined,  //dom element
			center: undefined, //LatLng of centener
			
			container: {
				sel: "", //dom selector
				w: 400,
				h: 400,
			},
			layers:[], //layers in view
			_ly:{}, //special layers
			state: {
				zindex: 0, //zindex count for layers
				isPanning: false,
				zoom: 14,
			},
			options : {
				tileSize: 256,
				panMove: 100, //units in pixels to move
				maxZoom: 19,
				minZoom: 1,
			},
		};

		this.decorate(map, this.fn);
		zmap.makeEventEmmiter(map);

		var ops = this.decorate(map.options, options);
		if(map.options.hasOwnProperty("zoom")) map.state.zoom = map.options.zoom;
		if(map.options.hasOwnProperty("center")){
			map.center = new zmap.LatLng(map.options.center);
			map.centerTile = map.center.toTilePoint(map.state.zoom);
		}

		map.container.sel = sel;
		map.o = zmap.dom.get(sel);
		if(!map.o){
			console.log("[ZMAP][ERROR] Invalid selector");
			return undefined;
		}

	
		map.buildMapLayers();
		map.buildDefaultControls();
		map.installEventHandlers();
		return map;
	}
	
};
/*
  _getIconUrl: function(t) {
                return Xe.imagePath || (Xe.imagePath = this._detectIconPath()), (this.options.imagePath || Xe.imagePath) + Ye.prototype._getIconUrl.call(this, t)
            },
            _detectIconPath: function() {
                var t = G("div", "leaflet-default-icon-path", document.body),
                    i = q(t, "background-image") || q(t, "backgroundImage");
                return document.body.removeChild(t), i = null === i || 0 !== i.indexOf("url") ? "" : i.replace(/^url\(["']?/, "").replace(/marker-icon\.png["']?\)$/, "")
            }
*/

(function(zmap){
	
	
	
})(zmap);