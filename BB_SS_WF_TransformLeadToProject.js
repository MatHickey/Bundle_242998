/**
 * @NApiVersion 2.0
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @author Graham O'Daniel
 * @author Matt Lehman
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['./BB SS/SS Lib/BB.SS.Transform', 'N/search', 'N/record'], function(transform, search, record) {
    function onAction(context) {
        log.debug('onAction', 'start');
        var entity = context.newRecord;
        var _entityStage = entity.getValue({
        	fieldId: 'stage'
        });
        log.debug('Entity Stage', _entityStage);
        var requiredFields = getReqEntityFields(entity);
        if (requiredFields.length > 0) {
            var fields = '';
            for (var x = 0; x < requiredFields.length; x++) {
                fields += '    ' + requiredFields[x] + '\n';
            }
            throw 'The following fields are required to create a project: ' + '\n' + fields;
        } else {
            var transformer = transform.Transformer.getTransformer(_entityStage, 'project');
            var entityObj = {
            	id: entity.id,
            	stage: _entityStage
            };
            var project = transformer.transform(entityObj); //entity.id
            log.debug('onAction', 'end');
            return project.internalId;
        }

    }

    function getReqEntityFields(entity) {
        var missingFields = [];
		var isperson  = entity.getValue({fieldId: 'isperson'});
		log.debug('isperson',isperson);

        if (isperson == 'T' && (!entity.getValue({fieldId: 'firstname'}) || !entity.getValue({fieldId: 'lastname'}))) {
            missingFields.push('First Name and Last Name');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_home_owner_name_text'})) {
            missingFields.push('Homeowner Name');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_install_address_1_text'})) {
            missingFields.push('Installation Address 1');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_install_city_text'})) {
            missingFields.push('Installation City');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_install_state'})) {
            missingFields.push('Installation State');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_install_zip_code_text'})) {
            missingFields.push('Installation Zip Code');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_market_segment'})) {
            missingFields.push('Market Segment');
        }
        if (!entity.getValue({fieldId: 'custentity_bb_utility_company'})) {
            missingFields.push('Utility Company');
        }
        // if (!entity.getValue({fieldId: 'custentity_bb_avg_utilitybill_month_amt'})) {
        //     missingFields.push('Average Monthly Utility Bill');
        // }
        // if (!entity.getValue({fieldId: 'custentity_bb_system_size_decimal'})) {
        //     missingFields.push('System Size');
        // }
        if (!entity.getValue({fieldId: 'custentity_bb_financing_type'})) {
            missingFields.push('Financing Type');
        }
        var proposalArr = getSelectedProposal(entity);
        var selected = proposalArr.selectedProposal;
        var unselected = proposalArr.unselectedProposal;

        // if (selected.length == 0 && unselected.length == 0) {
        //     missingFields.push('Proposal is required, There are no Proposals associated with this Project');
        // }

        if (selected.length > 0) {

        	selected.forEach(function(selectedItem){
        		var propTemplate = selectedItem.template;
        		var propDoc = selectedItem.proposalDoc;
        		if (propTemplate) {
        			var projectType = search.lookupFields({
        				type: search.Type.JOB,
        				id: propTemplate,
        				columns: ['jobtype', 'custentity_bb_financing_type', 'custentity_bb_financier_customer', 'entityid']
        			});
                    var prelimPurchasePrice = entity.getValue({
                        fieldId: 'custentity_bb_fin_prelim_purch_price_amt'
                    });

                    var templateName = projectType.entityid;

                    if (projectType.jobtype instanceof Array && typeof projectType.jobtype[0] !== 'undefined' && projectType.jobtype[0].text == 'EPC') {
                        if (!prelimPurchasePrice) {
                            missingFields.push('Preliminary Purchase Price is required for EPC projects');
                        }
                        // if (!entity.getValue({fieldId:'custentity_bb_financier_customer'})) {
                        //     missingFields.push('Financier is required for ' + templateName + ' Please enter a Financier.');
                        // }

                    }
                    if (projectType.jobtype instanceof Array && typeof projectType.jobtype[0] !== 'undefined' && projectType.jobtype[0].text == 'Full Service') { 
                        if (projectType.custentity_bb_financing_type instanceof Array && typeof projectType.custentity_bb_financing_type[0] !== 'undefined' && projectType.custentity_bb_financing_type[0].text == 'Cash') {
                            var custCategory = entity.getValue({
                                fieldId: 'category'
                            });
                            if (!custCategory) {
                                missingFields.push('Category is required for Cash Projects');
                            }
                        }
                        //if (!entity.getValue({fieldId:'custentity_bb_financier_customer'})) {
                            //missingFields.push('Financier is required for ' + templateName + ' Please enter a Financier.');
                        //}
                    }
        		} else {
        			//missingFields.push('The selected Proposal is missing a Project Template');
        		}
        		if (!propDoc) {
        			//missingFields.push('The selected Proposal is missing the Proposal Document');
        		}
        		
        	});// end of loop
        }

        if (unselected.length > 0 && selected.length == 0) {
            //missingFields.push('You must select a Proposal before creating a Project');
        }

        return missingFields;
    }

    function getSelectedProposal(entity) {

        var selectedProposal = [];
        var unselectedProposal = [];
        var customrecord_bb_proposalSearchObj = search.create({
            type: "customrecord_bb_proposal",
            filters: [
              ["custrecord_bb_lead","anyof",entity.id] 

            ],
            columns: [
               "internalid",
               "custrecord_bb_project_template",
               "custrecord_bb_file_system",
               "custrecord_bb_is_selected_proposal"

            ]
        });
        var searchResultCount = customrecord_bb_proposalSearchObj.runPaged().count;
        customrecord_bb_proposalSearchObj.run().each(function(result){

            var selected = result.getValue({
                name: 'custrecord_bb_is_selected_proposal'
            });
            var proposalId = result.getValue({
                name: 'internalid'
            });
            var template = result.getValue({
                name: 'custrecord_bb_project_template'
            });
            var proposalDoc = result.getValue({
                name: 'custrecord_bb_file_system'
            });
            if (selected == true) {
                selectedProposal.push({
                    selected:selected,
                    proposalId:proposalId,
                    template:template,
                    proposalDoc:proposalDoc
                });
            } else {
                unselectedProposal.push({
                    selected:selected,
                    proposalId:proposalId,
                    template:template,
                    proposalDoc:proposalDoc
                });
            }
            return true;
        });
        return {
            selectedProposal:selectedProposal,
            unselectedProposal:unselectedProposal
        };
    }

    return {
        onAction: onAction
    };
});