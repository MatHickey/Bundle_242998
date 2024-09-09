/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/search', 'N/runtime', 'N/file'],
	
    function(search, runtime, file) {
        function onRequest(context) {
          return;
        	//log.debug('context',context);
        	var request = context.request;
        	var method = request.method;  /* DELETE  GET  HEAD  PUT  POST */
            var response = context.response;

            // parameters.....
            var data = request.parameters.data || null;

			// exit if no data
			if(!data){
				response.setHeader({name: 'Content-Type',value: 'application/json; charset=utf-8'});
				response.write( JSON.stringify({"success":false, "message":'No data sent'}) );
				return;
			}
            if(!util.isObject(data)) data = JSON.parse(data);
			log.debug({title:'data',details:data});
			var output = {"success":false}

			try{
				// if no title we create one that can be found/edited later
				var title = data.title ? data.title : "$NT$"+new Date().getTime();
				var id = data.id;
				var scriptId = data.scriptId;
				var isPublic = data.isPublic || false;
				var settings = data.settings && data.settings.length ? data.settings : null;
				var recType = data.type;

				var filters = data.filters;
				var columns = [];
				var columnData = data.columns;
				// data from JSON object does not match the params to create the column
				for(var c=0; c<columnData.length; c++){
					var colObj = columnData[c];
					columns.push( search.createColumn({
						name: colObj.name,
						join: colObj.join ? colObj.join : null,
						label: colObj.label,
						sort: colObj.sortdir ? colObj.sortdir : null,
						summary: colObj.summary ? colObj.summary : null,
						formula: colObj.formula ? colObj.formula : null,
						function: colObj.function ? colObj.function : null
						})
					);
				}

				// make sure the search id isn't account specific to avoid conflicts
				if(scriptId=='customsearch'+id){
					scriptId = 'customsearch_id_'+id;
				}

				//replace it when it already exist
				try{
					search.delete({id:scriptId});

					// var oldSearch = search.load({
					// 	id: scriptId
					// });
					// if(oldSearch){
					// 	scriptId = scriptId.replace('customsearch','customsearch1');
					// 	title = "1*"+title;
					// }
				} catch (e) {
					//log.error(e.name,e.message);
				}

				var newSearchId = search.create({
					type: recType,
					filters: filters,
					columns: columns,
					settings: settings,
					title: title,
					id: scriptId,
					isPublic: isPublic
				}).save();
				output.success = true;
				output.id = newSearchId;
				output.scriptId = scriptId;
			} catch (e) {
				log.error(e.name, e.message);
				output.error = e.name;
				output.message = e.message;
			}

			// force the response to be JSON
			response.setHeader({
				name: 'Content-Type',
				value: 'application/json; charset=utf-8',
			});
			response.write( JSON.stringify(output) );
			return;

        }
        
        return {
            onRequest: onRequest
        };
});
