/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Project Bom Upsert and sales order scheduled script processing
 */

/**
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/runtime', 'N/task', 'N/redirect','./BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing', './BB SS/SS Lib/BB.SS.MD.ProjectCost'],

function(serverWidget, record, search, runtime, task, redirect, batchProcessor, projectCost) {

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
            var configId = context.request.parameters.configId;
            var salesOrderId = (context.request.parameters.salesOrder) ? context.request.parameters.salesOrder : searchProjectSalesOrder(projectId);
            var bomStatus = context.request.parameters.bomStatus;

            if (!projectId) {
                throw 'Missing project parameter';
            }

            var form = serverWidget.createForm({
                title: 'Manage BOM Records'
            });
            form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.CS.BomEntryListValidations';

            var manufacturerAutoComplete = form.addField({
                id: 'custpage_manf_auto_complete',
                type: serverWidget.FieldType.SELECT,
                label: 'Manufacturer Filter'
            });
            manufacturerAutoComplete.addSelectOption({
                text: '',
                value: ''
            });
            getItemManufacturers(manufacturerAutoComplete);

            var categoryFilter = form.addField({
                id: 'custpage_category_auto_complete',
                type: serverWidget.FieldType.SELECT,
                label: 'Category Filter'
            });
            categoryFilter.addSelectOption({
                text: '',
                value: ''
            });
            getItemCategorySelectOption(categoryFilter);

            var missingPrices = form.addField({
                id: 'custpage_missing_price_counter',
                type: serverWidget.FieldType.INTEGER,
                label: 'Missing Price Counter'
            });
            missingPrices.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            var message = form.addField({
                id: 'custpage_highlight_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' ',
            });
            message.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            // message.defaultValue = () ? : '<b>**Highlighted items below need updated to add Pricing prior to adding them to the BOM**</b>';

            var status = form.addField({
                id: 'custpage_bom_status',
                label: 'BOM Status',
                type: serverWidget.FieldType.SELECT,
                source: 'customlist_bb_bom_status'
            });
            status.defaultValue = (bomStatus) ? bomStatus : 1;

            var project = form.addField({
                id: 'custpage_project',
                type: serverWidget.FieldType.SELECT,
                label: 'Project',
                source: 'job'
            });
            project.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            project.defaultValue = projectId;

            var soField = form.addField({
                id: 'custpage_sales_order',
                type: serverWidget.FieldType.SELECT,
                label: 'Sales Order',
                source: 'transaction'
            });
            soField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            soField.defaultValue = salesOrderId;

            var configRecord = form.addField({
                id: 'custpage_config_id',
                type: serverWidget.FieldType.TEXT,
                label: 'Configuration Record ID',
                source: 'transaction'
            });
            configRecord.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            configRecord.defaultValue = configId || 1;
            var configObj = search.lookupFields({
                type: 'customrecord_bb_solar_success_configurtn',
                id: configId || 1,
                columns: ['custrecord_bb_bom_suitelet_svd_srch']
            });
            var searchId = (configObj.custrecord_bb_bom_suitelet_svd_srch.length > 0) ? configObj.custrecord_bb_bom_suitelet_svd_srch[0].value : null;

            var sublist = form.addSublist({
                id: 'custpage_bom_sublist',
                label: 'Available BOM Items',
                type: serverWidget.SublistType.LIST
            });
            // create suitelet sublist fields
            var hasParentColumn = checkItemsForParent(searchId);
            sublist = createSuiteFields(sublist, hasParentColumn, searchId);

            // perform search on project bom item returns internal id of bom record, item id, and quantity
            var projectBomArr = getProjectRelatedBomRecords(projectId);

            // function performs search of all bom items - related bom records are inserted here and matched on lines based on item id and sets qty.
            setSublistLineValues(sublist, projectBomArr, searchId, hasParentColumn);

// copy of script here is from QA environment week of 6-12-23
// BLUSOLAR-146 begin
//          get the status of the sales order
            log.debug('start sales order logic');
            if (salesOrderId) {
                log.debug('sales order exists');
                var projectLookups = search.lookupFields({
                    type: search.Type.SALES_ORDER,
                    id: salesOrderId,
                    columns: ['status']
                });
                var soStatus = projectLookups.status[0].text;
                log.debug('soStatus', soStatus);

//              if no item fulfillments are related to the SO, and it is not closed, allow user to save the BOM
                if ((soStatus != 'Partially Fulfilled') &&
                    (soStatus != 'Pending Billing/Partially Fulfilled') &&
                    (soStatus != 'Pending Billing') &&
                    (soStatus != 'Billed') &&
                    (soStatus != 'Closed')) {
                    log.debug('status does not have IFs and is not closed, display SAVE button');
                    form.addSubmitButton({
                        label: 'Save BOM Records'
                    });
                }
            } else {
              form.addSubmitButton({
                  label: 'Save BOM Records'
              });
            }



            //form.addSubmitButton({
            //    label: 'Save BOM Records'
            //});
// BLUSOLAR-146 end

            // long text field to pass old projet bom array results pre save
            var bomArrayField = form.addField({
                id: 'custpage_bom_array_text',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'BOM Array',
            });
            bomArrayField.defaultValue = JSON.stringify(projectBomArr);

            bomArrayField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });

            context.response.writePage(form);

        } else {
            var values = {};
            // process button click here.

            // save Bom records where the quantity field is populated with a value greater than 0 and pass data to be set on sales order to map reduce script
            var lineCount = context.request.getLineCount({
                group: 'custpage_bom_sublist'
            });
            var salesOrderId = context.request.parameters.custpage_sales_order;
            var projectId = context.request.parameters.custpage_project;
            var bomStatus = context.request.parameters.custpage_bom_status;
            var oldArr = context.request.parameters.custpage_bom_array_text;
            var configId = context.request.parameters.custpage_config_id;
            log.debug('oldBomArray', oldArr);

            var oldBomArray;
            if (typeof oldArr == 'string') {
                oldBomArray = JSON.parse(oldArr);
            } else {
                oldBomArray = oldArr;
            }
            var soArr = [];
            var bomEdited = false;

            // log.debug('line count', lineCount);

            if (lineCount != -1) {
                var itemRecord = context.request;
                for (var i = 0; i < lineCount; i++) {
                    var itemObject = {};
                    itemObject.itemId = itemRecord.getSublistValue({
                        group: 'custpage_bom_sublist',
                        name: 'custpage_item',
                        line: i
                    });
                    itemObject.quantity = itemRecord.getSublistValue({
                        group: 'custpage_bom_sublist',
                        name: 'custpage_quantity',
                        line: i
                    });
                    itemObject.itemCategory = itemRecord.getSublistValue({
                        group: 'custpage_bom_sublist',
                        name: 'custpage_item_category',
                        line: i
                    });
                    itemObject.basePrice = itemRecord.getSublistValue({
                        group: 'custpage_bom_sublist',
                        name: 'custpage_base_price',
                        line: i
                    });
                    itemObject.bomId = itemRecord.getSublistValue({
                        group: 'custpage_bom_sublist',
                        name: 'custpage_bom_internalid',
                        line: i
                    });

                    log.debug('Line Object from Suitelet', itemObject);

                    // process record from list if quantity and bom id are populated
                    if ((itemObject.quantity) && (itemObject.bomId)) {
                        var indexNum = getMatchingBomRecordByInternalId(oldBomArray, itemObject.bomId);

                        log.debug('sublist qty', itemObject.quantity);
                        log.debug('old record qty', indexNum.quantity);

                        if (itemObject.quantity != indexNum.quantity) {
                            // process record only if the quantity has changed
                            log.debug('quantity change on bom item');
                            if (itemObject.basePrice) {
                                itemObject.bomId = itemObject.bomId;
                                itemObject['projectId'] = projectId;
                                // update to show immediate results on qty change from bom suitelet,
                                // trigger of bom record is in scheduled script
                                if (itemObject.bomId) {
                                    record.submitFields({
                                        type: 'customrecord_bb_project_bom',
                                        id: itemObject.bomId,
                                        values: {
                                            'custrecord_bb_project_bom_quantity': itemObject.quantity
                                        },
                                        options: {
                                            ignoreMandatoryFields: true,
                                            disableTriggers: true
                                        }
                                    });
                                    bomEdited = true;
                                }
                            }

                        }
                        soArr.push(itemObject);

                    } else if ((itemObject.quantity) && (!itemObject.bomId)) {
                        // brand new bom record
                        log.debug('adding new bom record has a quantity set no bom id');
                        if (itemObject.basePrice) {
                            itemObject.bomId = null;
                            itemObject['projectId'] = projectId;
                            soArr.push(itemObject);
                        }

                    } else if ((!itemObject.quantity) && (itemObject.bomId)) {
                        // delete bom record
                        itemObject['delete'] = true;
                        log.debug('deleting bom record');
                        soArr.push(itemObject);
                    }

                }// end of loop

            }// line count check
            values['custentity_bb_bom_status_list'] = bomStatus;
            if (soArr.length > 0) {
                bomEdited = true;
                values = getBOMAutomationRecords(projectId, values, soArr)
            }
            if (bomEdited){
                bomPrintCheck(projectId);
            }
            log.debug('values', values);
            record.submitFields({
                type: record.Type.JOB,
                id: projectId,
                values: values,
                options: {
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                }
            });

            var soObject = {
                soId: salesOrderId,
                project: projectId,
                items: soArr
            }

            var processArr = [];
            processArr.push(soObject);

            var taskId = null;
            if (soArr.length > 0) {

                var taskParameters = {};
                taskParameters['custscript_bb_ss_bom_item_array'] = processArr;

                var scriptId = 'customscript_bb_ss_proj_bom_so_process';
                var deploymentId = 'customdeploy_bb_ss_proj_bom_so_proc';
                var taskType = task.TaskType.SCHEDULED_SCRIPT;

                var taskId = batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
                projectCost.processCostBudgetMap(projectId, 'customrecord_bb_project_bom', configId);

                var stringParams = "&project="+projectId;

                redirect.toSuitelet({
                    scriptId: "customscript_bb_ss_sl_progressbar_v2",
                    deploymentId: "customdeploy_bb_ss_sl_progressbar_v2",
                    parameters: {
                        taskId: taskId,
                        mainsuiteletid: runtime.getCurrentScript().id,
                        mainsuiteletdeploy: runtime.getCurrentScript().deploymentId,
                        mainsuiteletparams: stringParams
                    }
                });

            }
            /**Not used anymore, redirecting to progressbar suitelet now
            redirect.toSuitelet({
                scriptId: 'customscript_bb_sl_proj_bom_entry_form',
                deploymentId: 'customdeploy_bb_sl_proj_bom_entry_form',
                parameters: {
                    project: projectId,
                    salesOrder: salesOrderId,
                    configId: configId,
                    bomStatus: bomStatus,
                    taskId: taskId
                }
            });*/

        } // end of else statement - execute button click section
    }


    function bomPrintCheck(projectId){
        var projectLookups = search.lookupFields({
        type: search.Type.JOB,
        id: projectId,
        columns: ['custentity_bb_bom_printed_date', 'custentity_bb_bom_edited']
        }); // 1 unit
        var bomPrintedDate = projectLookups.custentity_bb_bom_printed_date;
        var bomEdited = projectLookups.custentity_bb_bom_edited;
        log.debug('bomPrintedDate',bomPrintedDate);
        log.debug('bomEdited',bomEdited);
        if ((bomPrintedDate != null && bomPrintedDate != '') && (bomEdited == null || bomEdited == '')){
        record.submitFields({
            type: record.Type.JOB,
            id: projectId,
            values: {
            'custentity_bb_bom_edited': true
            }
        });
        }
    }

    // selection option functions
    function getItemManufacturers(fieldObj) {
        var inventoryitemSearchObj = search.create({
            type: "inventoryitem",
            filters:
                [
                    ["type","anyof","InvtPart"],
                    "AND",
                    ["isinactive","is","F"]
                ],
            columns:
                [
                    search.createColumn({
                        name: "manufacturer",
                        summary: "GROUP",
                        label: "Manufacturer"
                    })
                ]
        });
        var searchResultCount = inventoryitemSearchObj.runPaged().count;
        log.debug("inventoryitemSearchObj result count",searchResultCount);
        inventoryitemSearchObj.run().each(function(result){
            if (fieldObj) {
                fieldObj.addSelectOption({
                    text: result.getValue({name: 'manufacturer', summary: 'GROUP'}),
                    value: result.getValue({name: 'manufacturer', summary: 'GROUP'})
                })
            }
            return true;
        });
        if (fieldObj) {
            return fieldObj;
        }
    }


    function getItemCategorySelectOption(fieldObj) {
        var inventoryitemSearchObj = search.create({
            type: "inventoryitem",
            filters:
                [
                    ["type","anyof","InvtPart"],
                    "AND",
                    ["isinactive","is","F"]
                ],
            columns:
                [
                    search.createColumn({
                        name: "custitem_bb_item_category",
                        summary: "GROUP",
                        label: "Item Category"
                    })
                ]
        });
        inventoryitemSearchObj.run().each(function(result){
            if (fieldObj) {
                fieldObj.addSelectOption({
                    text: result.getText({name: 'custitem_bb_item_category', summary: 'GROUP'}),
                    value: result.getValue({name: 'custitem_bb_item_category', summary: 'GROUP'})
                })
            }
            return true;
        });
        if (fieldObj) {
            return fieldObj;
        }
    }


    function getBOMAutomationRecords(projectId, values, soItemArray) {
        // run search on bom automation records
        var itemFieldIds = [];
        var qtyFieldIds = [];
        var customrecord_bb_bom_automationSearchObj = search.create({
            type: "customrecord_bb_bom_automation",
            filters:
                [
                    ["custrecord_bb_bom_auto_config_record", "anyof", "1"]
                ],
            columns:
                [
                    "internalid",
                    "custrecord_bb_bom_auto_item_field_id",
                    "custrecord_bb_bom_auto_qty_field_id",
                    "custrecord_bb_bom_auto_def_qty_field_num"
                ]
        });
        var searchResultCount = customrecord_bb_bom_automationSearchObj.runPaged().count;
        log.debug("Bom Automation result count", searchResultCount);
        customrecord_bb_bom_automationSearchObj.run().each(function (result) {
            var itemFieldId = result.getValue({name: 'custrecord_bb_bom_auto_item_field_id'});
            var qtyFieldId = result.getValue({name: 'custrecord_bb_bom_auto_qty_field_id'});
            var defaultQty = result.getValue({name: 'custrecord_bb_bom_auto_def_qty_field_num'});
            if (!defaultQty && itemFieldId && qtyFieldId) {
                itemFieldIds.push(itemFieldId);
                qtyFieldIds.push(qtyFieldId);
            }
            return true;
        });
        if (itemFieldIds.length > 0 && projectId) {
            log.debug('revised columns', itemFieldIds)
            var projObj = search.lookupFields({
                type: search.Type.JOB,
                id: projectId,
                columns: itemFieldIds
            });
            log.debug('projObj',projObj);
            var counter = 0;
            for (var key in projObj) {
                // var counter = 0;
                log.debug('key', key);
                log.debug('value', projObj[key]);
                if (projObj[key] instanceof Array && projObj[key].length > 0) {
                    var itemId = projObj[key][0].value;
                    var indexNumber = getMatchingBomRecordByItemId(soItemArray, itemId);
                    log.debug('index number', indexNumber)
                    if (indexNumber != -1) {
                        var qtyField = qtyFieldIds[counter];
                        values[qtyField] = indexNumber.quantity;
                    }
                }
                counter++;
            }
        }
        return values;
    }

    function createSuiteFields(sublist, hasParentColumn, searchId) {

        //Static columns (item, qty, price)
        var item = sublist.addField({
            id: 'custpage_item',
            type: serverWidget.FieldType.SELECT,
            label: 'BOM Item',
            source: 'item'
        });

        var quantity = sublist.addField({
            id: 'custpage_quantity',
            type: serverWidget.FieldType.INTEGER,
            label: 'Quantity'
        });

        var basePrice = sublist.addField({
            id: 'custpage_base_price',
            type: serverWidget.FieldType.FLOAT,
            label: 'Item Price'
        });

        var itemCategory = sublist.addField({
            id: 'custpage_item_category',
            type: serverWidget.FieldType.SELECT,
            label: 'Item Category',
            source: 'customrecord_bb_item_category'
        }).updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        var itemManufacturer = sublist.addField({
            id: 'custpage_item_manufacturer',
            type: serverWidget.FieldType.SELECT,
            label: 'Item Manufacturer',
            source: 'manufacturer'
        }).updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        var bomInternalId = sublist.addField({
            id: 'custpage_bom_internalid',
            type: serverWidget.FieldType.INTEGER,
            label: 'BOM Internal ID'
        }).updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        if (hasParentColumn) {
            var itemParent = sublist.addField({
                id: 'custpage_bom_item_parent',
                type: serverWidget.FieldType.SELECT,
                label: 'Item Parent',
                source: 'item'
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
        }

        //Dynamic columns
        var objDynamicColumns = search.load({
            id: searchId
        }).columns;
        for (var i = 0; i < objDynamicColumns.length; i++) {
            sublist.addField({
                id: 'custpage_dynamic_columns_' + i,
                type: serverWidget.FieldType.TEXTAREA,
                label: objDynamicColumns[i].label ? objDynamicColumns[i].label : objDynamicColumns[i].name
            }).updateDisplayType({
                displayType : serverWidget.FieldDisplayType.DISABLED
            });
        }

        quantity.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.ENTRY
        });
        item.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.INLINE
        });

        return sublist;
    }

    function setSublistLineValues (sublist, projectBomArr, searchId, hasParentColumn) {
        // perform search of all bom items (sorted list)
        var sortedArray = [];
        if (searchId) {
            var itemList = search.load({
                id: searchId
            });
            var columnsBeforeNewOnes = itemList.columns;
            var searchColumns = itemList.columns;
            searchColumns.push(
                {
                    name: "custitem_bb_item_category",
                    label: "Item Category",
                    type: "select",
                    sortdir: "NONE"
                },
                {
                    name: "manufacturer",
                    label: "Item Manufacturer",
                    type: "select",
                    sortdir: "NONE"
                },
                {
                    name: "baseprice",
                    label: "Base Price",
                    type: "currency2",
                    sortdir: "NONE"
                }
            );
            itemList.columns = searchColumns;
            itemList.run().each(function(data) {
                var itemObj = {};
                for (var c = 0; c < columnsBeforeNewOnes.length; c++) {
                    itemObj.itemId = data.id;
                    itemObj.itemCategory = data.getValue({
                        name: 'custitem_bb_item_category'
                    });
                    itemObj.itemManufacturer = data.getValue({
                        name: 'manufacturer'
                    });
                    itemObj.price = data.getValue({
                        name: 'baseprice'
                    });
                    if (itemList.columns[c].name == data.columns[c].name) {
                        if (data.getText({ name: data.columns[c] })) {
                            itemObj['custpage_dynamic_columns_' + c] = data.getText({
                                name: data.columns[c]
                            });
                        } else {
                            itemObj['custpage_dynamic_columns_' + c] = data.getValue({
                                name: data.columns[c]
                            });
                        }
                    } else {
                        log.audit('ERROR:', 'Error while trying to set a dynamic column in the SuiteLet, please review if all of them are correctly set in the saved search.');
                        throw 'Error with a dynamic column.'
                    }

                    var index = getMatchingBomRecordByItemId(projectBomArr, itemObj.itemId);
                    if (index != -1) {
                        // log.debug('indexed bom item', index);
                        itemObj.quantity = index.quantity;
                        itemObj.bomId = index.bomId;
                    } else {
                        itemObj.quantity = 0;
                        itemObj.bomId = ''
                    }
                }
                sortedArray.push(itemObj);
                return true;
            });
            // perform a sort on on the array of objects then loop over and set values
            var finalArray = sortedArray.sort(function(a, b) {
                return parseInt(b.quantity) - parseInt(a.quantity);
            });
            log.debug('sorted array results', finalArray);
            // loop over sorted results and set sublist values
            if (finalArray.length > 0) {
                for (var x = 0; x < finalArray.length; x++) {
                    var obj = finalArray[x];
                    sublist = setLineValues(sublist, x, obj, projectBomArr, hasParentColumn, columnsBeforeNewOnes);
                }
            }
            return sublist;
        } else {
            log.error('error', 'saved search id is not defined on the solar configuration record. Please select the saved search for  field ')
        }

    }

    function setLineValues(sublist, lineNumber, itemObj, projectBomArr, hasParentColumn, columnsBeforeNewOnes) {
        //Static columns
        if (itemObj.itemId) {
            sublist.setSublistValue({
                id: 'custpage_item',
                line: lineNumber,
                value: itemObj.itemId
            });
        }
        if (itemObj.quantity) {
            // log.debug('indexed bom item', index);
            sublist.setSublistValue({
                id: 'custpage_quantity',
                line: lineNumber,
                value: itemObj.quantity
            });
        }
        if (itemObj.bomId) {
            sublist.setSublistValue({
                id: 'custpage_bom_internalid',
                line: lineNumber,
                value: itemObj.bomId
            });
        }
        if (itemObj.itemCategory) {
            sublist.setSublistValue({
                id: 'custpage_item_category',
                line: lineNumber,
                value: itemObj.itemCategory
            });
        }
        if (itemObj.itemManufacturer) {
            sublist.setSublistValue({
                id: 'custpage_item_manufacturer',
                line: lineNumber,
                value: itemObj.itemManufacturer
            });
        }
        if (itemObj.price) {
            sublist.setSublistValue({
                id: 'custpage_base_price',
                line: lineNumber,
                value: itemObj.price
            });
        }
        if (itemObj.parent && hasParentColumn) {
            sublist.setSublistValue({
                id: 'custpage_bom_item_parent',
                line: lineNumber,
                value: itemObj.parent
            });
        }

        //Dynamic columns
        for (var i = 0; i < columnsBeforeNewOnes.length; i++) {
            if (itemObj['custpage_dynamic_columns_' + i]) {
                sublist.setSublistValue({
                    id: 'custpage_dynamic_columns_' + i,
                    line: lineNumber,
                    value: itemObj['custpage_dynamic_columns_' + i]
                });
            }
        }

        return sublist;

    }

    function getProjectRelatedBomRecords(projectId) {
        var arr = [];
        var bomList = search.load({
            id: 'customsearch_bb_project_bom_records'
        });
        var additionalFilters = ["AND", ["custrecord_bb_project_bom_project","anyof", projectId]];
        log.debug('Project Related BOM Records', additionalFilters);
        var newFilterExpression = bomList.filterExpression.concat(additionalFilters);
        bomList.filterExpression = newFilterExpression;

        var resultIndex = 0;
        var resultStep = 1000;

        do {
            var resultSet = bomList.run();
            var results = resultSet.getRange({
                start : resultIndex,
                end : resultIndex + resultStep
            });

            for (var i = 0; i < results.length; i++) {
                var bomRecord = {};
                bomRecord.bomId = results[i].getValue({
                    name : resultSet.columns[0],
                });

                bomRecord.itemId = results[i].getValue({
                    name : resultSet.columns[1]
                });

                bomRecord.quantity = results[i].getValue({
                    name : resultSet.columns[2]
                });

                bomRecord.project = results[i].getValue({
                    name : resultSet.columns[3]
                });

                arr.push(bomRecord);
            }

            resultIndex = resultIndex + resultStep;

        } while (results.length > 0)

        // log.debug('Project Related BOM records Array', arr);
        return arr;
    }

    function getMatchingBomRecordByItemId(projectBomArr, itemId) {
        var indexNumber = projectBomArr.map(function(result) {return result.itemId;}).indexOf(itemId);
        if (indexNumber != -1) {
            return projectBomArr[indexNumber];
        } else {
            return -1;
        }
    }

    function getMatchingBomRecordByInternalId(projectBomArr, bomId) {
        var indexNumber = projectBomArr.map(function(result) {return result.bomId;}).indexOf(bomId);
        if (indexNumber != -1) {
            return projectBomArr[indexNumber];
        } else {
            return -1;
        }
    }

    function processBomRecord(bomId, project, quantity, itemId) {
        var bomRecord;
        if (bomId) {
            bomRecord = record.load({
                type: 'customrecord_bb_project_bom',
                id: bomId,
                isDynamic: true
            });
        } else {
            bomRecord = record.create({
                type: 'customrecord_bb_project_bom',
            });
        }
        // set project item quantity
        bomRecord.setValue({
            fieldId: 'custrecord_bb_project_bom_project',
            value: project
        });
        bomRecord.setValue({
            fieldId: 'custrecord_bb_project_bom_item',
            value: itemId
        });
        bomRecord.setValue({
            fieldId: 'custrecord_bb_project_bom_quantity',
            value: quantity
        });

        var id = bomRecord.save({
            ignoreMandatoryFields: true
        });
        return id;
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

    function checkItemsForParent(searchId) {
        var hasParentColumn = false;
        if (searchId) {
            var checkforParent = search.load({
                id: searchId
            });
            var results = checkforParent.run();
            results.columns.forEach(function(col) {
                log.debug('column', col);
                if (col.name == 'parent') {
                    hasParentColumn = true;
                }
            });
        }
        return hasParentColumn;
    }


    return {
        onRequest: onRequest
    };

});