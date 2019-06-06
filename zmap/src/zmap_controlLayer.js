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