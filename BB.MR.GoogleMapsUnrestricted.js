/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/file', 'N/runtime'], function (search, record, file, runtime) {
   var gmrecord;
   function getInputData() {
      var me = runtime.getCurrentScript();
      gmrecord = me.getParameter({ name: 'custscript_bb_gm_cache_record_list' });
      if (!gmrecord) return;
      var fieldLookUp = search.lookupFields({
         type: 'customrecord_bb_google_maps_cache_data',
         id: gmrecord,
         columns: ['custrecord_bb_gm_saved_search']
      });
      var searchid = fieldLookUp.custrecord_bb_gm_saved_search[0].value
      if (!searchid) return;
      return search.load({
         id: searchid
      });
   }

   function map(context) {
      log.debug('context', context);
      var rec = JSON.parse(context.value);
      // log.debug('values', rec);
      var lat = rec.values.custentity_bb_entity_latitude_text
      var long = rec.values.custentity_bb_entity_longitude_text;


      log.debug('search', { lat: lat, long: long });
      context.write(1, lat + ',' + long);
      //return context;
   }

   function reduce(context) {
      var me = runtime.getCurrentScript();
      var gmrecord = me.getParameter({ name: 'custscript_bb_gm_cache_record_list' });
      var fieldLookUp = search.lookupFields({
         type: 'customrecord_bb_google_maps_cache_data',
         id: gmrecord,
         columns: ['name']
      });
      var cachename = fieldLookUp.name;
      log.audit('reduce context', context);
      var key = context.key;
      log.debug('reduce key', key);
      var searchfilter = context.values;
      log.debug('reduce search filter', searchfilter);
      log.debug('reduce search filter length', searchfilter.length);
      var coordinates = [];
      try {
         var fileObj = file.create({
            name: 'googlemaps' + cachename + '.txt',
            fileType: file.Type.PLAINTEXT,
            contents: JSON.stringify(searchfilter)
         });
         //find folder id
         var folderid = '';
         var folderSearchObj = search.create({
            type: "folder",
            filters:
               [
                  ["name", "is", "googlemapsdata"]
               ],
            columns:
               [
                  search.createColumn({ name: "internalid", label: "Internal ID" })
               ]
         });
         var searchResultCount = folderSearchObj.runPaged().count;
         log.debug("folderSearchObj result count", searchResultCount);
         if (searchResultCount == 0) {
            var objRecord = record.create({
               type: record.Type.FOLDER,
               isDynamic: true
            });
            objRecord.setValue({
               fieldId: 'name',
               value: 'googlemapsdata'
            });
            folderId = objRecord.save({
               enableSourcing: true,
               ignoreMandatoryFields: true
            });

         }
         folderSearchObj.run().each(function (result) {
            folderid = result.getValue('internalid');
            log.debug('folder id', folderid);
            // .run().each has a limit of 4,000 results
            return true;
         });
         fileObj.folder = folderid;

         var id = fileObj.save();
         log.debug('id', id);
         var attach = record.attach({
            record: {
               type: 'file',
               id: id
            },
            to: {
               type: 'customrecord_bb_google_maps_cache_data',
               id: gmrecord
            }
         });
      } catch (e) {
         log.debug('file error', e);
      }

      // try {
      //     var jobSearchObj = search.load({
      //         id: String(searchfilter)
      //     });
      //     var searchResultCount = jobSearchObj.runPaged().count;
      //     log.debug("jobSearchObj result count", searchResultCount);
      //     try {
      //         jobSearchObj.run().each(function (result) {
      //             var lat = result.getValue('custentity_bb_entity_latitude_text');
      //             var long = result.getValue('custentity_bb_entity_longitude_text');
      //             log.debug('coordinate values', { lat: lat, long: long });
      //             if (lat && long) coordinates.push(lat + ',' + long);
      //             // .run().each has a limit of 4,000 results
      //             return true;
      //         });
      //     } catch (e) {
      //         log.debug('try catch', e);
      //     }
      //     log.debug('coordinates', coordinates);
      //     record.submitFields({
      //         type: 'customrecord_tsp_google_maps_cache_data',
      //         id: key,
      //         values: { custrecord_tsp_gm_coordinate_text: JSON.stringify(coordinates)},
      //         options: {
      //             enablesourcing: true
      //         }
      //     });
      // } catch (e) {
      //     log.debug('return error', e);
      // }
   }

   function summarize(summary) {
      var latavg = 0;
      var lngavg = 0;
      var me = runtime.getCurrentScript();
      var gmrecord = me.getParameter({ name: 'custscript_bb_gm_cache_record_list' });
      var fieldLookUp = search.lookupFields({
         type: 'customrecord_bb_google_maps_cache_data',
         id: gmrecord,
         columns: ['custrecord_bb_gm_saved_search']
      });
      var searchid = fieldLookUp.custrecord_bb_gm_saved_search[0].value
      var avglookup = search.load({
         id: searchid
      });
      var columns = [
         search.createColumn({
            name: "entityid",
            summary: "COUNT",
            sort: search.Sort.ASC,
            label: "ID"
         }),
         search.createColumn({
            name: "formulanumeric",
            summary: "SUM",
            formula: "TO_NUMBER{custentity_bb_entity_latitude_text}",
            label: "Formula (Numeric)"
         }),
         search.createColumn({
            name: "formulanumeric",
            summary: "SUM",
            formula: "TO_NUMBER{custentity_bb_entity_longitude_text}",
            label: "Formula (Numeric)"
         })
      ]
      avglookup.columns = columns;
      var searchResultCount = avglookup.runPaged().count;
      log.debug("164 jobSearchObj result count", searchResultCount);
      avglookup.run().each(function (result) {
         try {
            log.debug('summarize result', result);
            var resultJSON = result.toJSON();
            var values = resultJSON.values;
            log.debug('values', values);
            var lat = values["SUM(formulanumeric)"];
            var lng = values["SUM(formulanumeric)_1"];
            var totallines = result.getValue({
               name: "entityid",
               summary: "COUNT"
            })
            latavg = parseFloat(latavg) + parseFloat(lat) / parseFloat(totallines);
            lngavg = parseFloat(lngavg) + parseFloat(lng) / parseFloat(totallines);
         } catch (e) {
            log.debug('search issue', e);
         }
         // .run().each has a limit of 4,000 results
         return true;
      });
      log.debug('final coords', { coords: [latavg, lngavg], gmrecord: gmrecord });
      if (gmrecord) {
         if (latavg > 0 && lngavg > 0) {
            record.submitFields({
               type: 'customrecord_bb_google_maps_cache_data',
               id: gmrecord,
               values: {
                  custrecord_bb_gmaps_default_locationtext: latavg + ", " + + lngavg
               }

            });
         } else {
            record.submitFields({
               type: 'customrecord_bb_google_maps_cache_data',
               id: gmrecord,
               values: {
                  custrecord_bb_gmaps_default_locationtext: ''
               }

            });
         }

      }
   }

   return {
      getInputData: getInputData,
      map: map,
      reduce: reduce,
      summarize: summarize
   }
});
