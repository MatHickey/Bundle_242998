/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Project Bom Upsert and sales order map reduce call
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
                    title: 'Add/Edit BOM Records'
                });
                form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.CS.InvoiceActualValidations';

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
                getInvoiceParentSelectOption(categoryFilter);


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
                    type: serverWidget.FieldType.RICHTEXT,
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

                var sublist = form.addSublist({
                    id: 'custpage_bom_sublist',
                    label: 'Available BOM Items',
                    type: serverWidget.SublistType.LIST
                });
                // create suitelet sublist fields
                sublist = createSuiteFields(sublist);

                // perform search on project bom item returns internal id of bom record, item id, and quantity
                var projectBomArr = getProjectRelatedBomRecords(projectId);

                var vendorItemArray = itemsWithVendorPricing();

                var soDetailArray = getSalesOrderLineQuantity(salesOrderId);

                // function performs search of all bom items - related bom records are inserted here and matched on lines based on item id and sets qty.
                setSublistLineValues(sublist, projectBomArr, vendorItemArray, soDetailArray);


                form.addSubmitButton({
                    label: 'Save BOM Records'
                });

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
                // process button click here.
                var values = {};
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
                // log.debug('typeof oldBomArray', typeof oldBomArray);

                var soArr = [];

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
                        itemObject.type = itemRecord.getSublistValue({
                            group: 'custpage_bom_sublist',
                            name: 'custpage_item_type',
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
                        itemObject.description = itemRecord.getSublistValue({
                            group: 'custpage_bom_sublist',
                            name: 'custpage_description',
                            line: i
                        });
                        itemObject.invoiceSubParent = itemRecord.getSublistValue({
                            group: 'custpage_bom_sublist',
                            name: 'custpage_invoice_sub_parent',
                            line: i
                        });
                        itemObject.invoicedQty = itemRecord.getSublistValue({
                            group: 'custpage_bom_sublist',
                            name: 'custpage_invoiced_quantity',
                            line: i
                        });
                        itemObject.relatedPurchaseOrder = itemRecord.getSublistValue({
                            group: 'custpage_bom_sublist',
                            name: 'custpage_related_purchase_order',
                            line: i
                        });
                        itemObject.fulfilledQty = itemRecord.getSublistValue({
                            group: 'custpage_bom_sublist',
                            name: 'custpage_fulfill_qty',
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
                                    itemObject.bomId = itemObject.bomId
                                    itemObject['projectId'] = projectId;
                                }
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
                        } else {

                        }

                    }// end of loop

                }// line count check
                values['custentity_bb_bom_status_list'] = bomStatus;
                if (soArr.length > 0) {
                    values = getBOMAutomationRecords(projectId, values, soArr);
                }
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
                log.debug('so array length', soArr.length);
                if (soArr.length > 0) {

                    var taskParameters = {};
                    taskParameters['custscript_bb_ss_bom_item_array'] = processArr;

                    var scriptId = 'customscript_bb_ss_proj_bom_so_process';
                    var deploymentId = 'customdeploy_bb_ss_proj_bom_so_proc';
                    var taskType = task.TaskType.SCHEDULED_SCRIPT;

                    batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);

                    projectCost.processCostBudgetMap(projectId, 'customrecord_bb_project_bom', configId);

                }

                redirect.toSuitelet({
                    scriptId: 'customscript_bb_ss_sl_project_bom',
                    deploymentId: 'customdeploy_bb_ss_sl_project_bom',
                    parameters: {
                        project: projectId,
                        salesOrder: salesOrderId,
                        configId: configId,
                        bomStatus: bomStatus,

                    }
                });

            } // end of else statement - execute button click section

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

        function createSuiteFields(sublist) {
            var itemCategory = sublist.addField({
                id: 'custpage_item_category',
                type: serverWidget.FieldType.SELECT,
                label: 'Category',
                source: 'item'
            });
            var invoiceSubParent = sublist.addField({
                id: 'custpage_invoice_sub_parent',
                type: serverWidget.FieldType.SELECT,
                label: 'Sub Category',
                source: 'item'
            });
            var manufacturer = sublist.addField({
                id: 'custpage_item_manufacturer',
                type: serverWidget.FieldType.TEXT,
                label: 'Manufacturer'
            });
            var item = sublist.addField({
                id: 'custpage_item',
                type: serverWidget.FieldType.SELECT,
                label: 'BOM Item',
                source: 'item'
            });
            var description = sublist.addField({
                id: 'custpage_description',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Description'
            });
            var preferredVendor = sublist.addField({
                id: 'custpage_preferred_vendor',
                type: serverWidget.FieldType.SELECT,
                label: 'Preferred Vendor',
                source: 'vendor'
            });
            var vendorPrice = sublist.addField({
                id: 'custpage_vendor_price',
                type: serverWidget.FieldType.FLOAT,
                label: 'Vendor Price'
            });
            var quantity = sublist.addField({
                id: 'custpage_quantity',
                type: serverWidget.FieldType.INTEGER,
                label: 'Quantity'
            });
            var invoicedQty = sublist.addField({
                id: 'custpage_invoiced_quantity',
                type: serverWidget.FieldType.FLOAT,
                label: 'Invoiced Quantity'
            });
            var fulfilledQty = sublist.addField({
                id: 'custpage_fulfill_qty',
                type: serverWidget.FieldType.FLOAT,
                label: 'Fulfilled Quantity'
            });
            var basePrice = sublist.addField({
                id: 'custpage_base_price',
                type: serverWidget.FieldType.FLOAT,
                label: 'Item Price'
            });
            var relatedPurchaseOrder = sublist.addField({
                id: 'custpage_related_purchase_order',
                type: serverWidget.FieldType.SELECT,
                label: 'Related Purchase Order',
                source: 'transaction'
            });
            var bomInternalId = sublist.addField({
                id: 'custpage_bom_internalid',
                type: serverWidget.FieldType.INTEGER,
                label: 'BOM Internal ID'
            });
            var itemType = sublist.addField({
                id: 'custpage_item_type',
                type: serverWidget.FieldType.TEXT,
                label: 'Item Type'
            });


            quantity.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.ENTRY
            });
            description.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.ENTRY
            });
            basePrice.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.ENTRY
            });
            item.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            preferredVendor.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            itemCategory.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            // bomInternalId.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
            itemType.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            invoiceSubParent.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });
            relatedPurchaseOrder.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            return sublist;
        }

        function setSublistLineValues (sublist, projectBomArr, vendorItemArray, soDetailArray) {
            // get items returned in search and push to array, items with set bomItem grouping will get description items passed into the array values
            var configObj = search.lookupFields({
                type: 'customrecord_bb_solar_success_configurtn',
                id: 1,
                columns: ['custrecord_bb_bom_suitelet_svd_srch']
            });
            var searchId = (configObj.custrecord_bb_bom_suitelet_svd_srch.length > 0) ? configObj.custrecord_bb_bom_suitelet_svd_srch[0].value : 'customsearch_bb_bom_invent_item_wmanu';
            var descriptionArray = getDescriptionItems();
            var itemSublistArray = [];
            var itemList = search.load({
                id: searchId
            });

            var resultIndex = 0;
            var resultStep = 1000;

            var resultSet = itemList.run();
            var results = resultSet.getRange({
                start : resultIndex,
                end : resultIndex + resultStep
            });

            for (var i = 0; i < results.length; i++) {
                var itemObj = {};
                for (var c = 0; c < resultSet.columns.length; c++) {
                    // log.debug('result set column result', resultSet.columns[c]);
                    if (resultSet.columns[c].label == 'Internal ID') {
                        itemObj.itemId = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Invoice Parent') {
                        itemObj.itemCategory = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Base Price') {
                        itemObj.price  = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Item Sub Category') {
                        itemObj.subCategory  = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Manufacturer') {
                        itemObj.manufacturer  = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Parent') {
                        itemObj.parent  = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Description') {
                        itemObj.description  = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Invoice Sub Parent') {
                        itemObj.invoiceSubParent  = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    if (resultSet.columns[c].label == 'Type') {
                        itemObj.type = results[i].getValue({ name: resultSet.columns[c] });
                    }
                    itemObj.custominsert = false;
                }// end of column loop
                itemSublistArray.push(itemObj);
            }// end of line loop

            insertNewBomRecordsAsItemLine(itemSublistArray, projectBomArr, itemSublistArray);

            insertDescriptions(itemSublistArray, descriptionArray);

            log.debug('itemSublistArray', itemSublistArray);

            if (itemSublistArray.length > 0) {
                for (var x = 0; x < itemSublistArray.length; x++) {
                    var lineObj = itemSublistArray[x];
                    sublist = setLineValues(sublist, x, lineObj, projectBomArr, vendorItemArray, soDetailArray);
                }
            }

            return sublist;
        }

        function setLineValues(sublist, lineNumber, itemObj, projectBomArr, vendorItemArray, soDetailArray) {
            if (itemObj.itemId) {
                sublist.setSublistValue({
                    id: 'custpage_item',
                    line: lineNumber,
                    value: itemObj.itemId
                });
            }
            // perform search on current bom item array - if match is found, set the quantity for that line else leave value set to null
            // function returns object of bom item from projectBomArr array of objects
            var bomValues = getMatchingBomRecordByItemIdFiltered(projectBomArr, itemObj.itemId, itemObj.custominsert);

            var vendorIndex = getMatchingBomRecordByItemId(vendorItemArray, itemObj.itemId, itemObj.custominsert);

            // set bom related fields
            if (bomValues.length > 0) {
                log.debug('bom value', bomValues);
                var itemId = bomValues[0].itemId;
                var bomId = bomValues[0].bomId;
                var quantity = bomValues[0].quantity;
                var description = bomValues[0].bomDescription;
                var amount = bomValues[0].bomItemAmount;
                var soIndex = getMatchingBomRecordByBomIdFiltered(soDetailArray, bomId);
                sublist.setSublistValue({
                    id: 'custpage_bom_internalid',
                    line: lineNumber,
                    value: bomId
                });

                sublist.setSublistValue({
                    id: 'custpage_quantity',
                    line: lineNumber,
                    value: quantity
                });

                if (description) {
                    sublist.setSublistValue({
                        id: 'custpage_description',
                        line: lineNumber,
                        value: description
                    });
                }
                if (amount) {
                    sublist.setSublistValue({
                        id: 'custpage_base_price',
                        line: lineNumber,
                        value: amount
                    });
                } else  {
                    sublist.setSublistValue({
                        id: 'custpage_base_price',
                        line: lineNumber,
                        value: itemObj.price
                    });
                }
                if (soIndex.length > 0) {
                    // log.debug('soIndex', soIndex);
                    sublist.setSublistValue({
                        id: 'custpage_invoiced_quantity',
                        line: lineNumber,
                        value: soIndex[0].billQuantity
                    });
                    if (soIndex[0].relatedPurchaseOrder) {
                        sublist.setSublistValue({
                            id: 'custpage_related_purchase_order',
                            line: lineNumber,
                            value: soIndex[0].relatedPurchaseOrder
                        });
                    }
                    if (soIndex[0].fulfilledQty) {
                        sublist.setSublistValue({
                            id: 'custpage_fulfill_qty',
                            line: lineNumber,
                            value: soIndex[0].fulfilledQty
                        });
                    }
                }
            } else {
                if (itemObj.description) {
                    sublist.setSublistValue({
                        id: 'custpage_description',
                        line: lineNumber,
                        value: itemObj.description
                    });
                }
                if (itemObj.price) {
                    sublist.setSublistValue({
                        id: 'custpage_base_price',
                        line: lineNumber,
                        value: itemObj.price
                    });
                }
            }
            // set vendor related fields
            if (vendorIndex != -1) {
                if (vendorIndex.vendor) {
                    sublist.setSublistValue({
                        id: 'custpage_preferred_vendor',
                        line: lineNumber,
                        value: vendorIndex.vendor
                    });
                }
                if (vendorIndex.vendorPrice) {
                    sublist.setSublistValue({
                        id: 'custpage_vendor_price',
                        line: lineNumber,
                        value: vendorIndex.vendorPrice
                    });
                }
            }

            if (itemObj.itemCategory) {
                sublist.setSublistValue({
                    id: 'custpage_item_category',
                    line: lineNumber,
                    value: itemObj.itemCategory
                });
            }
            if (itemObj.manufacturer) {
                sublist.setSublistValue({
                    id: 'custpage_item_manufacturer',
                    line: lineNumber,
                    value: itemObj.manufacturer
                });
            }
            if (itemObj.type) {
                sublist.setSublistValue({
                    id: 'custpage_item_type',
                    line: lineNumber,
                    value: itemObj.type
                });
            }
            if (itemObj.invoiceSubParent) {
                sublist.setSublistValue({
                    id: 'custpage_invoice_sub_parent',
                    line: lineNumber,
                    value: itemObj.invoiceSubParent
                });
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
                    bomRecord.bomDescription = results[i].getValue({
                        name : resultSet.columns[4]
                    });
                    bomRecord.bomItemAmount = results[i].getValue({
                        name : resultSet.columns[5]
                    });
                    bomRecord.itemCategory = results[i].getValue({
                        name : resultSet.columns[6]
                    });
                    bomRecord.invoiceSubParent = results[i].getValue({
                        name : resultSet.columns[7]
                    });
                    bomRecord.manufacturer = results[i].getValue({
                        name : resultSet.columns[8]
                    });
                    bomRecord.type = results[i].getValue({
                        name : resultSet.columns[9]
                    });
                    bomRecord.custominsert = false;

                    arr.push(bomRecord);
                }

                resultIndex = resultIndex + resultStep;

            } while (results.length > 0)

            return arr;
        }

        function itemsWithVendorPricing() {
            var array = [];
            var inventoryitemSearchObj = search.create({
                type: "inventoryitem",
                filters:
                    [
                        ["type","anyof","InvtPart"],
                        "AND",
                        ["isinactive","is","F"],
                        "AND",
                        ["othervendor","noneof","@NONE@"],
                        "AND",
                        ["ispreferredvendor","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({
                            name: "itemid",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({name: "vendorcost", label: "Vendor Price"}),
                        search.createColumn({name: "othervendor", label: "Vendor"}),
                        search.createColumn({name: "vendorcostentered", label: "Vendor Price (Entered)"})
                    ]
            });
            var pages = inventoryitemSearchObj.runPaged();
            pages.pageRanges.forEach(function(pageRange) {
                var page = pages.fetch(pageRange);
                page.data.forEach(function(result) {
                    array.push({
                        itemId: result.getValue({name: 'internalid'}),
                        vendor: result.getValue({name: 'othervendor'}),
                        vendorPrice: result.getValue({name: 'vendorcostentered'}),
                    });
                });
            });
            // log.debug('item with vendor pricing array', array);
            return array;
        }

        function getDescriptionItems() {
            var descriptionArray = [];
            var descriptionitemSearchObj = search.create({
                type: "descriptionitem",
                filters:
                    [
                        ["type","anyof","Description"]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });
            var searchResultCount = descriptionitemSearchObj.runPaged().count;
            log.debug("descriptionitemSearchObj result count",searchResultCount);
            descriptionitemSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                descriptionArray.push(result.getValue({name: 'internalid'}))
                return true;
            });
            return descriptionArray;
        }

        function insertDescriptions(itemSublistArray, descriptionArray) {
            if (descriptionArray.length > 0) {
                for (var d = 0; d < descriptionArray.length; d++) {
                    var descriptionId = descriptionArray[d];
                    var index = getMatchingItemByInvoiceParent(itemSublistArray, descriptionId);
                    // log.debug('index for description item', index);
                    if (index != -1) {
                        var lineObj = {};
                        // lineObj.itemId = descriptionId;
                        lineObj.itemCategory = descriptionId;
                        itemSublistArray.splice(index.indexNumber, 0, lineObj);
                    }
                    var subParentIndex = getMatchingItemByInvoiceSubParentParent(itemSublistArray, descriptionId);
                    // log.debug('subParentIndex', subParentIndex);
                    if (subParentIndex != -1) {
                        var subObj = {};
                        subObj.invoiceSubParent = descriptionId;
                        subObj.itemCategory = subParentIndex.object.itemCategory;
                        itemSublistArray.splice(subParentIndex.indexNumber, 0, subObj);
                    }
                }
            }
        }

        function insertNewBomRecordsAsItemLine(itemSublistArray, projectBomArr, itemSublistArray) {
            if (projectBomArr.length > 0) {
                var addedBomArray = getDuplicateValues(projectBomArr);
                if (addedBomArray.length > 0) {
                    for (var d = 0; d < addedBomArray.length; d++) {
                        var dupValues = addedBomArray[d];
                        if (dupValues.length > 0) {
                            for (var x = 0; x < dupValues.length; x++) {
                                if (x != 0) {
                                    var obj = dupValues[x];
                                    obj['price'] = obj.bomItemAmount;
                                    obj['custominsert'] = true;
                                    log.debug('duplicate object', obj);
                                    var itemId = dupValues[x].itemId;
                                    var index = getBomObjectByItemId(itemSublistArray, itemId)
                                    if (index != -1) {
                                        itemSublistArray.splice(index.indexNumber, 0, obj);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        function getDuplicateValues(array) {
            var object = {};
            var result = [];

            for(var i = 0; i < array.length; i++){
                if(object[array[i].itemId] == undefined){
                    object[array[i].itemId] = [];
                    object[array[i].itemId].push(array[i]);
                } else {
                    object[array[i].itemId].push(array[i]);
                }
            }
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    var storedArray = object[key];
                    if (storedArray.length > 1) {
                        result.push(storedArray);
                    }
                }
            }
            return result;
        }

        //Index lookup functions
        function getMatchingBomRecordByItemId(projectBomArr, itemId) {
            var indexNumber = projectBomArr.map(function(result) {return result.itemId;}).indexOf(itemId);
            if (indexNumber != -1) {
                return projectBomArr[indexNumber];
            } else {
                return -1;
            }
        }

        function getMatchingBomRecordByItemIdFiltered(projectBomArr, itemId, customInsert) {
            var filteredArray = projectBomArr.filter(function(result) {
                if (customInsert && itemId) {
                    if (result.itemId == itemId && customInsert == result.custominsert) {
                        return result
                    }
                } else if (itemId == result.itemId && !customInsert) {
                    return result;
                }

            });
            return filteredArray;
        }

        function getMatchingBomRecordByBomIdFiltered(projectBomArr, bomId) {
            var filteredArray = projectBomArr.filter(function(result) {
                if (bomId) {
                    if (result.bomId == bomId) {
                        return result
                    }
                }
            });
            return filteredArray;
        }


        function getBomObjectByItemId(projectBomArr, itemId) {
            var indexNumber = projectBomArr.map(function(result) {return result.itemId;}).indexOf(itemId);
            if (indexNumber != -1) {
                return {
                    object: projectBomArr[indexNumber],
                    indexNumber: indexNumber
                }
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

        function getMatchingItemByInvoiceParent(array, itemId) {
            var indexNumber = array.map(function(result) {return result.itemCategory;}).indexOf(itemId);
            if (indexNumber != -1) {
                return {
                    indexNumber: indexNumber,
                    object: array[indexNumber]
                }
            } else {
                return -1;
            }
        }

        function getMatchingItemByInvoiceSubParentParent(array, itemId) {
            var indexNumber = array.map(function(result) {return result.invoiceSubParent;}).indexOf(itemId);
            if (indexNumber != -1) {
                return {
                    indexNumber: indexNumber,
                    object: array[indexNumber]
                }
            } else {
                return -1;
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

        function getInvoiceParentSelectOption(fieldObj) {
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
                            name: "custitem_bb_item_invoice_parent",
                            summary: "GROUP",
                            label: "Invoice Parent"
                        })
                    ]
            });
            inventoryitemSearchObj.run().each(function(result){
                if (fieldObj) {
                    fieldObj.addSelectOption({
                        text: result.getText({name: 'custitem_bb_item_invoice_parent', summary: 'GROUP'}),
                        value: result.getValue({name: 'custitem_bb_item_invoice_parent', summary: 'GROUP'})
                    })
                }
                return true;
            });
            if (fieldObj) {
                return fieldObj;
            }
        }

        function getSalesOrderLineQuantity(soId) {
            log.debug('sales order id in line quantity check', soId);
            var soLineArray = [];
            if (soId) {
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters:
                        [
                            ["internalid","anyof",soId],
                            "AND",
                            ["mainline","is","F"],
                            "AND",
                            ["custcol_bb_adder_bom_id","isnotempty",""]
                        ],
                    columns:
                        [
                            search.createColumn({name: "item", label: "Item"}),
                            search.createColumn({name: "custcol_bb_adder_bom_id", label: "Adder/BOM ID"}),
                            search.createColumn({name: "quantity", label: "Quantity"}),
                            search.createColumn({name: "quantitybilled", label: "Quantity Billed"}), //quantityfulfilled
                            search.createColumn({name: "purchaseorder", label: "Created PO"}),
                            search.createColumn({name: "quantityshiprecv", label: "Fulfilled Quantity"}),
                        ]
                });
                var searchResultCount = transactionSearchObj.runPaged().count;
                log.debug("transactionSearchObj result count",searchResultCount);
                transactionSearchObj.run().each(function(result){
                    soLineArray.push({
                        itemId: result.getValue({name: 'item'}),
                        bomId: parseInt(result.getValue({name: 'custcol_bb_adder_bom_id'})),
                        quantity: parseInt(result.getValue({name: 'quantity'})),
                        billQuantity: result.getValue({name: 'quantitybilled'}),
                        relatedPurchaseOrder: result.getValue({name: 'purchaseorder'}),
                        fulfilledQty: (result.getValue({name: 'quantityshiprecv'})) ? result.getValue({name: 'quantityshiprecv'}) : null,
                    })
                    return true;
                });
            }

            return soLineArray;
        }


        return {
            onRequest: onRequest
        };

    });