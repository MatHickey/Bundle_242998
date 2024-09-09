/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 * @author Tyler Mann
 * @author Matthew Lehman
 * @version 0.2.3
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

define(['N/record','N/search', 'N/runtime', './BB SS/SS Lib/BB.SS.MD.UpsertSalesOrder', './BB SS/SS Lib/BB_SS_MD_SolarConfig', 
    './BB SS/SS Lib/BB.SS.Project.AccountingFields', './BB SS/SS Lib/BB.SS.Project.TotalContractValueHistory', './BB SS/SS Lib/BB.SS.MD.Project.BOM.Adders.InlineEditor'],

function(record, search, runtime, upsertSOProcessing, solarConfig, accountingFields, contractHistory, editor) {

    function afterSubmit(scriptContext) {
        var adderValues = {};
        var projectValues = {};
        var projectAdder;
        var currentScript = runtime.getCurrentScript();
        log.debug('currently executed script', currentScript);
        log.debug('execution context', runtime.executionContext);
        log.debug('internalid', scriptContext.newRecord.id);
        if (runtime.executionContext != 'SUITELET' && runtime.executionContext != 'MAPREDUCE' && runtime.executionContext != 'SCHEDULED') {
            try {
                var trigger = scriptContext.type;
                if (trigger == 'delete') {
                    projectAdder = scriptContext.oldRecord;
                } else {
                    // projectAdder = record.load ({
                    //     type: 'customrecord_bb_project_adder',
                    //     id: scriptContext.newRecord.id
                    // });
                    projectAdder = scriptContext.newRecord;
                }

                var oldProjectAdder = null;
                if (trigger != 'create') oldProjectAdder = scriptContext.oldRecord;

                var projectId = projectAdder.getValue ({
                    fieldId: 'custrecord_bb_project_adder_project'
                });
                if (projectId) {
                    var project = record.load({
                        type: record.Type.JOB,
                        id: projectId
                    });
                    var projectType = project.getText({
                        fieldId: 'jobtype'
                    });
                    if (projectType == 'EPC') {
                        var epcRole = project.getText({
                            fieldId: 'custentity_bb_epc_role'
                        });
                    }
                    var originatorVendor = project.getValue({
                        fieldId: 'custentity_bb_originator_vendor'
                    });
                    var adderItem = projectAdder.getValue({
                        fieldId: 'custrecord_bb_adder_item'
                    });


                    // update adder record values when originator vendor is listed on adder vendor pricing sublist record
                    if (originatorVendor && adderItem && trigger == 'create') {
                        var vendorPrice = editor.getVendorPricing(originatorVendor, adderItem);
                        log.debug('vendor price', vendorPrice);
                        if (vendorPrice) {
                            adderValues['custrecord_bb_adder_price_amt'] = vendorPrice;
                        }

                        log.debug('adder submit object', adderValues);
                        if (vendorPrice) {
                            record.submitFields({
                                type: 'customrecord_bb_project_adder',
                                id: scriptContext.newRecord.id,
                                values: adderValues,
                                options: {
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true
                                }
                            });
                        }
                    }
                    if (originatorVendor && adderItem && runtime.executionContext == 'CSVIMPORT') {
                        var vendorPrice = editor.getVendorPricing(originatorVendor, adderItem);
                        log.debug('vendor price', vendorPrice);
                        if (vendorPrice) {
                            adderValues['custrecord_bb_adder_price_amt'] = vendorPrice;
                        }

                        log.debug('adder submit object', adderValues);
                        if (vendorPrice) {
                            log.debug('updating adder amount');
                            record.submitFields({
                                type: 'customrecord_bb_project_adder',
                                id: scriptContext.newRecord.id,
                                values: adderValues,
                                options: {
                                    ignoreMandatoryFields: true,
                                    disableTriggers: true
                                }
                            });
                        }
                    }
                
                    if (epcRole != 'Originator') {
                        if(trigger == 'create' || trigger == 'edit' || trigger == 'xedit'){
                            var inactive = projectAdder.getValue({
                                fieldId: 'isinactive'
                            });
                            if(inactive == 'T' || inactive == true){
                                trigger = 'delete'; //if inactive, treat as delete
                            }
                        }
                        switch (trigger) {
                            case 'create':
                            case 'edit':
                            case 'xedit':
                                var solarSalesItems = upsertSOProcessing.getSolarConfigSalesItems();
                                var soCreated = false;
                                var salesOrder = upsertSOProcessing.getSalesOrder(project);
                                if (isNull(salesOrder)) {
                                    soCreated = true;
                                    salesOrder = upsertSOProcessing.createSalesOrderHeader(project, solarSalesItems);
                                }

                                salesOrder = upsertAdderItem(project, salesOrder, projectAdder, oldProjectAdder, vendorPrice);
                                
                                
                                upsertSOProcessing.upsertOriginatorItem(project, salesOrder, solarSalesItems);

                                var salesOrderID = salesOrder.save({
                                    ignoreMandatoryFields: true
                                });
                                projectValues['custentity_bb_project_so'] = salesOrderID;

                                accountingFields.setAccountingFields(project, true, projectValues);


                                break;

                            case 'delete':
                                var salesOrder = upsertSOProcessing.getSalesOrder(project);
                                var itemLine = upsertSOProcessing.findLineIndex(salesOrder, projectAdder);
                                if (itemLine !== -1) {
                                    salesOrder.removeLine({
                                        sublistId: 'item',
                                        line: itemLine
                                    });
                                    try {
                                        salesOrder.save({
                                            ignoreMandatoryFields: true
                                        });
                                    }
                                    catch (e){
                                        log.error('Error in saving Sales Order. Error: '+e.name, e.message);
                                    }
                                }
                                
                                accountingFields.setAccountingFields(project, true, projectValues);

                            break;
                        } // end of switch
                    }// end of epc check
                }// end of project check

            } catch (error) {
                    log.error('error', error);
            }
        }

    }

    function getAdderFixedCost(itemId) {
        var fixedPrice = 0.00;
        if (itemId) {
            var itemSearchObj = search.create({
                type: "item",
                filters:
                [
                    ["internalid","anyof",itemId]
                ],
                columns:
                [
                    "custitem_bb_adder_cost_amount"
                ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            log.debug("itemSearchObj result count",searchResultCount);
            itemSearchObj.run().each(function(result){
                fixedPrice = result.getValue({name: 'custitem_bb_adder_cost_amount'})
               return true;
            });
        }
        return fixedPrice;
    }


    function upsertAdderItem(project, salesOrder, projectAdder, oldProjectAdder, vendorPrice) {
        var recreate = false;
        var CUSTOM_PRICE_LEVEL = -1;

        var adderItem = projectAdder.getValue('custrecord_bb_adder_item');
        var adderQty = projectAdder.getValue('custrecord_bb_quantity');
        var adderPrice = projectAdder.getValue('custrecord_bb_adder_price_amt');

        var adderRate = (projectAdder.getValue({fieldId: 'custrecord_bb_adder_cost_amount'})) ? projectAdder.getValue({fieldId: 'custrecord_bb_adder_cost_amount'}) :
        adderQty * projectAdder.getValue('custrecord_bb_adder_price_amt');

        var price = (vendorPrice) ? vendorPrice : adderPrice; //adderRate;

        if (isNotNull(oldProjectAdder)) {
            var oldAdderItem = oldProjectAdder.getValue('custrecord_bb_project_adder_item');
            recreate = (oldAdderItem != adderItem);
        }

        var itemLine = upsertSOProcessing.findLineIndex(salesOrder, projectAdder);

        if (recreate) {
            if (itemLine !== -1) {
                salesOrder.removeLine({
                    sublistId: 'item',
                    line: itemLine
                });
            }
        }
        if (itemLine === -1 || recreate) { //item doesn't exist, add it
            salesOrder.selectNewLine('item');
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: adderItem
            });
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: adderQty
            });
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'price',
                value: CUSTOM_PRICE_LEVEL
            });
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: price
            });
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_bb_adder_bom_id',
                value: projectAdder.id
            });
            salesOrder.commitLine('item');
        } else { //item exists, update qty and rate
            salesOrder.selectLine({
                sublistId: 'item',
                line: itemLine
            });
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: adderQty
            });
            // price level must be set to Custom to update.
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'price',
                value: CUSTOM_PRICE_LEVEL
            });
            salesOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: price
            });
            salesOrder.commitLine('item');
        }
        return salesOrder;
    }


    function isNotNull(str) {
        return !isNull(str);
    }

    function isNull(str) {
        return (str === null || str === '' || str === undefined);
    }

    return {
        afterSubmit: afterSubmit
    };
    
});