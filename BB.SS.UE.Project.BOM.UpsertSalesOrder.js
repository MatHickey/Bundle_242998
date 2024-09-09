/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 * @author Tyler Mann
 * @version 0.1.6
 * @fileOverview This user event script updates the associated Sales Order, when a Project BOM event triggers.
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

define(['N/record', 'N/search', 'N/runtime', './BB SS/SS Lib/BB.SS.MD.UpsertSalesOrder'],
    function(record, search, runtime, upsertSOProcessing) {	

		/**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
            var currentScript = runtime.getCurrentScript();
            log.debug('currently executed script', currentScript);
            log.debug('execution context', runtime.executionContext);
            var trigger = scriptContext.type;
            var solarSalesItems = upsertSOProcessing.getSolarConfigSalesItems();
            if (runtime.executionContext != 'SUITELET' && runtime.executionContext != 'MAPREDUCE' && runtime.executionContext != 'SCHEDULED') { 
                if(trigger == 'delete'){
                    var projectBOM = scriptContext.oldRecord;
                }
                else {
                    var projectBOM = record.load({
                    	type: 'customrecord_bb_project_bom',
                    	id: scriptContext.newRecord.id
                    });
                }
                var projectId = projectBOM.getValue({
                    fieldId: 'custrecord_bb_project_bom_project'
                });
                var project = record.load({
                    type: record.Type.JOB,
                    id: projectId
                });
                var isInactive = projectBOM.getValue({fieldId: 'isinactive'});
                if (isInactive) {
                    log.debug('project bom is inactive removing from sales order')
                    var salesOrder = upsertSOProcessing.getSalesOrder(project, scriptContext);
                    var itemLine = upsertSOProcessing.findLineIndex(salesOrder, projectBOM);
                    if (itemLine !== -1) {
                        salesOrder.removeLine({
                            sublistId: 'item',
                            line: itemLine
                        });
                        upsertSOProcessing.upsertShippingItem(project, salesOrder, solarSalesItems);

                        var invItemsPrices = upsertSOProcessing.getShippingPrice(salesOrder);
                        var shippingAmt = upsertSOProcessing.getShippingItemAmount(salesOrder);
                        var taxObj = upsertSOProcessing.getSalesTaxDetails(project.id);

                        if (runtime.executionContext != 'WORKFLOW') {
                            setProjectFields(project, invItemsPrices, shippingAmt, taxObj);

                            project.save({
                                ignoreMandatoryFields: true
                            });
                        }

                        salesOrder.save({
                            ignoreMandatoryFields: true
                        });
                    }
                } else {
                    var oldProjectBOM = null;
                    if(trigger != 'create')oldProjectBOM = scriptContext.oldRecord;

                    var projectId = projectBOM.getValue({
                        fieldId: 'custrecord_bb_project_bom_project'
                    });
                    var project = record.load({
                        type: record.Type.JOB,
                        id: projectId
                    });

                    var projectType = project.getText({
                        fieldId: 'jobtype'
                    });
                    if (projectType == 'EPC'){
                        var epcRole = project.getText({
                            fieldId: 'custentity_bb_epc_role'
                        });
                    }
                    if (epcRole != 'Originator'){

                        switch (trigger) {
                            case 'create':
                            case 'edit':
                            case 'xedit':
                                var soCreated = false;
                                var salesOrder = upsertSOProcessing.getSalesOrder(project, null);
                                if(!salesOrder){
                                    soCreated = true;
                                    salesOrder = upsertSOProcessing.createSalesOrderHeader(project, solarSalesItems);
                                }

                                salesOrder = upsertBOMItem(project, salesOrder, projectBOM, oldProjectBOM);

                                upsertSOProcessing.upsertShippingItem(project, salesOrder, solarSalesItems);

                                var salesOrderID = salesOrder.save({
                                    ignoreMandatoryFields: true
                                });

                                var invItemsPrices = upsertSOProcessing.getShippingPrice(salesOrder);
                                var shippingAmt = upsertSOProcessing.getShippingItemAmount(salesOrder);
                                if(soCreated){
                                    //set SO field value on the Project
                                    project.setValue({
                                        fieldId: 'custentity_bb_project_so',
                                        value: salesOrderID
                                    });
                                }
                                var taxObj = upsertSOProcessing.getSalesTaxDetails(project.id);
                                if (runtime.executionContext != 'WORKFLOW') {
                                    setProjectFields(project, invItemsPrices, shippingAmt, taxObj);

                                    project.save({
                                        ignoreMandatoryFields: true
                                    });
                                }

                                break;
                            case 'delete':
                                var salesOrder = upsertSOProcessing.getSalesOrder(project, scriptContext);
                                var itemLine = upsertSOProcessing.findLineIndex(salesOrder, projectBOM);
                                if (itemLine !== -1) {
                                    salesOrder.removeLine({
                                        sublistId: 'item',
                                        line: itemLine
                                    });
                                    upsertSOProcessing.upsertShippingItem(project, salesOrder, solarSalesItems);

                                    var invItemsPrices = upsertSOProcessing.getShippingPrice(salesOrder);
                                    var shippingAmt = upsertSOProcessing.getShippingItemAmount(salesOrder);
                                    var taxObj = upsertSOProcessing.getSalesTaxDetails(project.id);

                                    if (runtime.executionContext != 'WORKFLOW') {
                                        setProjectFields(project, invItemsPrices, shippingAmt, taxObj);

                                        project.save({
                                            ignoreMandatoryFields: true
                                        });
                                    }

                                    salesOrder.save({
                                        ignoreMandatoryFields: true
                                    });
                                }

                                break;
                        }// end of switch
                    }
                }
            }// end of execution context check for suitelet
        }

        function upsertBOMItem(project, salesOrder, projectBOM, oldProjectBOM) {
            var config = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: 1
            })
            var bomQty = projectBOM.getValue('custrecord_bb_project_bom_quantity');
            var bomItem = projectBOM.getValue('custrecord_bb_project_bom_item');

            var location = project.getValue({fieldId: 'custentity_bb_project_location'});

        	var itemLine = upsertSOProcessing.findLineIndex(salesOrder,projectBOM);
			var projectType = project.getText('jobtype');

            if (itemLine === -1) {
                salesOrder.selectNewLine('item');
                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: bomItem
                });
                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: bomQty
                });
                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_bb_adder_bom_id',
                    value: projectBOM.id
                });

                salesOrder.setCurrentSublistValue({
                	sublistId: 'item',
                	fieldId: 'createpo',
                	value: null
                });
                if (location && config.getValue({fieldId: 'custrecord_bb_set_loc_on_so_bool'})) {
                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: location
                    });
                }
                var rate = salesOrder.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                });
                if (!rate) {
                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: 0.00
                    });
                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: 0.00
                    });
                }

                salesOrder.commitLine('item');
            } 
            else {
            	salesOrder.selectLine({
            		sublistId: 'item', 
            		line: itemLine
            	});
            	salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: bomItem
                });
            	salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: bomQty
                });
                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'createpo',
                    value: null
                });
                if (location && config.getValue({fieldId: 'custrecord_bb_set_loc_on_so_bool'})) {
                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: location
                    });
                }
                salesOrder.commitLine('item');
            }
            return salesOrder;
        }

        function isNotNull(str){
        	return (str !== null && str !== '' && str !== undefined);
        }
        
        function isNull(str){
        	return (str === null || str === '' || str === undefined);
        }

        function setProjectFields(project, invItemsPrices, shippingAmt, taxObj) {
            if (invItemsPrices) {
                project.setValue({
                    fieldId: 'custentity_bb_inventory_amount',
                    value: invItemsPrices
                });
            }
            if (shippingAmt) {
                project.setValue({
                    fieldId: 'custentity_bb_shipping_amount',
                    value: shippingAmt
                });
            }
            if (taxObj) {
                project.setValue({
                    fieldId: 'custentity_bb_sales_tax_amount',
                    value: taxObj.amount
                });
                project.setValue({
                    fieldId: 'custentity_bb_ss_sales_tax_account',
                    value: taxObj.account
                });
            }
        }
        
        return {
        	afterSubmit: afterSubmit
        };
    });