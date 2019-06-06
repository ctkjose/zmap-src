# ZMAP #

(WIP! See WIP status...)

ZMAP is a small vanilla javascript library to render interactive maps similar to [Leaflet.js](https://leafletjs.com), `OpenLayers` or `MapBox` build by [ExponentialWorks](https://exponentialworks.com).

ZMAP is just the core functionality that most of us really need. Is meant to be minimal, without dependancies, no third-party libraries and just good old javascript code that works in most mobile and desktop browsers. (It doesn't even use any sassy ES6 features!!!)  

The code is easy to hack and modify. The zmap library doesn't require any special development environment or build tool chain.

ZMAP is build for [OpenStreetMap](https://www.openstreetmap.org) so you don't have to worry about api-keys and fees. (You may also use other tile providers [slippy maps](https://en.wikipedia.org/wiki/Tiled_web_map).)

ZMAP include functionality for markers, polygons, circles, polylines, and many useful geospatial functions.

> Previous code used canvas for polygons, circles and polylines, but they now render into an SVG. The original code is still available and it works if you need it.

ZMAP was born from [modestmaps](https://github.com/modestmaps/modestmaps-js) the original library behind "mapbox.js". It attempts to have an API similar to [Leaflet.js](https://leafletjs.com).

A lot of the fancy geospatial code in ZMAP is from the great mind of Chris Veness and his [Latitude/longitude spherical geodesy tools](https://github.com/chrisveness/geodesy) .


### WIP Status ###

Touch and pinch are implemented and working fine on my iphone but needs more testing in Android browsers in particular stock browsers.

I moved the polygon code to use SVG instead of canvas. This should allow to implement easier interactions with shapes on the map.

Ability to get a LatLng in UTM and USNG/MGRS/NATO coordinates is implemented. More work pending to add conversion from these coordinates.

ZMAP is build on the WGS84 datum/projection. Code is in place to be able to add support for other projections and datums, with hopefully little refactoring. (WGS84 is still hardwired in some places.)

Tile Cache is not smart and will keep growing as big as your browser allows it. This should not be an issue for most use cases but I want to add logic to purge cache by aging or size.



## Create a Map #

```html
<body onload="loadMap();">
	   <div id="mymap"></div>
</body>
```
```js
function loadMap(){
	var map = zmap.create("#mymap", {
		zoom: 15,
		center:[18.427831712734044, -67.154815531596],
		maxZoom: 19, minZoom:1
	});

	//add default OSM layer
	zmap.osmLayer().addTo(map);

	map.requestDraw();
}
```

## Markers ##


A marker or pin adds an image to identify a specific location. A marker points to a location coordinate given in a `zmap.LatLng`.

```js
	var marker = zmap.marker([18.427831712734044, -67.154815531596], {title: "Aguadilla"});
	marker.addTo(map); // adds the marker to the map

	map.panTo(marker); //pan the map to our marker
```

The function `zmap.marker(LatLng, options)` creates a marker instance.

Available options are (All options are *optional*...):

| Option | Type | Description |
| -- | -- | -- |
| iconURL | string | The URL of the image. Use an absolute or relative URL. When using a relative URL you must use "./". If the `iconURL` is just the name of an image file *zmap* will look for it in its assets folder. |
| iconSize | array | A basic array with the width and height of the image. Default value is `[40,40]`. |
| iconAnchor | array | A basic array with the coordinates of the "tip" of the image relative to its top left corner. Default value is `[20, 40]`. |
| title | string | A string for the browser tooltip that appear on marker hover. Default value is none. |
| alt | string | A string for the browser `alt` attribute. Default value is none. |
| opacity | number | The opacity of
| cssClass | string | A css class name added to the marker's div. |
| cssStyle | string | A css style string used for the marker's div initial style. |
| buildMarker | function | An optional function to build the DOM representation of the marker.  The function must follow the signature `function(marker)`. This function must return a valid DOMElement or a string with the contents of the marker. |
| updatePosition | function | An optional function to allow you to recompute the position of the marker in the map view. The function must follow the signature `function(marker, map)`. |
| refreshDOM | function | An optional function to allow you to rebuild the markers DOM. The function must follow the signature `function(marker, map)`. The markers main domElement is a `div` available in the property `marker.o`. |
| html | string | Valid html content to be placed inside the marker's div. |



A default marker is the pin image `zmap-marker-red.svg` from the assets folder. ZMAP also includes the `zmap-marker-blue-svg` and `zmap-marker-green.svg` and many others, check the `assets` folder.

> We added some of DHS's [map symbology](https://www.fgdc.gov/HSWG/index.html) for incidents, natural events and operations, mainly as they apply to common scenarios in Puerto Rico.

A marker is an event emitter:

```js
 marker.on("click", function(map, marker, event, layer){
	console.log("I was clicked!!!");
});
```

ZMAP has a dedicated layer for markers, this layer is created automatically. When you do `marker.addTo(map)` it will be added to the marker layer.

You can create additional marker layers changing its type to overlay:

```js
var layer = new zmap.markerLayer("overlay");
map.addLayer(layer);

var p = zmap.marker([18.427831712734044, -67.154815531596], {title: "Aguadilla"});

p.addTo(layer); //add marker to this marker layer...
```


## Polyline ##

Create a layer with a line made from segments of locations.
```js
var points = [
	[18.50121284350313, -67.02502423159602], //isabela
	[18.427831712734044, -67.154815531596], //aguadilla
	[18.380158622329404, -67.18936743159603], //aguada
	[18.395134387931233, -67.11445683159602], //moca
];

var lyPolyLine = zmap.polygonLayer.polyline(points, {});
lyPolyLine.addTo(map);

map.requestDraw();
```

## Circle ##

```js
var lyCircle = zmap.polygonLayer.circle([18.427831712734044, -67.154815531596], {radius:50, strokeWidth: 2});

lyCircle.addTo(map);

if(map.getZoom() != 18){
	map.setZoom(18); //zoom out to see it better, will draw also
}else{
	//force a draw
	map.requestDraw();
}
```

## Polygon ##
```js
//Since our data is from a GeoJSON "feature" object, we use zmap.polygon.fromGeoJSONFeature() to get a polygon
var poly = zmap.polygon.fromGeoJSONFeature(aguadillaFeature);

var lyPoly = zmap.polygonLayer.polygon(poly);
lyPoly.addTo(map);

```


### LatLng ###

Represents a geographical location using latitude and longitude.

```js

	//create passing a latitude and longitude in degrees
	var latlng = new zmap.LatLng(18.42783, -67.1548);

	//create with a latitude and longitude array pair
	var pair = [18.42783, -67.1548];
	var latlng = new zmap.LatLng(pair);

	//create from a latitude and longitude string
	var astring = "{18.42783, -67.1548}";
	var latlng = new zmap.LatLng(astring);

	//create form any object that has the properties lat and lng
	var anObject = {lat: 18.42783, lng:-67.1548};
	var latlng = new zmap.LatLng(anObject);

```

| Methods | Description |
| -- | -- |
| clone() | Returns a copy of this LatLng object as a new instance. |
| toArray() | Returns an array with two items for the latitude and longitude values. |
| toString() | Returns a string representation of the LatLng. |
| toStringWithFormat(format, dp) | Returns a string representation in a traditional format. The format parameter is a string. Use format `"d"` to get a string of the location in degree, ex: `"018.4278°N, 067.1548°W"`. The format `"dm"` returns degree and minutes, ex: `"018°25.67′N, 067°09.29′W"`. The format `"dms"` is the common representation of a coordinate, it returns the degree, minutes and seconds, ex: `"018°25′40″N, 067°09′17″W"`. The format `"n"` returns the actual degree values similar to `toString()` with 4 decimal points, you may use the optional parameter `dp` to specify the actual decimal point precision. |
| moveBy(distance,bearing, earthRadius) | Returns a new LatLng object moved by `distance` given in meters in a direction given by the angle `bearing`. The optional parameter `earthRadius` is the datum radius used in calculations the default is `6371000` for WGS84.
| distanceTo(LatLng, maxMargin) | Returns approximate distance between start and end locations in meters. |
| isInsidePolygon(locations) | Returns true if this LatLng is inside a polygon defined by the array `locations`. Each element of the array is a polygon point in lat/lng coordinates eg: `[18.42, -67.15]`.
