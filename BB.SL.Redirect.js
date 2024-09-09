/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/redirect','N/search'],
	
    function(redirect, search) {
        function onRequest(context) {
        	//log.debug('context',context);
			var request = context.request;
			var response = context.response;

			// parameters.....
			var rectype = request.parameters.rectype || null;
			var recid = request.parameters.recid || null;
			var edit = String(request.parameters.e).toUpperCase() == 'T'

			var searchCustId = request.parameters.search || null;


			/************** script parameters **************/
			// var scriptObj = runtime.getCurrentScript();
			// var xxxx = scriptObj.getParameter({name:"custscript_XXXX"});
			/************** end script parameters **************/

			if(recid && rectype){
				try{
					var params = {};
					redirect.toRecord({
						type : rectype,
						id : recid,
						isEditMode: edit,
						parameters: params
					});
				} catch (e) {
					response.write('Error: '+e.message);
				}
			}
			else if(searchCustId){
				// have to get the search ID
				var searchId=search.load({id:searchCustId}).id;
				if(searchId)
					redirect.toSavedSearch({id: searchId});
				else {
					response.write('Invalid parameter. Could not find search.');
				}
			}



			else {
				response.write('Invalid parameters');
			}
        }
        
        return {
            onRequest: onRequest
        };
});
