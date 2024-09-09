/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/url', 'N/file','N/https'],
	
    function(ui, search, runtime, url, file,https) {
        function onRequest(context) {
        	//log.debug('context',context);
        	var request = context.request;
        	var method = request.method;  /* DELETE  GET  HEAD  PUT  POST */
            var response = context.response;

            // parameters.....
            var soId = request.parameters.soid || null;

            // from the SO get the item and all the package actions that are linked
			var transactionSearchObj = search.create({
				type: "transaction",
				filters:
					[
						["internalid","anyof",soId],
						"AND",
						["mainline","is","F"],
						"AND",
						["item.custitem_msi_inspection","noneof","@NONE@"]
					],
				columns:
					[
						search.createColumn({name: "custcol_bb_ss_proj_action", label: "Project Action"}),
						search.createColumn({
							name: "custitem_bbss_msi_doc_package_actions",
							join: "item",
							label: "MSI Document Package Actions"
						}),
						search.createColumn({
							name: "custrecord_bb_project_package_action",
							join: "CUSTCOL_BB_SS_PROJ_ACTION",
							label: "Package Action"
						}),
						search.createColumn({
							name: "custrecord_bb_project",
							join: "CUSTCOL_BB_SS_PROJ_ACTION",
							label: "Project"
						})
					]
			});
			var searchResultCount = transactionSearchObj.runPaged().count;
			log.debug("transactionSearchObj result count",searchResultCount);

			var packageActionIds = [];
			var projectId,projectName;

			transactionSearchObj.run().each(function(result){
				var resultJSON = result.toJSON();
				log.debug('order search',resultJSON);
				projectId = resultJSON.values["CUSTCOL_BB_SS_PROJ_ACTION.custrecord_bb_project"][0].value;
				projectName = resultJSON.values["CUSTCOL_BB_SS_PROJ_ACTION.custrecord_bb_project"][0].text;
				packageActionIds.push(resultJSON.values["CUSTCOL_BB_SS_PROJ_ACTION.custrecord_bb_project_package_action"][0].value);
				for(var p=0; p<resultJSON.values["item.custitem_bbss_msi_doc_package_actions"].length; p++){
					var packageAction = resultJSON.values["item.custitem_bbss_msi_doc_package_actions"][p];
					packageActionIds.push(packageAction.value);
				}
				return true;
			});

			// now get the related project actions
			var customrecord_bb_project_actionSearchObj = search.create({
				type: "customrecord_bb_project_action",
				filters:
					[
						["custrecord_bb_project_package_action","anyof",packageActionIds],
						"AND",
						["custrecord_bb_project","anyof",projectId]
					],
				columns:
					[
						search.createColumn({
							name: "custrecord_bb_project_package_action",
							sort: search.Sort.ASC,
							label: "Package Action"
						}),
						search.createColumn({
							name: "custrecord_bb_revision_number",
							sort: search.Sort.DESC,
							label: "Revision Number"
						}),
						search.createColumn({name: "custrecord_bbss_public_doc_link", label: "Public Documents Link"})
					]
			});
			var searchResultCount = customrecord_bb_project_actionSearchObj.runPaged().count;
			log.debug("customrecord_bb_project_actionSearchObj result count",searchResultCount);
			var documentLinks = [];
			var lastId;
			customrecord_bb_project_actionSearchObj.run().each(function(result){
				var resultObj = result.toJSON();
				log.debug('project action result',resultObj);
				if(lastId==resultObj.values.custrecord_bb_project_package_action[0].value){
					// skip this one due to revision number is less
					return true;
				}
				documentLinks.push({
					packageName: resultObj.values.custrecord_bb_project_package_action[0].text,
					docLink: resultObj.values.custrecord_bbss_public_doc_link,
					id: resultObj.values.custrecord_bb_project_package_action[0].value
				});
				lastId = resultObj.values.custrecord_bb_project_package_action[0].value;
				return true;
			});

			//response.write(JSON.stringify(documentLinks,null,3));


            /**************************************
             * build the page
             **************************************/


			/****   GET   *********/
			if (/GET/i.test(method)) {
				// Use the form for GET
				var form = ui.createForm({
					title: projectName,
					hideNavBar: true
				});

				for(var g=0; g<documentLinks.length; g++){
					form.addFieldGroup({
						id : 'custgrp_'+documentLinks[g].id,
						label : documentLinks[g].packageName
					});

					// Display the option fields when the user first loads the page
					var htmlFld = form.addField({
						id : 'custpage_html_'+documentLinks[g].id,
						type : ui.FieldType.INLINEHTML,
						label : 'Documents',
						container: 'custgrp_'+documentLinks[g].id
					});

					var html = https.get({
						url: documentLinks[g].docLink
					}).body;

					htmlFld.defaultValue = html;
					// htmlFld.defaultValue = '<a href="'+documentLinks[g].docLink+'">Public Link</a>';


				}
            	/********   serverWidget.FieldType enum   *************
				CHECKBOX	CURRENCY	DATE	DATETIME	DATETIMETZ
				EMAIL		FILE		FLOAT	HELP		INLINEHTML
				INTEGER		IMAGE		LABEL	LONGTEXT	MULTISELECT
				PASSWORD	PERCENT		PHONE	SELECT		RADIO
				RICHTEXT	TEXTAREA	TEXT	TIMEOFDAY	URL
				********************************************************/


            	response.writePage(form);
            	return; // Don't execute the POST form code
            }


        }
        
        return {
            onRequest: onRequest
        };
});
