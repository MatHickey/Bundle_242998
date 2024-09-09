/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
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

define(['N/record', 'N/search', './BB SS/SS Lib/BB_SS_MD_SolarConfig', './BB SS/SS Lib/BB.SS.MD.UpsertSalesOrder'], function(record, search, solarConfig, upsertSalesOrder) {

    function beforeLoad(scriptContext) {
        var config = record.load({
            type: 'customrecord_bb_solar_success_configurtn',
            id: 1
        });
        scriptContext.form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.BW.CS.GetItemAvailibility.js';

        if (config.getValue({fieldId: 'custrecord_bb_bay_check_so_item_avail'})) {
            scriptContext.form.addButton({
                id: 'custpage_baywa_availability',
                label: 'Check BayWa r.e. Availability',
                functionName: 'getItemAvailability'
            });
        }
    }

    function afterSubmit(scriptContext) {
        var trigger = scriptContext.type;
        switch (trigger) {
            case 'approve':
                var salesOrder = loadSalesOrder(scriptContext);
                var project = salesOrder.getValue({
                    fieldId: 'custbody_bb_project'
                });

                if (project) {
                    var projectRec = record.load({
                        type: record.Type.JOB,
                        id: project,
                        isDynamic: true
                    });

                    var today = new Date();
                    projectRec.setValue({
                        fieldId: 'custentity_bb_equip_shipping_apprvl_date',
                        value: today
                    });
                    projectRec.save({
                        ignoreMandatoryFields: true
                    });

                }
            break;

            case 'create':
            case 'edit':
            case 'xedit':
                var salesOrder = loadSalesOrder(scriptContext);
                var project = salesOrder.getValue({
                    fieldId: 'custbody_bb_project'
                });
                var shipAmt;
                var configItem = solarConfig.getConfigurations(['custrecord_bb_shipping_item']);
                var shippingItem = configItem['custrecord_bb_shipping_item'].value;
                var invAmount = upsertSalesOrder.getShippingPrice(salesOrder);
                var shippingAmt = upsertSalesOrder.getShippingItemAmount(salesOrder);

	            if (project) {
                    var projectRec = record.load({
                        type: record.Type.JOB,
                        id: project,
                        isDynamic: true
                    });
                    if (shippingAmt){

                        projectRec.setValue({
                            fieldId: 'custentity_bb_shipping_amount',
                            value: shippingAmt
                        });
                    } 

                    if (invAmount) {
                        projectRec.setValue({
                            fieldId: 'custentity_bb_inventory_amount',
                            value: invAmount
                        });
                    }
                    var taxObj = upsertSalesOrder.getSalesTaxDetails(project);
                    if (taxObj) {
                        projectRec.setValue({
                            fieldId: 'custentity_bb_sales_tax_amount',
                            value: taxObj.amount
                        });
                        projectRec.setValue({
                            fieldId: 'custentity_bb_ss_sales_tax_account',
                            value: taxObj.account
                        });
                    }

                    projectRec.save({
                        ignoreMandatoryFields: true
                    });

                }
            break;
        }
    }

    function loadSalesOrder(scriptContext) {
        var salesOrder = record.load({
            type: record.Type.SALES_ORDER,
            id: scriptContext.newRecord.id,
            isDynamic:true
        });
        return salesOrder;
    }

    return {
        beforeLoad: beforeLoad,
        // afterSubmit: afterSubmit
    };
    
});