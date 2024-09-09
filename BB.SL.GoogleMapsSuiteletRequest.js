/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 *@NModuleScope SameAccount
 * author: zbilliet
 * june 14,2021
 */

 define(['N/crypto', 'N/encode', 'N/search', 'N/runtime', 'N/query'], function (crypto, encode, search, runtime, query) {
    function onRequest(params) {
        var account = runtime.accountId;
        log.debug('account', account);
        var me = runtime.getCurrentScript();
        var sql = 'SELECT custrecord_system_token FROM customrecord_system_credentials WHERE name = ?';
        var results = query.runSuiteQL({ query: sql, params: ['GoogleMapsHeatmap'] });
        results = results.asMappedResults();

        log.debug('results', results);
        if (results.length == 0) throw 'Please add an entry in the System Credentials record for GoogleMapsHeatmap with your API key in the Token field.'
        var apikey = results[0].custrecord_system_token;
        //var apikey = me.getParameter({ name: 'custscript_bbss_gmaps_api_key_text' });
        var defaultcenter = me.getParameter({ name: 'custscript_bbss_gmaps_default_location' });
        if (!defaultcenter) defaultcenter = 'lat: 39.8097, lng: -98.35'; //set to middle of us by default
        if (!apikey) {
            throw ('No api key');
        }
        // retrieve gmaps cache deployment id
        var scriptid = '';
        var scriptdeploymentSearchObj = search.create({
            type: "scriptdeployment",
            filters:
                [
                    ["script.name", "is", "BB.SL.ReturnDataCacheGMaps"],
                    "AND",
                    ["status", "anyof", "RELEASED"]
                ],
            columns:
                [
                    search.createColumn({
                        name: "title",
                        sort: search.Sort.ASC,
                        label: "Title"
                    }),
                    search.createColumn({ name: "scriptid", label: "Custom ID" }),
                    search.createColumn({ name: "script", label: "Script ID" }),
                    search.createColumn({ name: "recordtype", label: "Record Type" }),
                    search.createColumn({ name: "status", label: "Status" })
                ]
        });
        var searchResultCount = scriptdeploymentSearchObj.runPaged().count;
        log.debug("scriptdeploymentSearchObj result count", searchResultCount);
        scriptdeploymentSearchObj.run().each(function (result) {
            scriptid = result.getValue('script');
            log.debug('script id', scriptid);
            // .run().each has a limit of 4,000 results
            return true;
        });

        var evhtml = `<!DOCTYPE html>
        <html>
        
        <head>
            <title>Heatmaps</title>
            <script src="https://polyfill.io/v3/polyfill.min.js?features=default"></script>
            <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
            <style type="text/css">
                /* Always set the map height explicitly to define the size of the div
               * element that contains the map. */
                #map {
                    height: 100%;
                }
        
                /* Optional: Makes the sample page fill the window. */
                html,
                body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                }
        
                button {
                    display: block;
                    height: 50px;
                    width: 100px;
                }
                button:focus {
                    /* Provide a fallback style for browsers
                       that don't support :focus-visible */
                    outline: none;
                    background: lightgrey;
                  }
                  
                  button:focus:not(:focus-visible) {
                    /* Remove the focus indicator on mouse-focus for browsers
                       that do support :focus-visible */
                    background: transparent;
                  }
                  
                  button:focus-visible {
                    /* Draw a very noticeable focus style for
                       keyboard-focus on browsers that do support
                       :focus-visible */
                    outline: 4px dashed darkorange;
                    background: transparent;
                  }
                  button:active { color: lightgrey; }  
                  
                  
        
                #floating-panel {
                    position: absolute;
                    top: 10px;
                    border-radius: 4px;
                    z-index: 5;
                    background-color: #fff;
                    padding: 5px;
                    border: 1px solid #999;
                    text-align: center;
                    font-family: "Roboto", "sans-serif";
                    line-height: 30px;
                    line-height: 30px;
                    margin-left: 10px;
                    margin-top: 50px;
                    display: block;
                }
        
                #pac-input {
                    left: 25%;
                    z-index: 10;
                    border-radius: 2.5px;
                    background-color: #fff;
                    border: 1px solid #999;
                    text-align: center;
                    font-family: "Roboto", "sans-serif";
                    line-height: 15px;
                    margin-top: .6%;
                    width: 30%;
                    height: 38px;
                }
            </style>
            <script>
                // This example requires the Visualization library. Include the libraries=visualization
                // parameter when you first load the API. For example:
                let map, heatmap;
                var mapCoordinates = [];
                function initMap() {
                    getPoints('All');
                    map = new google.maps.Map(document.getElementById("map"), {
                        zoom: 6.3,
                        maxZoom: 15,
                        radius: 20,
                        opacity: .7,
                        center: {` + defaultcenter + `},
                        mapTypeId: "roadmap"
                    });
                    infoWindow = new google.maps.InfoWindow();
                    searchBar();
                    heatmap = new google.maps.visualization.HeatmapLayer({
                        data: mapCoordinates,
                        map: map,
                    });
                    heatmap.setOptions({
                        dissipating: true,
                        maxIntensity: 50,
                        radius: 20,
                        opacity: .7,
                        maxZoom: 15
                        //dissipating: false
                    });
        
        
        
        
        
        
                }
        
                function searchBar() {
                    console.log('before search bar');
                    const input = document.getElementById("pac-input");
                    const searchBox = new google.maps.places.SearchBox(input);
                    console.log('input search bar');
                    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
                    // Bias the SearchBox results towards current map's viewport.
                    map.addListener("bounds_changed", () => {
                        searchBox.setBounds(map.getBounds());
                    });
                    console.log('bounds search bar');
                    let markers = [];
                    // Listen for the event fired when the user selects a prediction and retrieve
                    // more details for that place.
                    searchBox.addListener("places_changed", () => {
                        const places = searchBox.getPlaces();
                        console.log('places search bar');
                        if (places.length == 0) {
                            return;
                        }
                        // Clear out the old markers.
                        markers.forEach((marker) => {
                            marker.setMap(null);
                        });
                        markers = [];
                        // For each place, get the icon, name and location.
                        const bounds = new google.maps.LatLngBounds();
                        console.log('bounds 2 search bar');
                        places.forEach((place) => {
                            if (!place.geometry || !place.geometry.location) {
                                console.log("Returned place contains no geometry");
                                return;
                            }
                            const icon = {
                                url: place.icon,
                                size: new google.maps.Size(71, 71),
                                origin: new google.maps.Point(0, 0),
                                anchor: new google.maps.Point(17, 34),
                                scaledSize: new google.maps.Size(25, 25),
                            };
                            // Create a marker for each place.
                            markers.push(
                                new google.maps.Marker({
                                    map,
                                    icon,
                                    title: place.name,
                                    position: place.geometry.location,
                                })
                            );
        
                            if (place.geometry.viewport) {
                                // Only geocodes have viewport.
                                bounds.union(place.geometry.viewport);
                            } else {
                                bounds.extend(place.geometry.location);
                            }
                        });
                        map.fitBounds(bounds);
                        console.log('map fit bounds');
                    });
                }
        
        
        
                function handleLocationError(browserHasGeolocation, infoWindow, pos) {
                    infoWindow.setPosition(pos);
                    infoWindow.setContent(
                        browserHasGeolocation
                            ? "Error: The Geolocation service failed."
                            : "Error: Your browser doesn't support geolocation."
                    );
                    infoWindow.open(map);
                }
                function myLocation() {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                const pos = {
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude,
                                };
                                infoWindow.setPosition(pos);
                                infoWindow.setContent("Location found.");
                                infoWindow.open(map);
                                map.setCenter(pos);
                            },
                            () => {
                                handleLocationError(true, infoWindow, map.getCenter());
                            }
                        );
                    } else {
                        // Browser doesn't support Geolocation
                        handleLocationError(false, infoWindow, map.getCenter());
                    }
                }
        
                function toggleHeatmap() {
                    heatmap.setMap(heatmap.getMap() ? null : map);
                    heatmap.setOptions({
                        dissipating: true,
                        maxIntensity: 50,
                        radius: 20,
                        opacity: .7,
                        //dissipating: false
                    });
                }
        
        
                function changeGradient() {
                    const gradient = [
                        "rgba(0, 255, 255, 0)",
                        "rgba(0, 255, 255, 1)",
                        "rgba(0, 191, 255, 1)",
                        "rgba(0, 127, 255, 1)",
                        "rgba(0, 63, 255, 1)",
                        "rgba(0, 0, 255, 1)",
                        "rgba(0, 0, 223, 1)",
                        "rgba(0, 0, 191, 1)",
                        "rgba(0, 0, 159, 1)",
                        "rgba(0, 0, 127, 1)",
                        "rgba(63, 0, 91, 1)",
                        "rgba(127, 0, 63, 1)",
                        "rgba(191, 0, 31, 1)",
                        "rgba(255, 0, 0, 1)",
                    ];
                    heatmap.set("gradient", heatmap.get("gradient") ? null : gradient);
                }
        
                function changeRadius() {
                    heatmap.set("radius", heatmap.get("radius") == 20 ? 80 : 20);
                }
        
                function changeOpacity() {
                    heatmap.set("opacity", heatmap.get("opacity") == 1 ? 0.2 : 1);
                }
                function toggle30days() {
                    mapCoordinates = [];
                    getPoints('30days');
                }
                function toggle7days() {
                    mapCoordinates = [];
                    getPoints('7days');
                }
                function toggleOpen() {
                    mapCoordinates = [];
                    getPoints('Open');
                }
                function toggleAll() {
                    mapCoordinates = [];
                    getPoints('All');
                }
        
                // Heatmap data: 500 Points
                function getPoints(period) {
                    console.log('in period ' + period);
        
                    $.post("https://` + account + `.app.netsuite.com/app/site/hosting/scriptlet.nl?script=` + scriptid + `&deploy=1", { "data": { "action": "getMapData", period: period } }, function (result) {
                        try {
                            console.log('results default ' + result.default);
                            
                            var coordinates = result.contents;
                           // console.log(typeof coordinates);
                           // console.log('results coords ' + coordinates);
                            var latlngbounds = new google.maps.LatLngBounds();
                            coordinates = JSON.parse(coordinates);
                            for (var c = 0; c < coordinates.length; c++) {
                              //  console.log(coordinates[c]);
                                var coordstring = String(coordinates[c])
                                var latLng = coordstring.split(',');
                                var location = new google.maps.LatLng(latLng[0], latLng[1])
                                mapCoordinates.push(location);
                                latlngbounds.extend(location);
                            }
                            //console.log('map coords ' + mapCoordinates);
                            if (period) {
                                  heatmap.setMap(heatmap.getMap() ? null : map);
                                heatmap = new google.maps.visualization.HeatmapLayer({
                                    data: mapCoordinates,
                                    map: map,
                                });
                                heatmap.setOptions({
                                    dissipating: true,
                                    maxIntensity: 50,
                                    radius: 20,
                                    opacity: .7,
                                    maxZoom: 15
                                    //dissipating: false
                                });
                                if (result.default){
                                    var defaults = result.default;
                                    defaults = defaults.split(',');
                                    console.log(defaults);
                                var defaultcoords = {
                                    lat: parseFloat(defaults[0]),
                                    lng: parseFloat(defaults[1])
                                }
                                console.log('default coords' + defaultcoords);
                                map.setCenter(defaultcoords);
                            };
                               
                               
                             
                            } else {
                                initMap();
                            }
        
                        } catch (e) {
                            console.error(e);
                        }
                    }, 'json');
        
                }
            </script>
        </head>
        
        <body>
            <div id="floating-panel">
                <button onclick="toggleHeatmap()">Toggle Heatmap</button>
                <button onclick="changeGradient()">Change gradient</button>
                <button onclick="toggleAll()">All Projects</button>
                <button onclick="toggle7days()">Past 7 Days</button>
                <button onclick="toggle30days()">Past 30 Days</button>
                <button onclick="toggleOpen()">Active Projects</button>
                <button onclick="myLocation()">My Location</button>
                <div id="top">
                </div>
                <div>
                    <input id="pac-input" type="text" placeholder="Enter Address">
        
                </div>
            </div>
            <div id="map"></div>
        
            <!-- Async script executes immediately and must be after any DOM elements used in callback. -->
            <script
                src="https://maps.googleapis.com/maps/api/js?key=` + apikey + `&callback=getPoints&libraries=visualization,places&v=weekly"
                async></script>
        </body>
        
        </html>`

        params.response.write({ output: evhtml });
    }

    return {
        onRequest: onRequest
    };
});