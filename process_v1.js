//*********************************************************************************************
// Dependencies - node.js 8.10 with below packages:
//					- turf (use 'npm install turf') - http://turfjs.org
//					- xml2js (use 'npm install xml2js') 
//---------------------------------------------------------------------------------------------
// 1. Reads in Earth Networks JSON file and reformats to a JSON object, which can be
// 		used with the Turf javascript library.
// 2. Overlays this layer with the existing Cambodia Communes dataset.
// 3. Outputs communes within the storm warning-area polygon (if any!)
//

//*********************************************************************************************

const turf = require('turf');
const Fs = require('fs');
const parseString = require('xml2js').parseString;
const EarthNetworkDump = JSON.parse(Fs.readFileSync('./pplnneed_dta_20170908_090828.json')); // single polygon
const CambodiaCommunes = JSON.parse(Fs.readFileSync('./khm_adm3_wgs84_simplified.geojson')); // feature set of polygons

//First process the Earthnetworks JSON file.
var xml = EarthNetworkDump.RawMessage;
var warningPolyXML;
var ENWarningPoly;
console.log("Incoming Alert from Earth Networks. Alert Type: " + EarthNetworkDump.AlertType);
parseString(xml, function (err, result) {
    //Deconstruct the xml, reformat coordinates into a JSON object.
	warningPolyXML = result.alert.info[0].area[0].polygon;
	var res = String(warningPolyXML);	
	//load into array so we can switch lat longs to the correct order
	//then rebuild a new array, and insert into a new JSON object.
	//uses the turf librarys' JSON polygon object.
	arrRes = res.split(", ");	
	var jenga = []
	for (var i = 0; i < arrRes.length; i++) {
		var latlong = arrRes[i].split(" ").map(Number);
		latlong.reverse(); //choose between long-lat or lat-long!
		jenga.push(latlong);		
	}
	
	ENWarningPoly = turf.polygon([jenga], { name: 'WarningPoly' });
});


console.log("Now checking for overlapping Cambodian Communes....");
//console.log(EarthNetworkDump.RawMessage);
for(var i = 0; i < CambodiaCommunes.features.length; i++) {
	var comName = CambodiaCommunes.features[i].properties.COM_NAME
	var spatialCommune = CambodiaCommunes.features[i];
	var intersection = turf.intersect(ENWarningPoly, spatialCommune);

	if (intersection) {
		console.log("Alert! Warning area intersects the Cambodian Commune of " + comName);
		console.log(intersection);
		console.log(intersection.geometry.coordinates);
	} else {
		console.log("No intersection for commune " + comName);
	}}

console.log("Completed analysis of " + String(i) + " communes.");




//exports.handler = function(event, context, callback) {
//	var intersection = turf.intersect(poly1, poly2);
//	console.log(intersection.geometry.coordinates);
//	callback(intersection.geometry.coordinates);
//}

