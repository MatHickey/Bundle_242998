/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 */

 /**
 * Copyright 2017-2019 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */


define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/runtime', 'N/redirect', 'N/ui/message', 'N/cache', './BB SS/SS Lib/BB.SS.MD.Project.BOM.Adders.InlineEditor', './BB SS/SS Lib/BB.SS.MD.UpsertSalesOrder', './BB SS/SS Lib/BB.SS.MD.ProjectCost'],

    function(record, search, serverWidget, runtime, redirect, message, cache, editor, upsertSalesOrder, projectCost) {

    var BOM_MESSAGE_CACHE = 'bom_message_cache';
    var DYNAMIC_COLUMNS_SEARCH = 'customsearch_bb_bom_inventory_item_list';

    function createForm(projectId, soId, configId, bomStatus){
        var form = serverWidget.createForm({
            title: 'Add Project BOM Records'
        });
        var status = form.addField({
            id: 'custpage_bom_status',
            label: 'BOM Status',
            type: serverWidget.FieldType.SELECT,
            source: 'customlist_bb_bom_status'
        });
        var projectField = form.addField({
            id: 'custpage_project',
            label: 'Project',
            type: serverWidget.FieldType.SELECT,
            source: 'job'
        });
        var salesOrderField = form.addField({
            id: 'custpage_sales_order',
            label: 'Sale Order',
            type: serverWidget.FieldType.SELECT,
            source: 'transaction'
        });
        var configRecord = form.addField({
            id: 'custpage_config_id',
            label: 'Config ID',
            type: serverWidget.FieldType.INTEGER
        });

        projectField.defaultValue = projectId;
        salesOrderField.defaultValue = soId;
        configRecord.defaultValue = configId;
        status.defaultValue = (bomStatus) ? bomStatus : 1

        projectField.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.INLINE
        });
        salesOrderField.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.INLINE
        });
        configRecord.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        form.addSubmitButton({
            label: 'Save BOM Records'
        });

        var bomSublist = form.addSublist({
            id: 'custpage_bom_item_list',
            type: serverWidget.SublistType.INLINEEDITOR,
            label: 'BOM Items',
            tab: 'custpage_bom_sub_tab'
        });

        //Static columns
        var bomItem = bomSublist.addField({
            id: 'custpage_bom_item',
            type: serverWidget.FieldType.SELECT,
            label: 'BOM Item',
            source: 'item'

        });

        var bomQty = bomSublist.addField({
            id: 'custpage_bom_quantity',
            type: serverWidget.FieldType.INTEGER,
            label: 'Quantity'
        });

        var bomId = bomSublist.addField({
            id: 'custpage_bom_id',
            type: serverWidget.FieldType.INTEGER,
            label: 'BOM Internal ID'
        });

        var purchaseOrder = bomSublist.addField({
            id: 'custpage_associated_po',
            type: serverWidget.FieldType.SELECT,
            label: 'Related Purchase Order',
            source: 'transaction'
        });

        //Dynamic columns
        var objDynamicColumns = search.load({
            id: DYNAMIC_COLUMNS_SEARCH
        }).columns;
        for (var i = 0; i < objDynamicColumns.length; i++) {
            bomSublist.addField({
                id: 'custpage_dynamic_columns_' + i,
                type: serverWidget.FieldType.TEXTAREA,
                label: objDynamicColumns[i].label ? objDynamicColumns[i].label : objDynamicColumns[i].name
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.DISABLED
            });
        }

        //Sublist configs
        bomItem.isMandatory = true;
        bomQty.isMandatory = true;

        bomId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        purchaseOrder.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        var recType = 'BOM_SUITELET';
        if (soId) {
            var bomItems = editor.getSublistValues(projectId, null, recType);
            log.debug('bomItems', bomItems);
            if (bomItems.length > 0) {
                for (var b = 0; b < bomItems.length; b++) {
                    var bomObj = {
                        bomItem: bomItems[b].bomItem,
                        bomQty: bomItems[b].bomQty,
                        purchaseOrder: bomItems[b].purchaseOrder,
                        description: bomItems[b].description,
                        bomId: bomItems[b].bomId,
                        itemObj: bomItem,
                        itemQtyObj: bomQty,
                        kitItemId: bomItems[b].kitItemId
                    };
                    for (var i = 0; i < objDynamicColumns.length; i++) {
                        bomObj['custpage_dynamic_columns_' + i] = bomItems[b]['custpage_dynamic_columns_' + i];
                    }
                    log.debug('bomObj',bomObj);
                    editor.setCustomSublistValues(bomSublist, b, bomObj, recType);
                }
            }
        }
        form.clientScriptModulePath = './BB SS/SS Lib/BB.CLI.SL.ValidationsAndButtons';
        return form;
    }

    function saveBomsToSo(context, projectId, soId, configId, bomStatus){
        var config = record.load({type: 'customrecord_bb_solar_success_configurtn', id: configId});
        var bomRecord = context.request;
        var bomItemList = context.request.getLineCount({
            group: 'custpage_bom_item_list'
        });
        log.debug('sublistline count', bomItemList);
        log.debug('salesorder parameter', soId);
        log.debug('project parameter', projectId);
        var project = record.load({ // 10 units
            type: record.Type.JOB,
            id: projectId
        });
        var location = project.getValue({fieldId: 'custentity_bb_project_location'})

        var solarSalesItems = upsertSalesOrder.getSolarConfigSalesItems();

        if (bomItemList >= -1) {
            var salesOrder = upsertSalesOrder.getSalesOrder(project, null);
            if (!salesOrder) {
                salesOrder = upsertSalesOrder.createSalesOrderHeader(project, solarSalesItems);
            } else {
                salesOrder = upsertSalesOrder.updateSalesOrderHeader(project, salesOrder, solarSalesItems, config);
            }

            var recType = 'BOM';
            var sublistItemIdArr = [];

            for (var i = 0; i < bomItemList; i++) {
                var bomId = bomRecord.getSublistValue({
                    group: 'custpage_bom_item_list',
                    name: 'custpage_bom_id',
                    line: i
                });
                var poId = bomRecord.getSublistValue({
                    group: 'custpage_bom_item_list',
                    name: 'custpage_associated_po',
                    line: i
                });
                var bomItem = bomRecord.getSublistValue({
                    group: 'custpage_bom_item_list',
                    name: 'custpage_bom_item',
                    line: i
                });
                var bomQty = bomRecord.getSublistValue({
                    group: 'custpage_bom_item_list',
                    name: 'custpage_bom_quantity',
                    line: i
                });

                // add logic here for adding kit items
                var itemTypeObj = search.lookupFields({ // 5 units per lookup
                    type: search.Type.ITEM,
                    id: bomItem,
                    columns: ['type']
                });
                var itemType = itemTypeObj.type[0].value;

                log.debug('item type from Sublist', itemType);

                if (itemType == 'Kit') {
                    // get item id of kit and/or kit item name for setting value on line item
                    // run search on item and get member items, then set all items from loop with qty using
                    var kitItemArr = editor.getKitItems(bomItem); // 10 units
                    if (kitItemArr.length > 0) {
                        log.debug('adding kit item');
                        for (x in kitItemArr) {
                            var kitItemId = kitItemArr[x].kitItemId;
                            var subItemId = kitItemArr[x].memberItemId;
                            var subItemQty = (bomQty > 1) ?
                                kitItemArr[x].memberQty * bomQty :
                                kitItemArr[x].memberQty;
                            var bomId = editor.createBomRecord(subItemId,
                                subItemQty, kitItemId, project.id);
                            editor.addSalesOrderLine(salesOrder, bomId, subItemId,
                                subItemQty, null, null, null,null, location, config);
                            sublistItemIdArr.push({
                                id: bomId,
                                itemId: subItemId,
                                recType: 'BOM'
                            });
                        }// end of kit sub item loop
                    }
                } else {
                    if (bomId && !poId) {
                        log.debug('updating bom record');
                        //update sales order line, update bom item
                        editor.updateBomRecord(bomItem, bomQty, bomId);
                        editor.updateSalesOrderLine(salesOrder, bomId, bomItem,
                            bomQty, null, null, null, null, location, config);
                        sublistItemIdArr.push({
                            id: bomId,
                            itemId: bomItem,
                            recType: 'BOM'
                        });
                    } else if (!bomId && !poId) {
                        log.debug('creating new bom record');
                        //create bom record and set sales order line item
                        var bomId = editor.createBomRecord(bomItem, bomQty, null,
                            project.id);
                        editor.addSalesOrderLine(salesOrder, bomId, bomItem, bomQty,
                            null, null, null, null, location, config);
                        sublistItemIdArr.push({
                            id: bomId,
                            itemId: bomItem,
                            recType: 'BOM'
                        });
                    } else {
                        sublistItemIdArr.push({
                            id: bomId,
                            itemId: bomItem,
                            recType: 'BOM'
                        });
                    }
                }
            } // end of loop

            upsertSalesOrder.upsertShippingItem(project, salesOrder,
                solarSalesItems);
            var bomRecordArr = editor.getProjectBOMRecords(project); // 10 units
            editor.removeRecordCheck(salesOrder, sublistItemIdArr, bomRecordArr);
            var soLineCheck = salesOrder.getLineCount({
                sublistId: 'item'
            });


            projectCost.processCostBudgetMap(projectId, 'customrecord_bb_project_bom', configId);

            if (soLineCheck > 0) {
                var salesOrderId = salesOrder.save({
                    ignoreMandatoryFields: true
                });
            }
            var invItemsPrices = upsertSalesOrder.getShippingPrice(salesOrder); //Inventory Item price -  no governance cost
            var shippingAmt = upsertSalesOrder.getShippingItemAmount(salesOrder); // retrieves shipping amount -  no governance cost
            var taxObj = upsertSalesOrder.getSalesTaxDetails(project.id); // (taxObj) ? taxObj.amount : 0.00,
            record.submitFields({
                type: record.Type.JOB,
                id: project.id,
                values: {
                    'custentity_bb_sales_tax_amount': (taxObj) ?
                        taxObj.amount :
                        null,
                    'custentity_bb_ss_sales_tax_account': (taxObj) ?
                        taxObj.account :
                        null,
                    'custentity_bb_inventory_amount': (invItemsPrices) ?
                        invItemsPrices :
                        0.00,
                    'custentity_bb_shipping_amount': (shippingAmt) ?
                        shippingAmt :
                        0.00,
                    'custentity_bb_project_so': (salesOrderId) ? salesOrderId : null,
                    'custentity_bb_bom_status_list': bomStatus
                },
                options: {
                    ignoreMandatoryFields: true
                }
            });
            return salesOrderId;
        }
        return undefined;
    }

    function getBomSaveMessage(projectId, soId, configId){
        var cacheData = cache.getCache({name: BOM_MESSAGE_CACHE});
        var key = [projectId, soId, configId].join('-');
        var value = cacheData.get({key:key});
        return  value ? value : false;
    }

    function setBomSaveMessage(projectId, soId, configId){
        var cacheData = cache.getCache({name: BOM_MESSAGE_CACHE});
        var key = [projectId, soId, configId].join('-');
        cacheData.put({key: key, value: true, ttl: 600});
    }

    function removeBomSaveMessage(projectId, soId, configId){
        var cacheData = cache.getCache({name: BOM_MESSAGE_CACHE});
        var key = [projectId, soId, configId].join('-');
        cacheData.remove({key: key});
    }

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {

        var projectId, soId, configId, bomStatus;

        if (context.request.method === 'GET') {
            projectId = context.request.parameters.project;
            soId = context.request.parameters.salesOrder;
            configId = context.request.parameters.configId;
            bomStatus = context.request.parameters.bomStatus;

            if (configId) {
                var lookup = search.lookupFields({ 
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: configId,
                    columns: ['custrecord_bb_custom_bom_suitelet_script']
                });

                log.debug('customscript id', customScript)
                if (lookup.custrecord_bb_custom_bom_suitelet_script.length > 0) {
                    var customScript = lookup.custrecord_bb_custom_bom_suitelet_script[0].value;

                    var scriptObj = getCustomScriptIDs(customScript);
                    //redirect to custom suitelet
                    redirect.toSuitelet({
                        scriptId: scriptObj.scriptId,
                        deploymentId: scriptObj.deploymentId,
                        parameters: {
                            'project': projectId,
                            'salesOrder': soId,
                            'configId': configId,
                            'bomStatus': bomStatus
                        }
                    });
                }
            }
            var hasMessage = getBomSaveMessage(projectId, soId, configId);
            var form = createForm(projectId, soId, configId, bomStatus);
            if(hasMessage){
                form.addPageInitMessage({
                    type: message.Type.CONFIRMATION,
                    message: 'BOM Records were saved successfully.',
                    duration: 10000
                });
                removeBomSaveMessage(projectId, soId, configId);
            }
            context.response.writePage(form);
        } else {
            projectId = context.request.parameters.custpage_project;
            soId = (context.request.parameters.custpage_sales_order) ? context.request.parameters.custpage_sales_order : searchProjectSalesOrder(projectId);
            configId = context.request.parameters.custpage_config_id;
            bomStatus = context.request.parameters.custpage_bom_status;
            // bomStatus = conttext.request.parameters.custpage_bom_status;
            var savedSoId = saveBomsToSo(context, projectId, soId, configId, bomStatus);
                  if(savedSoId){
                      if(!soId || soId != savedSoId){
                          soId = savedSoId;
                }
                setBomSaveMessage(projectId, soId, configId);
                var _script = runtime.getCurrentScript();
                redirect.toSuitelet({
                    scriptId: _script.id,
                    deploymentId: _script.deploymentId,
                    parameters: {
                        project: projectId,
                        salesOrder: soId,
                        configId: configId,
                        bomStatus: bomStatus
                    }
                });
            }
            var bomUploadScript = runtime.getCurrentScript();
            log.debug('Remaining governance units', bomUploadScript.getRemainingUsage());
        }
    }


    function getCustomScriptIDs(customScript) {
        var scriptObj = {};
        var scriptdeploymentSearchObj = search.create({
           type: "scriptdeployment",
           filters:
           [
              ["script.internalid","anyof", customScript]
           ],
           columns:
           [
              search.createColumn({
                 name: "scriptid",
                 join: "script"
              }),
              "scriptid"
           ]
        });
        var searchResultCount = scriptdeploymentSearchObj.runPaged().count;
        log.debug("scriptdeploymentSearchObj result count",searchResultCount);
        scriptdeploymentSearchObj.run().each(function(result){
            scriptObj.scriptId = result.getValue({
                name: 'scriptid',
                join: 'script'
            });
            scriptObj.deploymentId = result.getValue({
                name: 'scriptid'
            });

           //return true;
        });
        return scriptObj;
    }

    function searchProjectSalesOrder(projectId) {
        var soId = null;
        if (projectId) {
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                [
                    ["type","anyof","SalesOrd"], 
                    "AND", 
                    ["mainline","is","T"], 
                    "AND", 
                   ["custbody_bb_project","anyof", projectId]
                ],
                columns:
                [
                    "internalid"
                ]
            });
            var searchResultCount = salesorderSearchObj.runPaged().count;
            log.debug("Project Sales Order Record Count",searchResultCount);
            salesorderSearchObj.run().each(function(result){
                soId = result.getValue({name: 'internalid'});
                return true;
            });
        }
        return soId;
    }

    return {
        onRequest: onRequest
    };

});