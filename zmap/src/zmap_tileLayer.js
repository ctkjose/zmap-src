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
	this.cache = {}; //tile cache
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
		var zo = zmap.dom.get("[data-zoom=\"" + z + "\"]", this.o);
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
