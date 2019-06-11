zmap.roadLayer = function(entity){
	this.id = "RD" + zmap.createUID();

	var cfgStyles = {
		"residential" : {
			"fill": "#FFF",
			"fill-opacity": 1,
			"stroke": "#D3C9BF",
			"stroke-width": [0,0,0,0,0,0,0,0,0,0,0,0,0,2,4.5,6.5,9.4,13,13,13], //width by zoom
		},
		"residential" : {
			"fill": "#FFF",
			"fill-opacity": 1,
			"stroke": "#D3C9BF",
			"stroke-width": [0,0,0,0,0,0,0,0,0,0,0,0,0,2,4.5,6.5,9.4,13,13,13], //width by zoom
		},
		"service" : {
			"fill": "#FFF",
			"fill-opacity": 1,
			"stroke": "#D3C9BF",
			"stroke-width": [0,0,0,0,0,0,0,0,0,0,0,0,0,2,4.5,6.5,9.4,13,13,13], //width by zoom
		},
		"unclassified" : {
			"fill": "#FFF",
			"fill-opacity": 1,
			"stroke": "#D3C9BF",
			"stroke-width": [0,0,0,0,0,0,0,0,0,0,0,0,0,2,4.5,6.5,9.4,13,13,13], //width by zoom
		}
	};

	this.roadType = (typeof(entity.attr.highway)=="string") ? entity.attr.highway : "unclassified";

	if(cfgStyles.hasOwnProperty(this.roadType)){
		this.roadStyle = cfgStyles[this.roadType];
	}else{
		this.roadType = "unclassified";
		this.roadStyle = cfgStyles[this.roadType];
	}

	this.points = [];
	for(var i=0; i< entity.nodes.length;i++){
		this.points.push([entity.nodes[i].lat, entity.nodes[i].lng]);
	}
};

zmap.roadLayer.prototype = {
	id: '', //uid asigned by zmap
	type: "markers",
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
	refreshDOM: function(owner){
		this.owner = owner;

		var svgNS = "http://www.w3.org/2000/svg";
		this.updateBoundsFromCenterPoint(this.owner.centerTile);

		var lp = this.gP_Path;
		
		var z = owner.getZoom();
		var sw = this.roadStyle["stroke-width"][z];
		if((sw == undefined) || (sw == 0)){
			sw = 5;
		}
		lp.setAttribute("stroke-width", 5);	
		var points = "";
		var r = 3;
		var m = 4;
		var cps = this.canvas.getElementsByTagName("circle");
		for (var i = 0; i < this.points.length; i++) {
			var p = map.pixelFromLatLng(this.points[i]);

			p.x = (p.x - this.bounds.ptl.x) + m;
            p.y = (p.y - this.bounds.ptl.y) + m;
			
			var cpID = this.id + "CP" + i;
			var cir = document.getElementById(cpID);
			/*for(var j=0; j<cps.length;j++){
				if("#CP" + i == cps[j].getAttribute("id")){
					cir = cps[j]; break;
				}
			}*/
			
			if(!cir){
				cir = document.createElementNS(svgNS,"circle");
				this.gCP.appendChild(cir);
				
				cir.setAttributeNS(null, "id", cpID);
				if(i==0){
					cir.setAttribute("class", "rd-nd rd-nd-start");
				}else if(i==this.points.length-1){
					cir.setAttribute("class", "rd-nd rd-nd-end");
				}else{
					cir.setAttribute("class", "rd-nd");
				}

				cir.setAttribute("fill", "#3F8AFF");
				cir.setAttribute("stroke-width", 1);
				cir.setAttribute("stroke", "#2858A4");

				var ly = this;
				var point = this.points[i];
				var onclick = function(e){
					e.preventDefault();
					e.stopPropagation();
					var os = document.querySelector("#" + ly.o.id + " circle.rd-nd-selected");
					if(os) os.classList.remove("rd-nd-selected");
				
					var o = e.target;
					o.classList.add("rd-nd-selected");
					//console.log("CP Click %o", e.target);
				};
				
				cir.addEventListener("click", onclick, false);

				
			}
			
			cir.setAttribute("cx",p.x);
			cir.setAttribute("cy", p.y);
			cir.setAttribute("r", r);

			if(i>0) points +=",";
			points += (p.x) + " " + (p.y);
		}
		
		lp.setAttribute("points", points);			
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

		var m = 4; //margin
		//this.bounds.ptl.x -= m;
		//this.bounds.ptl.y -= m;
		//this.bounds.pbr.x -= m;
		//this.bounds.pbr.y -= m;

		var w = (this.bounds.pbr.x - this.bounds.ptl.x);
		var h = (this.bounds.pbr.y - this.bounds.ptl.y);

		
		
		this.setView(this.bounds.ptl.x-m,this.bounds.ptl.y-m, w+(m*2), h+(m*2));
		
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
		//this.canvas.setAttribute("xmlns","http://www.w3.org/2000/svg");

		var svgNS = "http://www.w3.org/2000/svg";

		//road geometry
		this.gP = document.createElementNS(svgNS,"g");
		
		this.gP.setAttribute("id", this.id + "G1");
		this.gP_Path = document.createElementNS(svgNS,"polyline");
		this.gP_Path.setAttributeNS(null,"id", this.id + "P1");
		this.gP.appendChild(this.gP_Path);

		//road control points
		this.gCP = document.createElementNS(svgNS,"g");
		this.gCP.setAttributeNS(null,"id", this.id + "G2");
	
		this.gP_Path.setAttributeNS(null,"stroke-linecap","round");
		this.gP_Path.setAttributeNS(null,"stroke-linejoin", "round");

		this.gP_Path.setAttributeNS(null,"fill", "none");
		this.gP_Path.setAttributeNS(null,"stroke", "#3F8AFF");
		this.gP_Path.setAttributeNS(null,"stroke-opacity", "0.6");
	
		this.canvas.setAttributeNS(null, "id", this.id + "SVG");
		this.canvas.appendChild(this.gP);
		this.canvas.appendChild(this.gCP);
		this.o.appendChild(this.canvas);
		return a;
	},
};
zmap.extend(zmap.roadLayer, zmap.layer);

