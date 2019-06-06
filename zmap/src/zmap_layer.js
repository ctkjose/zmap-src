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
}
