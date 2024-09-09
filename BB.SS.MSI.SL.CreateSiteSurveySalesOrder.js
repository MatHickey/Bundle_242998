/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/url', 'N/file', 'N/record'],
	
    function(ui, search, runtime, url, file, record) {
        function onRequest(context) {
        	//log.debug('context',context);
        	var request = context.request;
            var response = context.response;
			// force the response to be JSON
			response.setHeader({
				name: 'Content-Type',
				value: 'application/json; charset=utf-8',
			});

			var projectid = request.parameters.projectid || null;
			var packageitem = request.parameters.packageitem || null;
			var typeparam = request.parameters.typeparam || null;
			var actionid = request.parameters.actionid || null;
			var templateparam = request.parameters.templateparam || null;

			log.debug('create survey sales order', {
				projectid:projectid,
				packageitem:packageitem,
				typeparam:typeparam,
				actionid:actionid
			});
			if(!projectid || !packageitem || !typeparam || !actionid){
				log.error('missing parameter info','EXIT');
				response.write(JSON.stringify({
					success:false,
					error:{
						name:'MISSING_PARAM',
						message:'One of the required parameters is missing to create this order.'
					}
				}));
				return;
			}

			try {
				var rec = record.create({
					type: record.Type.SALES_ORDER,
					isDynamic: true
				});
				log.debug('rec', rec);
				var fieldLookUp = search.lookupFields({
					type: record.Type.JOB,
					id: projectid,
					columns: ['custentity_bb_homeowner_customer','custentity_bb_project_location']
				});
				var customer = fieldLookUp.custentity_bb_homeowner_customer[0] ? fieldLookUp.custentity_bb_homeowner_customer[0].value : '';
				var location = fieldLookUp.custentity_bb_project_location[0] ? fieldLookUp.custentity_bb_project_location[0].value : '';
				log.debug('package item', packageitem);
				if (!packageitem) {
					log.error('no package item found');
					return;
				}
				rec.setValue({ fieldId: 'entity', value: customer });
				rec.setValue({ fieldId: 'location', value: location });
				rec.setValue({ fieldId: 'custbody_bb_order_type', value: typeparam });
				if (templateparam) {
					rec.setValue({ fieldId: 'custbodyservicetemplate', value: templateparam });
				};
				log.debug('packageitem', packageitem);
				rec.setValue({ fieldId: 'custbody_bb_project', value: projectid });
				rec.selectNewLine({ sublistId: 'item' });

				rec.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'item',
					value: packageitem
				});
				rec.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'amount',
					value: 0
				});
				rec.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'custcol_bb_ss_proj_action',
					value: actionid
				});
				rec.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'location',
					value: location
				});
				rec.commitLine({
					sublistId: 'item'
				});

				rec.setValue({ fieldId: 'custbodysendtoservicepro', value: true });

				var soid = rec.save();
				log.debug('salesorder:'+soid, "saved");
				// try to bind file from webpartner record related to project to sales order
				if (soid) {
					// get the document link for all the project actions public view
					var extDocLinkUrl = url.resolveScript({
						scriptId: 'customscript_bbss_msi_survey_puplic_docs',
						deploymentId: 'customdeploy_bbss_msi_survey_puplic_docs',
						returnExternalUrl: true,
						params: {"soid": soid}
					});
					log.debug('extDocLinkUrl',extDocLinkUrl);
					record.submitFields({
						type: record.Type.SALES_ORDER,
						id: soid,
						values: {
							custbody_bb_msi_doc_links: extDocLinkUrl
						},
						options: {
							enableSourcing: false,
							ignoreMandatoryFields : true
						}
					});
                }
			} catch (e) {
				log.error(e.name, e.message);
				response.write(JSON.stringify({
					success:false,
					error:{
						name:e.name,
						message:e.message
					}
				}));
				return;
			}

			response.write( JSON.stringify({"success":true, "id":soid}) );
        }
        
        return {
            onRequest: onRequest
        };
});
