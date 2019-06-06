


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

			return {x: x, y, y, z:z, scale:scale};

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
			var map = this;

			map.draw();
			/* this._redrawTimer = setTimeout(function(){
				map.draw();
				map._redrawTimer = 0;
			}, 500); */
			return this;
		},
		draw: function(){
			this.redrawLayers();
		},
		redrawLayers: function(){
			for(var i in this.layers){
				var o = this.layers[i];
				o.refreshDOM(this);
			}
		},
		//paints map in dom container
		updateView: function(){
			//defer draw until browser is ready
			var map = this;
			zmap.requestAnimation(function(){
				map.requestDraw();
			});

			return this;
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
            
			this.updateView();
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


zmap.callback = function(fn){
	var args = Array.prototype.slice.call(arguments, 1);
	if(fn && Array.isArray(fn)){
		var cfn = (typeof fn[1] === 'string') ? fn[0][fn[1]] : fn[1];
		return cfn.apply(fn[0], args);
	}else if(typeof fn == "function"){
		return fn.apply(fn, args);
	}
};
zmap.makeEventEmmiter = function(obj, withReady){
		
		var fn = {
			addCallback: function(event, callback) { //compatibility with old code
				this.on(event, callback);
			},
			dispatchCallback: function(event, message){ //compatibility with old code
				this.publish(event, this, message);
			},
			 /**
			* Register for an event
			* @param {String} topic - name of event
			* @param {callback} listener - A function or an Array with [obj, "fn_name"]
			*/
			on: function(topic, listener){
				if(!hasOwnProperty.call(this._ee.topics, topic)) this._ee.topics[topic] = { listeners: [] };
				var index = this._ee.topics[topic].listeners.push(listener) -1;
				
				var _this = this;
				return {
					remove: function() {
						delete _this._ee.topics[topic].listeners[index];
					}
				};
			},
			
			publish : function(event) {
				//console.log("[ZMAP][PUBLISH][" + event + "]");
				var state = this._ee;
			
				event = event.toLowerCase();
				var args = Array.prototype.slice.call(arguments, 1);
				//console.log(args);
				
				if(!state.isready){
					state.delayedForReady.push( {'topic' : event, 'args': args});
					return this;
				}
				
				if(hasOwnProperty.call(state.topics, event)){
					state.topics[event].listeners.forEach(function(fn) {
						var a = [fn];
						Array.prototype.push.apply(a, args);
						zmap.callback.apply(zmap, a);
					});
				}			
			},
			removeCallback: function(event, callback) {
				var state = this._ee;
				if(hasOwnProperty.call(state.topics, event)){
					var list = state.topics[event].listeners, c = list.length;
					for (var i = 0; i < c; i++) {
						if (list[i] === callback) {
							cbs.splice(i,1);
		                    break;
						}
	                }
				}	
			},
			hasListeners: function(topic){
				if(hasOwnProperty.call(this._ee.topics, topic)){
					if(this._ee.topics[topic].listeners.length > 0) return true;
				}
				return false;
			},
			isReady: function(){
				return this._ee.isready;
			},
			ready: function(fn){
				var state = this._ee;
				var _this = this;

				if(typeof(fn) == "function"){
					if( state.isready === true){
						core.callback(fn);
						return;
					}
				
					state.readyHandlers.push(fn);
					return;
				}
			
				state.isready = true;
			
				for( var i in state.readyHandlers ){
					var afn = state.readyHandlers[i];
					core.callback(afn);
				}
			
				state.delayedForReady.forEach( function(e){
					var a = e.args;
					if(!hasOwnProperty.call(state.topics, e.topic)) return;
					state.topics[e.topic].listeners.forEach( function(fn) {
						core.callbackWithArguments(fn, a);
					});
			
					if(typeof(e.promise) == "function"){
						e.promise();
					}
				});
			}
		}; //end fn

		obj._ee = {
			isready: true,
			topics: {},
			publishPromise: undefined,
			delayedForReady: [],
			readyHandlers: [],
		};

		if(withReady) obj._ee.isready = false;

		this.decorate(obj, fn);
		return obj;		
};
zmap.isString = function(obj){ return typeof obj == 'string';};
zmap.createUID= function(){
	var d = new Date().getTime();
	var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = (d + Math.random()*16)%16 | 0;
		d = Math.floor(d/16);
		return (c=='x' ? r : (r&0x3|0x8)).toString(16).toUpperCase();
	});
	return uuid;
};
zmap.requestAnimation = function(fn){
	(window.requestAnimationFrame  ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame    ||
	window.oRequestAnimationFrame      ||
	window.msRequestAnimationFrame     ||
	function (fn) {
		window.setTimeout(function () {
			fn(+new Date());
		}, 10);
	}
	)(fn);
}
zmap.dom = {
//styling
	style: function(a){
		return window.getComputedStyle(this.node(a));
	},
	css: function(a, s, b) {
		a = this.node(a);
		if(!a) return null;
		if (typeof(s) === 'object') {
			for(var p in s) {
				a.style[p] = s[p];
			}
			return a;
		}
		
		if(b === []._){
			var st = window.getComputedStyle(a);
			return st[s];
		}
		a.style[s] = b;
		return a;
	},
	hasClass:function(a, n) {
		a = this.node(a);
		if(!a) return false;
		return a.classList.contains(n);
	},
	addClass: function(a, n) {
		a = this.node(a);
		if(!a) return null;
		var cl = a.classList;
		cl.add.apply( cl, n.split( /\s/ ) );
		return a;
	},
	removeClass: function(a, n) {
		a = this.node(a);
		if(!a) return null;
		var cl = a.classList;
		cl.remove.apply( cl, n.split( /\s/ ) );
		return a;
	},
	toggleClass: function( a, n, b ) {
		a = this.node(a);
		if(!a) return null;
		var cl = a.classList;
		if( typeof b !== 'boolean' ) {
			b = !cl.contains( n );
		}
		cl[ b ? 'add' : 'remove' ].apply( cl, n.split( /\s/ ) );
		return a;
	},
	get: function(a,p){
		var o = p === []._ ? document : p;
		var e;
		
		if(zmap.isString(a)){
			if(/([\.\#\[\:][a-z\d\-\_]+)|(\s?[\,\>\+\~]\s?)/i.test(a)){			
				return o.querySelector(a);
			}
			if((e = o.querySelector("[name=\"" + a + "\"]"))) return e;
			if((e = o.querySelector("[id=\"" + a + "\"]"))) return e;
			return o.querySelector(a);
		}else if(a && a.nodeType){
			return a;
		}else if( a && a.target && a.target.nodeType ){
			return a.target;
		}
		return null;
	},
	getAll: function(a,p){
		var o = p === []._ ? document : p;
		var l = [];
		var m = o.querySelectorAll(a);
		
		if( Object.prototype.toString.call( m ) === '[object NodeList]' ) {
			Array.prototype.push.apply(l, m );
		}else{
			Array.prototype.push.apply(l, m && m.nodeType ? [m] : ('' + m === m ? document.querySelectorAll(m) : []) );
		}
		return l;
	},
	htmlToNode: function(s){
		var rn = /<|&#?\w+;/;
		var rt = /<([a-z][^\/\0>\x20\t\r\n\f]*)/i;
		var ln = [];
		var f = document.createDocumentFragment();
	
		var containers = {
			option: [ 1, "<select multiple='multiple'>", "</select>" ],
			thead: [ 1, "<table>", "</table>" ],
			tfoot: [ 1, "<table>", "</table>" ],
			tr: [ 2, "<table><tbody>", "</tbody></table>" ],
			td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
			th: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
			any: [ 0, "", "" ]
		};
	
		var t, tag, container,n, i;
		if( (typeof(s) == "object") && s && s.nodeType){
			return s;
		}
	
		if(!rn.test(s)){
			ln.push( document.createTextNode(s) );
		}else{
			tag = (rt.exec(s) || ["","any"])[1].toLowerCase();
			container = containers.hasOwnProperty(tag) ? containers[tag] :  containers.any;
			
			t = document.createElement('div');
			t.innerHTML = container[1] + s + container[2];
			i = container[0];
	
			while(i--){
				t = t.lastChild;
			}
			for (i = 0; i < t.childNodes.length; i++) {
				ln.push(t.childNodes[i]);
			}
			t.textContent = "";
		}
	
		
		if(ln.length == 1) return ln[0];
	
		for (i = 0; i < ln.length; i++) {
			f.appendChild(ln[i]);
		}
		return f;
	},
	node: function(a){
		if(!a) return null;
		if("string" === typeof(a)) return this.get(a);
		if(1 === a.nodeType) return a;
		if(a && a.target && a.target.nodeType ) return a;
		if(!a || !a.nodeType) return null;
		
		if(1 == a.nodeType)  return a;
		
		
		if((11 == a.nodeType) || (9 == a.nodeType)) {
			return a.firstChild;
		}
		return null;
	}
};

zmap.makeTouchFriendly = function(o){

	function getDistance(e) {
		var diffX = st.p1.end.clientX - st.p2.end.clientX;
		var diffY = st.p1.end.clientY - st.p2.end.clientY;
		return Math.sqrt(diffX * diffX + diffY * diffY);
	}
	function getPosition(touch) {
		return {
			pageX: touch.pageX, pageY: touch.pageY,
			clientX: touch.clientX, clientY: touch.clientY 
		};
	}
	function copyTouch(touch){
		return {
			id: touch.identifier ? touch.identifier : "M1",
			start: getPosition(touch),
			end: getPosition(touch),
			time: new Date().getTime()
		};
		
	}
	function updateTouch(p, touch){
		p.end = getPosition(touch);
	}
	var kModeInMouseDown = 1;
	var kModeInTouchDown = 2;
	var kModeInScroll = 3;
	var kModeNone = 0;
	var st = {
		mode: kModeNone,
		flgEventIsSpecial: false,
		fd :-1,
		zoom: 1,
		p1: {id:""},
		p2: {id:""},
	};
	function handleDraggin(e){
		var ne = new Event("interactionDrag", {bubbles: false,cancelable: false,view: window});
		ne.target = o;
		
		ne.deltaX = st.p2.end.clientX - st.p1.end.clientX;
		ne.deltaY = st.p2.end.clientY - st.p1.end.clientY;

		if(ne.deltaX == 0 && ne.deltaY == 0) return;

		ne.clientX = st.p2.end.clientX;
		ne.clientY = st.p2.end.clientY;
		ne.pageX = st.p2.end.pageX;
		ne.pageY = st.p2.end.pageY;

		st.flgEventIsSpecial = true;
		o.dispatchEvent(ne);
	}
	function handlePinching(e){
		var ne = new Event("interactionPinch", {bubbles: false,cancelable: false,view: window});
		ne.target = o;
		ne.pinchDirection = 0;
		var cfd = getDistance();

		if(st.fd == cfd) return;

		
		if(cfd > st.fd){
			ne.pinchDirection = 2; //out - zoom in
		}else if(cfd < st.fd){
			ne.pinchDirection = 1; //in - zoom out
		}

		st.zoom = st.zoom * Math.abs(cfd/st.fd);
		st.fd = cfd;
		ne.pinchScale = st.zoom;

		if(ne.pinchDirection == 0) return;
		
		ne.clientX = st.p2.end.clientX;
		ne.clientY = st.p2.end.clientY;
		ne.pageX = st.p2.end.pageX;
		ne.pageY = st.p2.end.pageY;

		o.dispatchEvent(ne);
	}
	function handleStart(){
		var ne = new Event("interactionStart", {bubbles: false,cancelable: false,view: window});
		ne.target = o;

		ne.clientX = st.p1.end.clientX;
		ne.clientY = st.p1.end.clientY;
		ne.pageX = st.p1.end.pageX;
		ne.pageY = st.p1.end.pageY;

		o.dispatchEvent(ne);
	}
	function handleEnd(){
		var ne = new Event("interactionEnd", {bubbles: false, cancelable: false,view: window});
		ne.target = o;

		o.dispatchEvent(ne);
	}
	function handleClick(e){
		
		if(st.flgEventIsSpecial) return;
		
		var ne = new Event("interactionClick", {bubbles: false, cancelable: false,view: window});
		ne.target = o;
		
		ne.clientX = e.clientX;
		ne.clientY = e.clientY;
		ne.pageX = e.pageX;
		ne.pageY = e.pageY;

		o.dispatchEvent(ne);
	}
	o.addEventListener("mouseleave", function(e){
		e.stopPropagation();
		st.flgEventIsSpecial = false;
		
		if(st.mode != kModeNone){
			st.mode = kModeNone;
			handleEnd();
		}
	});
	o.addEventListener("mousemove", function(e){
		if(st.mode != kModeInMouseDown) return true;
		e.stopPropagation();
		e.identifier = "M2";
		st.p2 = copyTouch( e);
				
		handleDraggin(e);
		updateTouch(st.p1, e);
	});
	o.addEventListener("mouseup", function(e){
		if(st.mode != kModeInMouseDown) return true;
		handleEnd();

		e.stopPropagation();
		st.mode = kModeNone;
		if(!st.flgEventIsSpecial) handleClick(e);
		st.flgEventIsSpecial = false;
	});
	o.addEventListener("mousedown", function(e){
		if(e.shiftKey || e.button == 2) return;
		if(st.mode == kModeInTouchDown) return;
		
		e.stopPropagation();
		st.mode = kModeInMouseDown;
		
		st.flgEventIsSpecial = false;

		e.identifier = "M1";
		st.p1=copyTouch(e);

		handleStart();
	});

	
	o.addEventListener('touchstart', function(e) {
		e.stopPropagation();
		
		st.mode = kModeInTouchDown;
		st.flgEventIsSpecial = false;
		st.zoom = 1;
		st.t = new Date;
		switch (e.touches.length) {
			case 1:
				st.p1=copyTouch(e.touches[0]);
				break;
			case 2:
				st.flgEventIsSpecial = true;
				st.p1=copyTouch(e.touches[0]);
				st.p2=copyTouch(e.touches[1]);
				st.fd = getDistance();
				break;
        }

		handleStart();
	});
	o.addEventListener('touchmove', function(e) {
		//console.log("@touchmove");
		if(st.mode != kModeInTouchDown) return;
		e.stopPropagation();
		e.preventDefault();
		if(e.touches.length == 1){
			st.p2=copyTouch(e.touches[0]);
			handleDraggin(e);
			updateTouch(st.p1, e.touches[0]);
		}else if(e.touches.length >= 2){
			
			var p1,p2;
			for(var i=0; i< e.touches.length; i++){
				if(e.touches[i].identifier == st.p1.id) p1 = e.touches[i];
				if(e.touches[i].identifier == st.p2.id) p2 = e.touches[i];
			}
			updateTouch(st.p1, p1);
			updateTouch(st.p2, p2);

			handlePinching(e);
        }
	});

	o.addEventListener('touchend', function(e) {
		e.stopPropagation();
		handleEnd();
		
		if(!st.flgEventIsSpecial && st.mode == kModeInTouchDown){
			st.mode = kModeNone;
			handleClick(st.p1.end);
		}

		st.flgEventIsSpecial = false;
	});

	return o;
};

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

	var tanlat = Math.tan(lat); // τ ≡ tanφ, τʹ ≡ tanφʹ; prime (ʹ) indicates angles on the conformal sphere
	var σ = Math.sinh(e * Math.atanh(e * tanlat/ Math.sqrt(1+tanlat*tanlat)) );
	
	var τʹ = tanlat * Math.sqrt(1+ σ * σ) - σ * Math.sqrt(1+tanlat * tanlat);

	var ξʹ = Math.atan2(τʹ, coslon);
    var ηʹ = Math.asinh(sinlon / Math.sqrt(τʹ * τʹ + coslon * coslon));

	var A = a/(1+n) * (1 + 1/4*n2 + 1/64*n4 + 1/256*n6); // 2πA is the circumference of a meridian

	const α = [ null, // note α is one-based array (6th order Krüger expressions)
            1/2*n - 2/3*n2 + 5/16*n3 +   41/180*n4 -     127/288*n5 +      7891/37800*n6,
                  13/48*n2 -  3/5*n3 + 557/1440*n4 +     281/630*n5 - 1983433/1935360*n6,
                           61/240*n3 -  103/140*n4 + 15061/26880*n5 +   167603/181440*n6,
                                   49561/161280*n4 -     179/168*n5 + 6601661/7257600*n6,
                                                     34729/80640*n5 - 3418889/1995840*n6,
                                                                  212378941/319334400*n6 ];

	var ξ = ξʹ;
    for (var j=1; j<=6; j++){
		ξ += α[j] * Math.sin(2*j*ξʹ) * Math.cosh(2*j*ηʹ);
	}

	var η = ηʹ;
    for (var j=1; j<=6; j++){
		η += α[j] * Math.cos(2*j*ξʹ) * Math.sinh(2*j*ηʹ);
	}

	var x = k0 * A * η;
    var y = k0 * A * ξ;

    // ---- convergence: Karney 2011 Eq 23, 24

    var pʹ = 1;
    for (var j=1; j<=6; j++) pʹ += 2*j*α[j] * Math.cos(2*j*ξʹ) * Math.cosh(2*j*ηʹ);
    var qʹ = 0;
    for (var j=1; j<=6; j++) qʹ += 2*j*α[j] * Math.sin(2*j*ξʹ) * Math.sinh(2*j*ηʹ);

	var γʹ = Math.atan(τʹ / Math.sqrt(1 + τʹ * τʹ) * tanlon);
    var γʺ = Math.atan2(qʹ, pʹ);

	var γ = γʹ + γʺ;

    // ---- scale: Karney 2011 Eq 25

    var sinlat = Math.sin(lat);
    var kʹ = Math.sqrt(1 - e*e*sinlat*sinlat) * Math.sqrt(1 + tanlat*tanlat) / Math.sqrt(τʹ*τʹ + coslon*coslon);
    var kʺ = A / a * Math.sqrt(pʹ*pʹ + qʹ*qʹ);

    var k = k0 * kʹ * kʺ;


	// ------------
    // shift x/y to false origins
    x = x + falseEasting;             // make x relative to false easting
    if (y < 0) y = y + falseNorthing; // make y in southern hemisphere relative to false northing

    // round to reasonable precision
    x = Number(x.toFixed(6)); // nm precision
    y = Number(y.toFixed(6)); // nm precision
    var convergence = Number( (γ/deg2rad).toFixed(9));
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

};

zmap.layer = function(){
	


};

zmap.layer.prototype = {
	id: '', //uid asigned by zmap
	type: "overlay", //string with type of layer
	owner: undefined, //reference to zmap instance,
	o: undefined, //main parent node for this layer
};
zmap.layer.prototype.getOwner = function(){
	return this.owner;
};
zmap.layer.prototype.getZoom = function(){
	return this.owner.getZoom();
};
zmap.layer.prototype.refreshDOM = function(owner){
	//required by layers
};
zmap.layer.prototype.buildDOM = function(owner, o){
	var a = document.createElement('div');
	var layers = zmap.dom.get(".zmap-layers", o);
	
	zmap.dom.addClass(a,"zmap-layer zmap-layer-" + this.type);
	a.setAttribute("id", this.id);
	layers.appendChild(a);
	this.o = a;
	return a;
};
zmap.layer.prototype.addTo =function(a){
	if(!a || !a.addLayer) return this;
	a.addLayer(this);
	return this;
};

//factory method for the default OSM Layer
zmap.osmLayer = function(){
	var ops = {
		url: "https://{S}.tile.openstreetmap.org/{Z}/{X}/{Y}.png",
		subdomains: [ 'a', 'b', 'c' ],
		tilesize: 256
	};

	var osm = new zmap.tileLayer(ops);
	return osm;
};

//implemets the basic slippy map tiles...

zmap.tileLayer = function(options){

	this.options = zmap.decorate(
		{ tileSize: 256, subdomains: [ 'a', 'b', 'c' ] }
		, options
	);

	if(typeof(options.tileLimits) == "undefined" || !Array.isArray(options.tileLimits)){
		this.options.tileLimits = [
			new zmap.point(0,0,0),             // top left outer
			new zmap.point(1,1,0).zoomTo(14)   // bottom right inner
		];
	}

	var url = options.url;
	url = url.replace('{s}', '{S}').replace('{z}', '{Z}').replace('{y}', '{Y}').replace('{x}', '{X}');

	this.isQuadKey = options.url.match(/{(Q|quadkey)}/);
	// replace Microsoft style substitution strings
	if (this.isQuadKey) url = url.replace('{subdomain}', '{S}').replace('{zoom}', '{Z}').replace('{quadkey}', '{Q}');

	this.options.url = url;

	this.hasSubdomains = (url.indexOf("{S}") >= 0);
	if(typeof(options.subdomains) != "undefined" && Array.isArray(options.subdomains)){
		this.subdomains = options.subdomains;
	}


	this.id = zmap.createUID();
};

zmap.tileLayer.prototype = {
	id:'',
	type:"tiles",
	isQuadKey: false,
	hasSubdomains: false,
	
	kTileStatus: {
		REQUESTED: 0,
		VISIBLE: 1,
		INCACHE: 10,
		NOTLOADED: 500,
	},
	cache : {}, //tile cache
	computeBounds: function(owner){
		var tz = this.options.tileSize;
		var z = owner.zoom;		
		var w = owner.container.w;
		var h = owner.container.h;
		var c = owner.centerTile;
		
		//distance from center in tiles
		var startTile = owner.pixelToTilePoint([0,0]).floor(); //top left tile
		var endTile = owner.pixelToTilePoint([w,h]).floor().right().down(); //bottom right tile
		
		var sLatLng = startTile.toLatLng();
		var eLatLng = endTile.toLatLng();

		return { start: sLatLng, end:eLatLng, startTile:startTile, endTile:endTile };
	},
	
	activateZoomLayer: function(z){
		var zo = zmap.dom.get("[data-zoom=\"" + z + "\"]");
		if(zo) return zo;
	},
	buildZoomLayer: function(z){
		zo = document.createElement('div');
		zmap.dom.addClass(zo,"zmap-layer-tile-container");
		zmap.dom.css(zo, {"display":"block"});
		zo.setAttribute("data-zoom", z);
		this.o.appendChild(zo);

		return zo;
	},
	// wrap x around the world if necessary
	// return null if wrapped coordinate is outside of the tile limits
	wrapTile: function(tile) {
		var TL = this.options.tileLimits[0].zoomTo(tile.z).floor();
        var BR = this.options.tileLimits[1].zoomTo(tile.z);
		var columnSize = Math.pow(2, tile.z);
		var wrappedColumn;
		
		BR = new zmap.point(Math.ceil(BR.x), Math.ceil(BR.y), Math.floor(BR.z));
		
		if (tile.x < 0) {
			wrappedColumn = ((tile.x % columnSize) + columnSize) % columnSize;
		} else {
			wrappedColumn = tile.x % columnSize;
		}
		
		if (tile.y < TL.y || tile.y >= BR.y) {
			return null;
		} else if (wrappedColumn < TL.x || wrappedColumn >= BR.x) {
			return null;
		} else {
			return new zmap.point( wrappedColumn, tile.y, tile.z);
		}
	},
	getTileURL: function(nTile){

		//var nTile = tile; 
		if (!nTile) {
			return null;
		}
		var base = this.options.url;
		if (this.hasSubdomains) {
			var index = parseInt(nTile.z + nTile.y + nTile.x, 10) % this.options.subdomains.length;
			base = base.replace('{S}', this.options.subdomains[index]);
		}
		if (this.isQuadKey) {
			return base
				.replace('{Z}', nTile.z.toFixed(0))
				.replace('{Q}', this.getKeyQuad(nTile.y,nTile.x,nTile.z));
		} else {
			return base
				.replace('{Z}', nTile.z.toFixed(0))
				.replace('{X}', nTile.x.toFixed(0))
				.replace('{Y}', nTile.y.toFixed(0));
		}

	},
	
	handleTileImageReady: function(tile){
		//console.log("img loaded %o", tile);

		if(this.cache[tile.id].status != this.kTileStatus.REQUESTED){
			//we r out of sync
			return;
		}

		
		var img = tile.o;
		// Prevent drag for IE
        img.ondragstart = function() { return false; };


		if(tile.flgMoveToCache){
			tile.flgMoveToCache = false;
			tile.status = this.kTileStatus.INCACHE;
			return;
		}

		if(this.activeZoomContainer.map_zoom != tile.point.z){
			tile.status = this.kTileStatus.INCACHE;
			return;
		}

		this.cacheTileMakeVisible(tile);
	},
	buildTile: function(tilePoint){ //tile point

		var id = tilePoint.getKey();
		
		var url = this.getTileURL(tilePoint);
		if(!url) return;

		//console.log("FETCH TILE [%s]", id);

		var img = document.createElement('img');
		img.alt = '';
		img.setAttribute('role', 'presentation');
		img.setAttribute('data-tile', id);
		zmap.dom.addClass(img,"zmap-layer-tile-img");
		
		var layer = this;
	
		img.src = url;

		var tile = {
			id: id,
			status: this.kTileStatus.REQUESTED, //not feched
			o: img,
			point: tilePoint.copy(),
			flgMoveToCache: false, //move to cache when loaded...
		};
		this.cache[tile.id] = tile;

		img.addEventListener("load", function(e){
			layer.handleTileImageReady(tile);
		});
		return tile;
	},
	
	cacheLoadTile: function(tilePoint){
		var id = tilePoint.getKey();
		if(this.cache.hasOwnProperty(id)){
			var tile = this.cache[id];
			if(tile.status == this.kTileStatus.VISIBLE){
				this.cacheTileSetPosition(tile);
				return true;
			}
			if(tile.status == this.kTileStatus.INCACHE){
				this.cacheTileMakeVisible(tile);
				return true;
			}else if(tile.status == this.kTileStatus.REQUESTED){
				return true;
			}
		}else{
			return false;
		}
	},
	cacheTileHide: function(tile){
		if(!tile || !tile.o) return;
		if(tile.status == this.kTileStatus.REQUESTED){
			tile.flgMoveToCache = true;
			return;
		}else if(tile.status != this.kTileStatus.VISIBLE){
			return;
		}
		tile.o.parentNode.removeChild(tile.o);
		tile.o.parentNode = undefined;
		tile.status = this.kTileStatus.INCACHE;
	},
	cacheTileSetPosition: function(tile){
		var p = tile.point;
		
		var tz = this.options.tileSize;
		var z = this.owner.state.zoom;		
		var w = this.owner.container.w;
		var h = this.owner.container.h;
		var c = this.owner.centerTile;


		var scale = Math.pow(2, c.z - p.z);
		var x =  Math.round((w* 0.5) + (p.x - c.x) * tz * scale);
        var y = Math.round((h* 0.5) + (p.y - c.y) * tz * scale);

		var trans = 'translate3d(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px, 0px)' + ' scale3d(' + scale + ',' + scale + ', 1)';
		
		//img.style.left = x + 'px';
        //img.style.top = y + 'px';
		tile.o.style["transform"] = trans;
	},
	cacheTileMakeVisible: function(tile){
		//console.log("cacheTileMakeVisible [%s]", tile.id);
		
		var p = tile.point;
		var img = tile.o;
		var tz = this.options.tileSize;
		
		if(tile.status != this.kTileStatus.VISIBLE){
			this.activeZoomContainer.appendChild(img);
		}

		tile.status = this.kTileStatus.VISIBLE;
		img.style["width"] = tz + 'px;';
		img.style["height"] = tz + 'px;';
		
		this.cacheTileSetPosition(tile);
	},
	refreshDOM: function(owner){
		this.owner = owner;
		var z = owner.state.zoom;
		var bb = this.computeBounds(owner);
		this.activeZoomContainer = this.activateZoomLayer(z, owner);
		if(!this.activeZoomContainer) {
			this.activeZoomContainer = this.buildZoomLayer(z, owner);
		}
		this.activeZoomContainer.map_zoom = z;
		
		var pTile = bb.startTile.copy();
		var activeTile = [];
		for (pTile.x = bb.startTile.x; pTile.x < bb.endTile.x; pTile.x++) {
			for (pTile.y = bb.startTile.y; pTile.y < bb.endTile.y; pTile.y++) {
				var tile = this.wrapTile(pTile);
				activeTile.push(tile.getKey());
				if(!this.cacheLoadTile(tile)){
					this.buildTile(tile);
				}
			}
		}

		for(var id in this.cache){
			//console.log(id);
			if(activeTile.indexOf(id) >= 0) continue;
			var entry = this.cache[id];
			if(entry.status != this.kTileStatus.VISIBLE) continue;
			this.cacheTileHide(entry);
		}
	},

};

zmap.extend(zmap.tileLayer, zmap.layer);

zmap.controlLayer = function(){
	this.id = zmap.createUID();
	
};
zmap.controlLayer.prototype = {
	id: '', //uid asigned by zmap
	type: "controls",
	items: {},
	refreshDOM: function(owner){
		this.owner = owner;

	},
	buildControlZoom: function(){
		var html = "<a class='zmap-btn zmap-btn-zoom-in' aria-label='Zoom In' href='#' role='button'>+</a><a class='zmap-btn zmap-btn-zoom-out' aria-label='Zoom In' href='#' role='button'>-</a>";
		var o = document.createElement("div");
		o.classList.add("zmap-btn-bar", "zmap-zoom-control",  "zmap-control");
		
		o.innerHTML = html;

		var control = {
			id:"",
			name: "zoom",
			o:o,
		};


		var map = this.owner;
		zmap.makeTouchFriendly(zmap.dom.get(".zmap-btn-zoom-in", o)).addEventListener("interactionClick", function(e){
			e.preventDefault();
			e.stopPropagation();
			map.zoomBy(1);
		});
		zmap.makeTouchFriendly(zmap.dom.get(".zmap-btn-zoom-out", o)).addEventListener("interactionClick", function(e){
			e.preventDefault();
			e.stopPropagation();
			map.zoomBy(-1);
		});
		this.addControl(control);
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
zmap.extend(zmap.controlLayer, zmap.layer);



/*
You can specialize a marker by:
	implementing just a buildMarker() function to create s dinamic DOM element.
	You may need to implement updatePosition() to compute your position relative to your size, or set marker.options.iconSize to your elements dimensions.
*/


zmap.marker = function(LatLng, options){

	
	if(!(this instanceof zmap.marker)){
		return new zmap.marker(LatLng, options);
	}

	var marker = this;
	marker.o = undefined;
	
	this.options = {
		iconURL: "",
		cssClass:"",
		cssStyle:"",
		iconSize: [40,40],
		iconAnchor: [20, 40],
		popupAnchor: [1, -34],
		tooltipAnchor: [16, -28],
		title:"",
		alt:"",
		opacity: 1,
		buildMarker: zmap.marker.buildMarker,
		updatePosition: zmap.marker.updatePosition, 
	};

	marker.location = zmap.LatLng(LatLng);

	zmap.decorate(marker.options, options);
	
	if(zmap.isString(marker.options.iconURL) && (marker.options.iconURL.length > 0)){
		if(marker.options.iconURL.indexOf("/") == -1){
			marker.options.iconURL = zmap.options.urlAssets + marker.options.iconURL;
		}
	}else{
		marker.options.iconURL = zmap.options.urlAssets + zmap.options.markerIcon;
	}

	marker.o = document.createElement("div");
	var o = marker.o;

	if(typeof(marker.options.buildMarker) == "function"){
		var s = marker.options.buildMarker(marker);
		if(typeof(s) == "string"){
			o.innerHTML = s;
		}else if(typeof(s) == "object" && s.nodeType){
			o.appendChild(s);
		}
	}

	zmap.dom.addClass(o, "zmap-marker");
	

	zmap.makeEventEmmiter(marker);
	return marker;
};
zmap.marker.updatePosition = function(marker, map){

	//var owner = this.owner.getOwner();
	var z = map.state.zoom;

	var p  = map.pixelFromLatLng(marker.location);
	//var p = projected.pixel;
	p.x = p.x - marker.options.iconAnchor[0];
	p.y = p.y - marker.options.iconAnchor[1];

	var trans = 'translate3d(' + p.x + 'px,' + p.y + 'px, 0px)' + ' scale3d(' + 1 + ',' + 1 + ', 1)';
	
	marker.o.style["transform"] = trans;
	marker.x = p.x;
	marker.y = p.y;
};
zmap.marker.buildMarker = function(marker){
	


	if(zmap.isString(marker.options.html)){
		return marker.options.html;
	}

	if(zmap.isString(marker.options.iconURL) && (marker.options.iconURL.length > 0)){
		if(marker.options.iconURL.indexOf("/") == -1){
			marker.options.iconURL = zmap.options.urlAssets + marker.options.iconURL;
		}
	}

	
	marker.oimg = document.createElement("img");
	var img = marker.oimg;

	img.setAttribute("title", marker.options.title);
	img.setAttribute("alt", marker.options.alt);
	img.style["width"] = marker.options.iconSize[0];
	img.style["height"] = marker.options.iconSize[1];
	
	img.setAttribute("src", marker.options.iconURL);

	zmap.dom.addClass(img, "zmap-marker-img");

	if(marker.options.cssClass){
		marker.o.classList.add(marker.options.cssClass);
	}
	if(marker.options.cssStyle){
		marker.o.setAttribute("style", marker.options.cssStyle);
	}
	if((typeof(marker.options.opacity) == "number") && (marker.options.opacity != 1)) {
		img.style["opacity"] = marker.options.opacity;
	}
	

	return img;
}
zmap.marker.prototype = {
	o:  undefined,

	remove: function(){
		if(!this.owner) return this;

		this.o.parentNode.removeChild(this.o);
		this.o.parentNode = undefined;

		if(this.owner.items[this.id]){
			delete this.owner.items[this.id];
		}
	},
	addTo: function(a){
		if(!a || !a.addMarker) return this;
		a.addMarker(this);
		return this;
	},
	setLatLng: function(aLatLng){
		if(aLatLng){
			this.location = zmap.LatLng(aLatLng);
		}
		if(!this.owner) return this;

		this.options.updatePosition(this, this.owner);
		return this;
	},
	getLatLng: function(){
		return this.location;
	},
};
zmap.markerLayer = function(type){
	this.id = zmap.createUID();
	if(typeof(type) == "string" && (type.length > 0)){
		this.type = type;
	}
};
zmap.markerLayer.prototype = {
	id: '', //uid asigned by zmap
	type: "markers",
	items: {},
	refreshDOM: function(owner){
		this.owner = owner;
		var z = owner.state.zoom;
		
		for(var id in this.items){
			var m = this.items[id];

			m.options.updatePosition(m, owner);

			if(typeof(m.options.refreshDOM) == "function"){
				m.options.refreshDOM(m, owner);
			}
		}
	},

	addMarker: function(marker){
		marker.id = zmap.createUID();
		if(!marker.o) return marker;
		
		marker.owner = this;
		this.items[marker.id] = marker;

		marker.options.updatePosition(marker, this.owner);
		this.o.appendChild(marker.o);
		
		zmap.makeTouchFriendly(marker.o);
		var layer = this;
		marker.o.addEventListener("interactionClick", function(e){
			var mold = zmap.dom.get(".zmap-marker-selected", layer.o);
			if(mold){
				zmap.dom.removeClass(mold, "zmap-marker-selected");
			}
			zmap.dom.addClass(marker.o, "marker-selected");
			marker.publish("click", layer.owner, marker, e, layer);
		});
		marker.o.addEventListener("dblclick", function(e){
			e.preventDefault();
			marker.publish("dblclick", layer.owner, marker, e, layer);
		});

		return marker;
	},
};
zmap.extend(zmap.markerLayer, zmap.layer);



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
