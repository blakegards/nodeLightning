//*********************************************************************************************
// Dependencies - node.js 8.10 with below packages:
//					- turf (use 'npm install turf') - http://turfjs.org
//					- xml2js (use 'npm install xml2js') 
//					- dweetio (use 'npm install node-dweetio')
//---------------------------------------------------------------------------------------------
// 1. Reads in Earth Networks JSON file and reformats to a JSON object, which can be
// 		used with the Turf javascript library.
// 2. Overlays this layer with the existing Cambodia Communes dataset.
// 3. Outputs communes within the storm warning-area polygon (if any!)
//

//*********************************************************************************************
var dweetClient = require("node-dweetio");
var dweetio = new dweetClient();
var util = require('util');
const turf = require('turf');
const Fs = require('fs');
const parseString = require('xml2js').parseString;
const EarthNetworkDump = JSON.parse(Fs.readFileSync('./pplnneed_dta_testNorthWest.json')); // single polygon
const CambodiaCommunes = JSON.parse(Fs.readFileSync('./khm_adm3_wgs84_simplified.geojson')); // feature set of polygons
var AlertType;
var AlertIssuedUTC;

	
transform();

    function transform() {
			//EarthNetworkDump = JSON.parse(EarthNetworkDump); // single polygon
            console.log("Incoming Alert from Earth Networks. Alert Type: " + EarthNetworkDump.AlertType);
			AlertType = EarthNetworkDump.AlertTypeName
			AlertIssuedUTC =  EarthNetworkDump.IssuedDateTimeUtc
			//First process the Earthnetworks JSON file.
			var xml = EarthNetworkDump.RawMessage;
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
					var latlong = arrRes[i].split(" ").map(Number);
					latlong.reverse(); //choose between long-lat or lat-long!
					jenga.push(latlong);		
				}
				
				ENWarningPoly = turf.polygon([jenga], { name: 'WarningPoly' });
				console.log("Warning Polygon Created.");
				
				})
				
			process(ENWarningPoly);
		}
			

	function process(ENWarningPoly) {
			var responseData = [];
			console.log("Now checking for overlapping Cambodian Communes....");
			//console.log(EarthNetworkDump.RawMessage);
			var cntIntersect = 0
			for(var i = 0; i < CambodiaCommunes.features.length; i++) {
				var comName = CambodiaCommunes.features[i].properties.COM_NAME
				var comID = CambodiaCommunes.features[i].properties.COM_CODE
				var spatialCommune = CambodiaCommunes.features[i];
				var intersection = turf.intersect(ENWarningPoly, spatialCommune);

				if (intersection) {
					responseData[cntIntersect] = {CommuneName:comName,CommuneID:comID}; //,OverlapCoordinates:intersection.geometry.coordinates
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
			console.log("Check the output at: https://dweet.io/get/latest/dweet/for/PINLightningReport");
			})	
	};
	
	
	
	

