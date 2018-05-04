//*********************************************************************************************
//*********************************************************************************************
// Dependencies - node.js 8.10 with below packages:
//					- turf (use 'npm install turf') - http://turfjs.org
//					- xml2js (use 'npm install xml2js') 
//					- dweetio (use 'npm install node-dweetio')
//---------------------------------------------------------------------------------------------
// 1. Reads in Earth Networks JSON file and reformats to a JSON object, which can be
// 		used with the Turf javascript library.
// 2. Overlays this layer with the existing Cambodia Communes dataset (JSON format)
// 3. Outputs communes within the storm warning-area polygon (if any!) to a dweet.io web page
//		results visible for 24hr on dweet.io (there is a character limit of 2000 chars).
// 4. Also outputs a js parameter to the s3 bucket. This is visible on the sample  PIN webmap.
//		it is hardcoded to https://s3-ap-southeast-1.amazonaws.com/gis-earthnetworks/stormWarningArea.js
//PARAMETERS------------------
// CambodiaCommunes - this is a geojson export of the commune shapefile. It has been simplified
//						to reduce the complexity and length of the geojson files, so boundaries 
//						are approximate.
// Inputs - the Amazon Lambda function executes on the event where a JSON file is loaded to the
//			s3 bucket (configured in Lambda settings). This script expects a JSON file formatted
//			as per the Earth Networks example file. It contains XML data embedded inside the
//			JSON file, so this script deals with both JSON and XML to extract the coordinates
//			of the stormfront.
//
//KNOWN ISSUES----------------
// - Spatial data must be in WGS84 lat/longs. 
// - The commune spatial data has been generalized to reduce the complexity and therefore
//		number of coordinate pairs, to speed up processing. Some boundaries may be inaccurate,
//		but overall should be fit for purpose.
// - Check the Amazon Log files for console output.
// - Check https://dweet.io/get/latest/dweet/for/PINLightningReport for latest processing results,
//			dweet.io data is deleted after 24hrs.
//*********************************************************************************************
//*********************************************************************************************

var dweetClient = require("node-dweetio");
var dweetio = new dweetClient();
var async = require('async');
var AWS = require('aws-sdk');
var util = require('util');
var s3 = new AWS.S3();
const turf = require('turf');
const Fs = require('fs');
const parseString = require('xml2js').parseString;
const CambodiaCommunes = JSON.parse(Fs.readFileSync('./khm_adm3_wgs84_simplified.geojson')); // feature set of polygons
var AlertType;
var AlertIssuedUTC;

exports.handler = function(event, context, callback) {
	
	
try{
	//Read event from bucket.
	var srcBucket = event.Records[0].s3.bucket.name;
	// Object key may have spaces or unicode non-ASCII characters.
	var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));  
	
	// Infer the correct file type.
	var typeMatch = srcKey.match(/\.([^.]*)$/);
	if (!typeMatch) {
		callback("Could not determine the file type.");
		return;
	}
	var fileType = typeMatch[1];
	if (fileType != "json") {
		callback('Unsupported file type, expecing JSON!');
		return;
	}
}
catch(err) {
	dweetio.dweet_for("PINLightningReport", {Status:"Error in event processing: " + err}, function(err, dweet){
	console.log("Check the output at: https://dweet.io/get/latest/dweet/for/PINLightningReport (the dweet limit is 2000chars)");
	})
}
		
 // Download the json file from S3, analyize it.
async.waterfall([
	function download(next) {
		// Download the file from S3 into a buffer.
		s3.getObject({Bucket: srcBucket, Key: srcKey}, next);
		},
	function transform(response, next) {
		try {
			const EarthNetworkDump = JSON.parse(response.Body); // single polygon
			console.log("Incoming Alert from Earth Networks. Alert Type: " + EarthNetworkDump.AlertType);
			//First process the Earthnetworks JSON file.
			var xml = EarthNetworkDump.RawMessage;
			AlertType = EarthNetworkDump.AlertTypeName
			AlertIssuedUTC =  EarthNetworkDump.IssuedDateTimeUtc
			var warningPolyXML;
			var ENWarningPoly;			
			
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
					var latlong = arrRes[i].split(" ").map(Number); //split and convert to number
					latlong.reverse(); //choose between long-lat or lat-long!
					jenga.push(latlong);		
				}
				ENWarningPoly = turf.polygon([jenga], { name: 'WarningPoly' });
				console.log("Warning Polygon Created.");
				})				
			}
		catch(err) {
					dweetio.dweet_for("PINLightningReport", {Status:"Error in function [transform]: " + err}, function(err, dweet){
					console.log("Check the output at: https://dweet.io/get/latest/dweet/for/PINLightningReport (the dweet limit is 2000chars)");
						})
					}

		//call function to perform the intersection.	
		process(ENWarningPoly);
		//function to export the polygon JSON as a javascript object, and upload to s3
		//it can then be consumed by the webmap.
		outputStormWarning(ENWarningPoly);
	}
		], 
		
	function (err) {
				if (err) {
					console.error(
						'Unable to analyze ' + srcBucket + '/' + srcKey +
						' due to an error: ' + err
					);
				} else {
					console.log(
						'Successfully analyzed the file ' + srcBucket + '/' + srcKey
					);
			}

			callback(null, "Error");
	}
)

function process(ENWarningPoly) {
		
		try{
			var responseData = [];
			console.log("Now checking for overlapping Cambodian Communes....");
			var cntIntersect = 0
			for(var i = 0; i < CambodiaCommunes.features.length; i++) {
				var comName = CambodiaCommunes.features[i].properties.COM_NAME
				var comID = CambodiaCommunes.features[i].properties.COM_CODE
				var spatialCommune = CambodiaCommunes.features[i];
				var intersection = turf.intersect(ENWarningPoly, spatialCommune);

				if (intersection) {
					responseData[cntIntersect] = {CommuneName:comName,CommuneID:comID}; 
					console.log("Alert! Warning area intersects the Cambodian Commune of " + comName);
					//console.log(intersection);
					//console.log(intersection.geometry.coordinates);
					cntIntersect += 1
				} 
			}
			console.log("Completed analysis of " + String(i) + " communes.");
			if (cntIntersect == 0) {
				console.log("No communes at risk from stormfront.");
				responseData[cntIntersect] = {Status:"No communes at risk from stormfront."};
			}
		
			var utctime = new Date().toISOString()
			dweetio.dweet_for("PINLightningReport", {ReportTime:utctime,ENAlertType:AlertType,ENAlertTime:AlertIssuedUTC,CommunesAnalysed:i,CommunesAtRisk:(cntIntersect),Report:{responseData}}, function(err, dweet){
			console.log("Check the output at: https://dweet.io/get/latest/dweet/for/PINLightningReport (the dweet limit is 2000chars)");
			})	
		}
		catch(err) {
			dweetio.dweet_for("PINLightningReport", {Status:"Error in function [process]: " + err}, function(err, dweet){
			console.log("Check the output at: https://dweet.io/get/latest/dweet/for/PINLightningReport (the dweet limit is 2000chars)");
			})
		}

}

function outputStormWarning(warning_area) {
		upload_path = '/tmp/stormWarningArea.js'
		warning_area_string = "var stormArea = " + JSON.stringify(warning_area); + ";"
		var params = {Bucket: 'gis-earthnetworks', Key: 'stormWarningArea.js', Body: warning_area_string, ACL: 'public-read'};
		s3.upload(params, function(err, data) {
		console.log(err, data);
});

	
};
}
