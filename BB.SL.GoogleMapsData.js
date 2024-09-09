/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
  *@NModuleScope public
 */
  define(['N/query', 'N/file', 'N/search'],
  function (query, file, search) {
 
     function onRequest(context) {
             //var coordinates = [];
             log.debug('getmapdata payload', context.request.parameters);
             log.debug('period',   context.request.parameters["data[period]"]);
             var period = context.request.parameters["data[period]"];
             if (!period) period = 'All';
             //log.debug('payload body', payload.period);
             var fileid;
             var defaultlocation = ''
             if (period){
                 var customrecord_tsp_google_maps_cache_dataSearchObj = search.create({
                     type: "customrecord_bb_google_maps_cache_data",
                     filters:
                     [
                         ["name","is",period]
                     ],
                     columns:
                     [
                        search.createColumn({
                           name: "name",
                           sort: search.Sort.ASC,
                           label: "Name"
                        }),
                        search.createColumn({name: "custrecord_bb_gm_saved_search", label: "Saved Search"}),
                        search.createColumn({
                           name: "internalid",
                           join: "file",
                           label: "Internal ID"
                        }),
                        search.createColumn({name: "custrecord_bb_gmaps_default_locationtext", label: "Default Location"})
                     ]
                  });
                  var searchResultCount = customrecord_tsp_google_maps_cache_dataSearchObj.runPaged().count;
                  log.debug("customrecord_bb_google_maps_cache_dataSearchObj result count",searchResultCount);
                  if (searchResultCount == 0) fileid = '';
                  customrecord_tsp_google_maps_cache_dataSearchObj.run().each(function(result){
                     log.debug('search result', result);
                     fileid = result.getValue({
                         name: "internalid",
                         join: "file"
                     });
                     defaultlocation = result.getValue({
                         name: 'custrecord_bb_gmaps_default_locationtext'
                     })
                     log.debug('file id in search', {fileid:fileid, default:defaultlocation});
                     return true;
                  });
             }
             if (fileid){
             var fileObj = file.load({
                 id: fileid
             });
             var obj = {};
             var contents = fileObj.getContents();
             obj.contents = contents;
             if (defaultlocation) obj.default = defaultlocation
             log.debug('context', obj);
         } else {
             var contents = [];
         }
 
 
             context.response.write(JSON.stringify(obj));
             return 
     }
 
     return {
         onRequest: onRequest
     }
 });
 