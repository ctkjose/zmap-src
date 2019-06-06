
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