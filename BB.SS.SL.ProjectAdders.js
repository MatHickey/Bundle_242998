/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Adder suitlet form
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

define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/runtime', 'N/redirect', 'N/task','./BB SS/SS Lib/BB.SS.MD.Project.BOM.Adders.InlineEditor', 
    './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing', './BB SS/SS Lib/BB.SS.MD.ProjectCost', './BB SS/SS Lib/BB.SS.Project.AccountingFields'],

function(record, search, serverWidget, runtime, redirect, task, editor, batchProcessor, projectCost, accountingFields) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        if (context.request.method == 'GET') {

            var projectId = context.request.parameters.project;
            var soId = context.request.parameters.salesOrder || searchProjectSalesOrder(projectId);
            var system = context.request.parameters.systemSize;
            var configId = context.request.parameters.configId || 1;
            var moduleQty = context.request.parameters.modQty;

            if (configId) {
                var lookup = search.lookupFields({ 
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: configId,
                    columns: ['custrecord_bb_custom_add_suitelet_script']
                });
                log.debug('search object', lookup);
                if (lookup.custrecord_bb_custom_add_suitelet_script.length > 0) {
                    var customScript = lookup.custrecord_bb_custom_add_suitelet_script[0].value;
                    log.debug('customscript id', customScript)
                    
                    var scriptObj = getCustomScriptIDs(customScript);
                    //redirect to custom suitelet
                    log.debug('script id object', scriptObj);
                    log.debug('redirecting to custom suitelet');
                    redirect.toSuitelet({
                        scriptId: scriptObj.scriptId,
                        deploymentId: scriptObj.deploymentId,
                        parameters: {
                            'project': projectId,
                            'salesOrder': soId,
                            'configId': configId
                        }
                    });
                }
            }

            var config = record.load({type: 'customrecord_bb_solar_success_configurtn', id: configId});

            var form = serverWidget.createForm({
                title: 'Add Project Adder Records'
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

            var sysSize = form.addField({
                id: 'custpage_system_size',
                label: 'System Size',
                type: serverWidget.FieldType.FLOAT
            });

            var modQty = form.addField({
                id: 'custpage_module_qty',
                label: 'Module Qty',
                type: serverWidget.FieldType.INTEGER
            });
            var adderGrandTotal = form.addField({
                id: 'custpage_adder_grand_total',
                label: 'Adder Grand Total',
                type: serverWidget.FieldType.FLOAT
            });
            var configRecord = form.addField({
                id: 'custpage_config_id',
                label: 'Config ID',
                type: serverWidget.FieldType.INTEGER
            });


            log.debug('system size', system);
            projectField.defaultValue = projectId;
            salesOrderField.defaultValue = (soId) ? soId : searchProjectSalesOrder(projectId);
            sysSize.defaultValue = system;
            configRecord.defaultValue = configId;
            modQty.defaultValue = moduleQty;

            projectField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            salesOrderField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            sysSize.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            modQty.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            adderGrandTotal.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            configRecord.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            form.addSubmitButton({
                label: 'Submit Adder Records'
            });

            var adderSublist = form.addSublist({
                id: 'custpage_adder_item_list',
                type: serverWidget.SublistType.INLINEEDITOR,
                label: 'Adder Items',
                tab: 'custpage_adder_sub_tab'
            });
            var adderItem = adderSublist.addField({
                id: 'custpage_adder_item',
                type: serverWidget.FieldType.SELECT,
                label: 'Adder Item',
            });
            adderItem.addSelectOption({
                value: '',
                text: ''
            });
            editor.adderItemSelection(adderItem);
            var adderNoteDescription = adderSublist.addField({
                id: 'custpage_adder_notes',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Note/Description'
            });
            var adderResponsiblity = adderSublist.addField({
                id: 'custpage_adder_responsibility',
                type: serverWidget.FieldType.SELECT,
                label: 'Adder Responsibility',
                source: 'customlist_bb_adder_responsibility'
            });
            var adderPricingMethod = adderSublist.addField({
                id: 'custpage_adder_pricing_method',
                type: serverWidget.FieldType.SELECT,
                label: 'Adder Pricing Method',
                source: 'customlist_bb_adder_pricing_method'
            });
            var adderFixedPrice = adderSublist.addField({
                id: 'custpage_adder_fixed_price',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Adder Fixed Price'
            });
            var adderQty = adderSublist.addField({ // default value = 1
                id: 'custpage_adder_qty',
                type: serverWidget.FieldType.INTEGER,
                label: 'Adder Quantity'
            });
            adderQty.defaultValue = 1;

            var adderCostAmount = adderSublist.addField({
                id: 'custpage_adder_cost_amount',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Adder Cost Amount'
            });
            adderCostAmount.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            var adderTotalAmount = adderSublist.addField({
                id: 'custpage_adder_total_amount',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Adder Total Amount'
            });
            var adderId = adderSublist.addField({
                id: 'custpage_adder_id',
                type: serverWidget.FieldType.INTEGER,
                label: 'Adder Internal ID'
            });
            adderId.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });

            var currentUser = runtime.getCurrentUser();
            var currentRoleId = currentUser.role;
            log.debug('current user role', currentRoleId);
            var hideRoles = config.getValue({fieldId: 'custrecord_bb_display_adder_pricing'});
            var displayPricing = editor.hidePricing(hideRoles, currentRoleId);

            if (!displayPricing) {
                adderFixedPrice.updateDisplayType({
                    displayType : serverWidget.FieldDisplayType.HIDDEN
                });

                adderTotalAmount.updateDisplayType({
                    displayType : serverWidget.FieldDisplayType.HIDDEN
                });
            }

            var recType = 'ADDER';
            adderItem.isMandatory = true;
            var adderItems = editor.getSublistValues(projectId, null, recType);
            if (adderItems.length > 0) {
                for (var a = 0; a < adderItems.length; a++) {
                    var adderObj = {
                        adderItem: adderItems[a].adderItemId,
                        responsibility: adderItems[a].adderResponse,
                        method: adderItems[a].adderMethod,
                        fixedPrice: adderItems[a].adderFixPrice,
                        qty: adderItems[a].adderQty,
                        costAmt: adderItems[a].costAmt,
                        totalAmt: adderItems[a].totalAmt,
                        notes: adderItems[a].notes,
                        internalId: adderItems[a].id
                    };
                    editor.setCustomSublistValues(adderSublist, a, adderObj, recType);
                }
            }

            form.clientScriptModulePath = './BB SS/SS Lib/BB.CLI.SL.ValidationsAndButtons.js';
            context.response.writePage(form);

        } else {

            // process adder records here.....

            try {
                var modQty;
                var configId = context.request.parameters.custpage_config_id;
                var config = record.load({type: 'customrecord_bb_solar_success_configurtn', id: configId});
                var modQtyFieldId = config.getValue({fieldId: 'custrecord_bb_mod_qty_field_id'});
                var columns = ['custentity_bb_originator_vendor'];
                if (modQtyFieldId) {
                    columns.push(modQtyFieldId);
                }
                var adderRecord = context.request;
                var adderItemList = context.request.getLineCount({
                    group: 'custpage_adder_item_list'
                });

                log.debug('sublistline count', adderItemList);
                
                var soId = context.request.parameters.custpage_sales_order;
                log.debug('salesorder parameter', soId);

                var projectId = context.request.parameters.custpage_project;
                var originator;
                if (projectId) {
                    projObj = search.lookupFields({
                        type: search.Type.JOB,
                        id: projectId,
                        columns: columns
                    });
                    if (projObj.custentity_bb_originator_vendor.length > 0) {
                        originator = projObj.custentity_bb_originator_vendor[0].value;
                    }
                    modQty = projObj.modQtyFieldId;
                }

                log.debug('project parameter', projectId);


                if (adderItemList >= -1) {
                    var itemsArr = [];
                    var sublistItemIdArr = [];

                    for (var i = 0; i < adderItemList; i++) {
                        var itemObj = {};
                        itemObj['itemId'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_item',
                            line: i
                        });
                        itemObj['description'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_note_description',
                            line: i
                        });
                        itemObj['responsibility'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_responsibility',
                            line: i
                        });
                        itemObj['pricingMethod'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_pricing_method',
                            line: i
                        });
                        itemObj['fixedPrice'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_fixed_price',
                            line: i
                        });
                        itemObj['quantity'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_qty',
                            line: i
                        });
                        itemObj['costAmount'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_cost_amount',
                            line: i
                        });
                        itemObj['adderTotal'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_total_amount',
                            line: i
                        });
                        itemObj['notes'] = adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_notes',
                            line: i
                        });
                        itemObj['adderId'] = parseInt(adderRecord.getSublistValue({
                            group: 'custpage_adder_item_list',
                            name: 'custpage_adder_id',
                            line: i
                        }));
                        log.debug('originator', originator);
                        var vendorPrice = editor.getVendorPricing(originator, itemObj.itemId);
                        log.debug('vendor price', vendorPrice);
                        var total;
                        var qty;
                        if (vendorPrice && !itemObj.adderId) {
                            total = vendorPrice;
                        } else {
                            total = itemObj.fixedPrice;
                        }
                        var adderId = editor.upsertAdderItemLine(itemObj.itemId, itemObj.responsibility, itemObj.pricingMethod, total, itemObj.quantity, itemObj.costAmount, itemObj.adderTotal, itemObj.adderId, projectId, itemObj.notes);

                        sublistItemIdArr.push({
                            id: adderId,
                            itemId: itemObj.itemId,
                            recType: 'ADDER'
                        });

                        itemObj.adderId = adderId;
                        itemsArr.push(itemObj);

                    }// end of loop

                    var adderRecordArr = editor.getProjectAdderRecords(projectId);
                    log.debug('adder record array', adderRecordArr);
                    var deleteArray = [];

                    if (itemsArr.length > 0 || adderRecordArr.length > 0) { 
                        // delete adder records
                        if (adderRecordArr.length > 0) {
                            for (var d = 0; d < adderRecordArr.length; d++) {
                                var bomAdderId = parseInt(adderRecordArr[d].bomAdderId);
                                log.debug('bomAdderId', bomAdderId);
                                var deleteIndex = itemsArr.map(function(data){return data.adderId}).indexOf(bomAdderId);
                                log.debug('delete index number', deleteIndex);
                                if (deleteIndex == -1) {
                                    // inactivate adder record
                                    record.submitFields({
                                        type: 'customrecord_bb_project_adder',
                                        id: bomAdderId,
                                        values: {
                                            'isinactive': true
                                        },
                                        options: {
                                            ignoreMandatoryFields: true
                                        }
                                    });
                                    deleteArray.push({
                                       adderId: bomAdderId,
                                       delete: true
                                    })
                                }

                            }
                        }
                        var adderSoObj = {
                            projectId: projectId,
                            soId: soId,
                            configId: configId,
                            items: itemsArr,
                            removeRecords: deleteArray
                        }


                        var taskParameters = {};
                        taskParameters['custscript_bb_ss_adder_item_array'] = [adderSoObj];

                        var scriptId = 'customscript_bb_ss_proj_adder_so_proc';
                        var deploymentId = 'customdeploy_bb_ss_proj_adder_so_proc';
                        var taskType = task.TaskType.SCHEDULED_SCRIPT;

                        batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);

                        if (adderRecordArr.length) {
                            projectCost.processCostBudgetMap(projectId, 'customrecord_bb_project_adder', configId);
                        }
                    }
                    var projectValues = {};
                    projectValues['custentity_bb_project_so'] = soId
                    var project = record.load({
                        type: record.Type.JOB,
                        id: projectId,
                        isDynamic: true
                    });
                    accountingFields.setAccountingFields(project, true, projectValues);


                    //redirect back to project record

                    // redirect.toRecord({
                    //     id: projectId,
                    //     type: record.Type.JOB,
                    // });

                    var adderUploadScript = runtime.getCurrentScript();
                    log.debug('Remaining governance units', adderUploadScript.getRemainingUsage());

                }
            } catch (e) {
                log.error('error', e);
            }

            redirect.toRecord({
                id: projectId,
                type: record.Type.JOB,
            });

            var adderUploadScript = runtime.getCurrentScript();
            log.debug('Remaining governance units', adderUploadScript.getRemainingUsage());
        }
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


    return {
        onRequest: onRequest
    };

});