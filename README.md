# nodeLightning

//*********************************************************************************************
### Dependencies 
- node.js 8.10 with below packages:
- turf (use 'npm install turf') - http://turfjs.org
- xml2js (use 'npm install xml2js') 
- dweetio (use 'npm install node-dweetio')
---------------------------------------------------------------------------------------------
 1. Reads in Earth Networks JSON file and reformats to a JSON object, which can be
 		used with the Turf javascript library.
 2. Overlays this layer with the existing Cambodia Communes dataset (JSON format)
 3. Outputs communes within the storm warning-area polygon (if any!) to a dweet.io web page
		results visible for 24hr on dweet.io (there is a character limit of 2000 chars).

### PARAMETERS
 #### CambodiaCommunes
A geojson export of the commune shapefile. It has been simplified
to reduce the complexity and length of the geojson files, so boundaries 
are approximate.
 #### Inputs 
 The Amazon Lambda function executes on the event where a JSON file is loaded to the
 s3 bucket (configured in Lambda settings). This script expects a JSON file formatted
 as per the Earth Networks example file. It contains XML data embedded inside the
 JSON file, so this script deals with both JSON and XML to extract the coordinates
 of the stormfront.

### KNOWN ISSUES
 - Spatial data must be in WGS84 lat/longs. 
 - The commune spatial data has been generalized to reduce the complexity and therefore
		number of coordinate pairs, to speed up processing. Some boundaries may be inaccurate,
		but overall should be fit for purpose.
 - Check the Amazon Log files for console output.
 - Check https://dweet.io/get/latest/dweet/for/PINLightningReport for latest processing results,
			dweet.io data is deleted after 24hrs.

			
//*********************************************************************************************

			
Find the intersection of two features.

Default setup is for Cambodia Commune Polygon *vs* Earth Networks JSON Stormfront data.

Uses the turf js engine - https://github.com/Turfjs/turf

### `turf.intersect(poly1, poly2)`

Takes two Polygon|polygons and finds their intersection. If they share a border, returns the border; if they don't intersect, returns undefined.

### Example

```js
var poly1 = {
  "type": "Feature",
  "properties": {
    "fill": "#0f0"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-122.801742, 45.48565],
      [-122.801742, 45.60491],
      [-122.584762, 45.60491],
      [-122.584762, 45.48565],
      [-122.801742, 45.48565]
    ]]
  }
}
var poly2 = {
  "type": "Feature",
  "properties": {
    "fill": "#00f"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-122.520217, 45.535693],
      [-122.64038, 45.553967],
      [-122.720031, 45.526554],
      [-122.669906, 45.507309],
      [-122.723464, 45.446643],
      [-122.532577, 45.408574],
      [-122.487258, 45.477466],
      [-122.520217, 45.535693]
    ]]
  }
}

var polygons = {
  "type": "FeatureCollection",
  "features": [poly1, poly2]
};

var intersection = turf.intersect(poly1, poly2);

//=polygons

//=intersection
```
**Returns** `Feature.<Polygon>,Feature.<MultiLineString>`, if `poly1` and `poly2` overlap, returns a Polygon feature representing the area they overlap; if `poly1` and `poly2` do not overlap, returns `undefined`; if `poly1` and `poly2` share a border, a MultiLineString of the locations where their borders are shared

## Installation

Requires [nodejs](http://nodejs.org/).

```sh
$ npm install @turf/intersect
```

## Tests

```sh
$ npm test
```
