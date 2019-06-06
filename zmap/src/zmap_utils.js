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