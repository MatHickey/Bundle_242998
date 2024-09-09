/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Richard Tuttle
 * @overview - Expense suitlet form
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

define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/runtime', 'N/redirect', './BB SS/SS Lib/BB.SS.MD.Project.BOM.Adders.InlineEditor', './BB SS/SS Lib/BB.SS.MD.UpsertSalesOrder', './BB SS/SS Lib/BB.SS.Project.AccountingFields', './BB SS/SS Lib/BB.SS.Project.TotalContractValueHistory', './BB SS/SS Lib/BB.SS.MD.ProjectCost'],

function(record, search, serverWidget, runtime, redirect, editor, upsertSalesOrder, accountingFields, contractHistory, projectCost) {
   
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
            var soId = context.request.parameters.salesOrder;
            var system = context.request.parameters.systemSize;
            var configId = context.request.parameters.configId || 1;
            log.debug('configId', configId);
            if (configId) {
                var lookup = search.lookupFields({ 
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: configId,
                    columns: ['custrecord_bb_custom_exp_suitelet_script']
                });
                log.debug('search object', lookup);
                if (lookup.custrecord_bb_custom_exp_suitelet_script.length > 0) {
                    var customScript = lookup.custrecord_bb_custom_exp_suitelet_script[0].value;
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
                            'salesOrder': salesOrderId,
                            'configId': configId
                        }
                    });
                }
            }
            if(!projectId) throw 'Mising Project Parameter';

            var config = record.load({type: 'customrecord_bb_solar_success_configurtn', id: configId});

            var form = serverWidget.createForm({
                title: 'Add Project Expense Budget Item'
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

            var configRecord = form.addField({
                id: 'custpage_config_id',
                label: 'Config ID',
                type: serverWidget.FieldType.INTEGER
            });


            log.debug('system size', system);
            projectField.defaultValue = projectId;
            salesOrderField.defaultValue = soId;
            sysSize.defaultValue = system;
            configRecord.defaultValue = configId;

            projectField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            salesOrderField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            sysSize.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            configRecord.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            form.addSubmitButton({
                label: 'Submit Expense Budget Records'
            });

            var expenseSublist = form.addSublist({
                id: 'custpage_expense_item_list',
                type: serverWidget.SublistType.INLINEEDITOR,
                label: 'Expense Items',
                tab: 'custpage_expense_sub_tab'
            });
            var expenseItem = expenseSublist.addField({
                id: 'custpage_expense_item',
                type: serverWidget.FieldType.SELECT,
                label: 'Expense Item',
            });
            expenseItem.addSelectOption({
                value: '',
                text: ''
            });
            editor.expenseItemSelection(expenseItem);
            var expenseAmount = expenseSublist.addField({
                id: 'custpage_expense_amount',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Expense Amount'
            });
            var expenseDescription = expenseSublist.addField({
                id: 'custpage_expense_desc',
                type: serverWidget.FieldType.TEXT,
                label: 'Expense Description'
            });
            var expenseId = expenseSublist.addField({
                id: 'custpage_expense_id',
                type: serverWidget.FieldType.INTEGER,
                label: 'Expense Internal ID'
            });
            expenseId.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });

            var recType = 'EXPENSE';
            expenseItem.isMandatory = true;
            var expenseItems = editor.getSublistValues(projectId, null, recType);
            if (expenseItems.length > 0) {
                for (var a = 0; a < expenseItems.length; a++) {
                    var expenseObj = {
                        expenseItem: expenseItems[a].expenseItemId,
                        description: expenseItems[a].description,
                        amount: expenseItems[a].amount,
                        internalId: expenseItems[a].id
                    };
                    editor.setCustomSublistValues(expenseSublist, a, expenseObj, recType);
                }
            }

            form.clientScriptModulePath = './BB SS/SS Lib/BB.CLI.SL.BOM.AdderValidations';
            context.response.writePage(form);

        } else {

            // process expense records here.....
            var configId = context.request.parameters.custpage_config_id;
            var config = record.load({type: 'customrecord_bb_solar_success_configurtn', id: configId});
            var expenseRecord = context.request;
            var expenseItemList = context.request.getLineCount({
                group: 'custpage_expense_item_list'
            });

            log.debug('sublistline count', expenseItemList);

            var soId = context.request.parameters.custpage_sales_order;
            log.debug('salesorder parameter', soId);

            var projectId = context.request.parameters.custpage_project;

            log.debug('project parameter', projectId);
            var project = record.load({ // 10 units
                type: record.Type.JOB,
                id: projectId,
              isDynamic: true
            });

            var solarSalesItems = upsertSalesOrder.getSolarConfigSalesItems();

            if (expenseItemList >= -1) {
                var salesOrder = upsertSalesOrder.getSalesOrder(project, null);
                if (!salesOrder) {
                    salesOrder = upsertSalesOrder.createSalesOrderHeader(project, null, solarSalesItems);
                } else {
                    salesOrder = upsertSalesOrder.updateSalesOrderHeader(project, salesOrder, null, solarSalesItems, config);
                }

                var recType = 'EXPENSE';
                var sublistItemIdArr = [];

                for (var i = 0; i < expenseItemList; i++) {
                    var expenseLineItemId = expenseRecord.getSublistValue({
                        group: 'custpage_expense_item_list',
                        name: 'custpage_expense_item',
                        line: i
                    });
                    var expenseLineAmount = expenseRecord.getSublistValue({
                        group: 'custpage_expense_item_list',
                        name: 'custpage_expense_amount',
                        line: i
                    });
                    var expenseLineDescription = expenseRecord.getSublistValue({
                        group: 'custpage_expense_item_list',
                        name: 'custpage_expense_desc',
                        line: i
                    });
                    var expenseLineInternalId = expenseRecord.getSublistValue({
                        group: 'custpage_expense_item_list',
                        name: 'custpage_expense_id',
                        line: i
                    });
                    var expenseLineQty = 1; // hardcoded for now, but available for adding later if needed
                    if (expenseLineItemId && !expenseLineInternalId) {
                        // todo, move to separate function in editor
                        var expenseId = editor.upsertExpenseItemLine(expenseLineItemId,  expenseLineAmount, expenseLineDescription, expenseLineInternalId, project);
                        editor.addSalesOrderLine(salesOrder, expenseId, expenseLineItemId, expenseLineQty, expenseLineAmount, null, null, expenseLineDescription);
                        sublistItemIdArr.push({
                            id: expenseId,
                            itemId: expenseLineItemId,
                            recType: 'EXPENSE'
                        });
                    } else if (expenseLineItemId && expenseLineInternalId) {
                        // todo, move to separate function in editor
                        var expenseId = editor.upsertExpenseItemLine(expenseLineItemId, expenseLineAmount, expenseLineDescription, expenseLineInternalId, project);
                        editor.updateSalesOrderLine(salesOrder, expenseId, expenseLineItemId, expenseLineQty, expenseLineAmount, null, null, expenseLineDescription);
                        sublistItemIdArr.push({
                            id: expenseId,
                            itemId: expenseLineItemId,
                            recType: 'EXPENSE'
                        });
                    } else {
                        sublistItemIdArr.push({
                            id: expenseLineInternalId,
                            itemId: expenseLineItemId,
                            recType: 'EXPENSE'
                        });
                    }
                }// end of loop

                upsertSalesOrder.upsertOriginatorItem(project, salesOrder, solarSalesItems);

                var expenseRecordArr = editor.getProjectExpenseRecords(project);
                editor.removeRecordCheck(salesOrder, sublistItemIdArr, expenseRecordArr);

                var soLineCheck = salesOrder.getLineCount({
                    sublistId: 'item'
                });
                log.debug('salesorder line count expense suitelet', soLineCheck);
                if (soLineCheck > 0) {
                    var salesOrderId = salesOrder.save({
                        ignoreMandatoryFields: true
                    });
                } else {
                    if (salesOrder.id) {
                        record.delete({
                            type: record.Type.SALES_ORDER,
                            id: salesOrder.id
                        });
                        log.debug('sales order deleted - sales order has 0 lines');
                    }
                }

                if (expenseRecordArr.length) {
                    projectCost.processCostBudgetMap(projectId, 'customrecord_bb_project_bom', config);
                }

                //accountingFields.setAccountingFields(project, false);

                record.submitFields({
                    type: record.Type.JOB,
                    id: project.id,
                    values: {
                        'custentity_bb_contract_value_hist_html': contractHistory.contractHistory(project),
                        'custentity_bb_project_so': salesOrderId
                    },
                    options: {
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });

                //redirect back to project record

                redirect.toRecord({
                    id: projectId,
                    type: record.Type.JOB,
                });

                var expenseUploadScript = runtime.getCurrentScript();
                log.debug('Remaining governance units', expenseUploadScript.getRemainingUsage());

            }
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


    return {
        onRequest: onRequest
    };

});