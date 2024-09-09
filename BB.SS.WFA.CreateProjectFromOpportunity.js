/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 */
define(['N/runtime', './BB SS/SS Lib/BB.SS.MD.OpportunityToProject'],

    function(runtime, opportunityToProject) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(scriptContext) {
            var opportunity = scriptContext.newRecord;
            var recordType = scriptContext.newRecord.type;
            var opportunityObj = {};
            opportunityObj.preliminaryPurchasePrice = opportunity.getValue({fieldId: 'projectedtotal'});
            opportunityObj.internalId = opportunity.id;
            opportunityObj.custentity_bb_install_address_1_text = opportunity.getValue({fieldId: 'custbody_bb_install_address_1'});
            opportunityObj.custentity_bb_install_address_2_text = opportunity.getValue({fieldId: 'custbody_bb_install_address_2'});
            opportunityObj.custentity_bb_install_city_text = opportunity.getValue({fieldId: 'custbody_bb_install_city'});
            opportunityObj.custentity_bb_install_city_text = opportunity.getValue({fieldId: 'custbody_bb_install_city'});
            opportunityObj.custentity_bb_install_state = opportunity.getValue({fieldId: 'custbody_bb_install_state'});
            opportunityObj.custentity_ts_external_sales_list = opportunity.getValue({fieldId: 'custbody_opp_dealer'});
            opportunityObj.custentity_bb_install_zip_code_text = opportunity.getValue({fieldId: 'custbody_bb_install_zip'});
            opportunityObj.custentity_bb_utility_company = opportunity.getValue({fieldId: 'custbody_bb_ultility_company'});
            //add the customer id, map to homeowner customer record field refer to as entity
            opportunityObj.custentity_bb_utility_company = opportunity.getValue({fieldId: 'custbody_bb_ultility_company'});
            //add subsidiary
            opportunityObj.custentity_bb_subsidiary = opportunity.getValue({fieldId: 'subsidiary'});
            opportunityObj.custentity_bb_utility_company = opportunity.getValue({fieldId: 'custbody_bb_ultility_company'});
            var entityId = opportunity.getValue({fieldId: 'entity'});

            var id = opportunityToProject.transformEntityToProject(entityId, opportunityObj);
            return id;
        }

        return {
            onAction : onAction
        };

    });
