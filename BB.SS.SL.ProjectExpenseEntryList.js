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
            var salesOrderId = searchProjectSalesOrder(projectId);

            if (!projectId) {
                throw 'Missing project parameter';
            }

            var form = serverWidget.createForm({
                title: 'Enter Project Expense Budget Item'
            });
            
          
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

            var total = form.addField({
                id: 'custpage_expense_total',
                type: serverWidget.FieldType.FLOAT,
                label: 'Expense Total'
            });
            total.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            var configRecord = form.addField({
                id: 'custpage_config_id',
                type: serverWidget.FieldType.TEXT,
                label: 'Configuration Record ID'
            });
            configRecord.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            configRecord.defaultValue = configId || 1;

            var sublist = form.addSublist({
                id: 'custpage_expense_sublist',
                label: 'Expense Items',
                type: serverWidget.SublistType.LIST
            });
            sublist.addButton({
              id: 'custpage_add_seq'
              , label: 'Add Sequence'
            });
            // create suitelet sublist fields
            sublist = createSuiteFields(sublist);

            // perform search on project expenses - returns internal id of expense record, item id, and amount
            var projectExpenseArr = getProjectRelatedExpenseRecords(projectId);

            // function performs search of all expense items - related bom records are inserted here and matched on lines based on item id and sets qty.
            setSublistLineValues(sublist, projectExpenseArr);

            form.addSubmitButton({
                label: 'Submit Expense Budget Records'
            });

            // long text field to pass old projet bom array results pre save
            var expenseArrayField = form.addField({
                id: 'custpage_expense_array_text',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'BOM Array',
            });
            expenseArrayField.defaultValue = JSON.stringify(projectExpenseArr);

            expenseArrayField.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.CS.BomEntryListValidations';
            context.response.writePage(form);

        } else {
            // process button click here.
            
            // save Bom records where the quantity field is populated with a value greater than 0 and pass data to be set on sales order to map reduce script 
            var lineCount = context.request.getLineCount({
                group: 'custpage_expense_sublist'
            });
            var salesOrderId = context.request.parameters.custpage_sales_order;
            var projectId = context.request.parameters.custpage_project;
            var oldArr = context.request.parameters.custpage_expense_array_text;
            var configId = context.request.parameters.custpage_config_id;
            // log.debug('oldExpenseArray', oldArr);
            
            var oldBomArray;
            if (typeof oldArr == 'string') {
                oldBomArray = JSON.parse(oldArr);
            } else {
                oldBomArray = oldArr;
            }

            var soArr = [];

            if (lineCount != -1) {
                var itemRecord = context.request;
                for (var i = 0; i < lineCount; i++) {
                    var itemObject = {};
                    itemObject.itemId = parseInt(itemRecord.getSublistValue({
                        group: 'custpage_expense_sublist',
                        name: 'custpage_expense_item',
                        line: i
                    })).toFixed(0);
                    itemObject.amount = itemRecord.getSublistValue({
                        group: 'custpage_expense_sublist',
                        name: 'custpage_expense_amount',
                        line: i
                    });
                    itemObject.description = itemRecord.getSublistValue({
                        group: 'custpage_expense_sublist',
                        name: 'custpage_expense_description',
                        line: i
                    });
                    (itemObject.description) ? itemObject.description : null;
                    itemObject.itemCategory = itemRecord.getSublistValue({
                        group: 'custpage_expense_sublist',
                        name: 'custpage_expense_category',
                        line: i
                    });
                    itemObject.recordId = itemRecord.getSublistValue({
                        group: 'custpage_expense_sublist',
                        name: 'custpage_expense_internalid',
                        line: i
                    });

                    // process record from list if quantity and bom id are populated
                    if ((itemObject.amount) && (itemObject.recordId)) {
                        var indexNum = getMatchingExpenseRecordByInternalId(oldBomArray, parseInt(itemObject.recordId));
                        // log.debug('matching line object by record internalid', indexNum);
                        if (itemObject.amount != indexNum.amount) {
                            // process expense record only if the amount has changed
                            log.debug('amount change on expense item');
                            if (itemObject.amount) {
                                processExpenseRecord(itemObject.recordId, projectId, itemObject.amount, itemObject.itemId, itemObject.description);
                                itemObject.recordId = itemObject.recordId
                                itemObject['projectId'] = projectId;
                            }
                            
                        } else if (itemObject.description != indexNum.expenseDescription && itemObject.amount == indexNum.amount) {
                                processExpenseRecord(itemObject.recordId, projectId, itemObject.amount, itemObject.itemId, itemObject.description);
                                itemObject.recordId = itemObject.recordId
                                itemObject['projectId'] = projectId;
                        }
                        soArr.push(itemObject);

                    } else if ((itemObject.amount) && (!itemObject.expenseInternalId)) {
                        // brand new expense record
                        log.debug('adding new bom record has a quantity set no bom id');
                        if (itemObject.amount) {
                            var expenseId = processExpenseRecord(null, projectId, itemObject.amount, itemObject.itemId, itemObject.description);
                            itemObject.recordId = expenseId;
                            itemObject['projectId'] = projectId;
                            soArr.push(itemObject);
                        }

                    } else if ((!itemObject.amount) && (itemObject.recordId)) {
                        // delete expense record
                        itemObject['delete'] = true;
                        itemObject['recordId'] = itemObject.recordId;
                        log.debug('inactivating expense record');
                        record.submitFields({
                            type: 'customrecord_bb_project_expense',
                            id: itemObject.recordId,
                            values: {
                                'isinactive': true
                            },
                            options: {
                                ignoreMandatoryFields: true
                            }
                        });

                        soArr.push(itemObject);
                    } else {
                        // do nothing
                    }

                }// end of loop

            }// line count check
            
            var soObject = {
                soId: salesOrderId,
                project: projectId,
                items: soArr
            }

            var taskId = null;
            if (soArr.length > 0) {

                var taskParameters = {};
                taskParameters['custscript_bb_expense_object'] = soObject;

                var scriptId = 'customscript_bb_ss_proc_so_expense';
                var deploymentId = 'customdeploy_bb_ss_proc_so_expense';
                var taskType = task.TaskType.SCHEDULED_SCRIPT;

                batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);

                projectCost.processCostBudgetMap(projectId, 'customrecord_bb_project_expense', configId);

            }

            redirect.toSuitelet({
                scriptId: 'customscript_bb_sl_proj_expns_entry_list',
                deploymentId: 'customdeploy_bb_sl_proj_expns_entry_list',
                parameters: {
                    project: projectId,
                    salesOrder: salesOrderId,
                    configId: configId
                }
            });

        } // end of else statement - execute button click section

    }

    function createSuiteFields(sublist) {
        // var itemCategory = sublist.addField({
        //     id: 'custpage_expense_category',
        //     type: serverWidget.FieldType.SELECT,
        //     label: 'Expense Category',
        //     source: 'budgetcategory'
        // });


        var itemName = sublist.addField({
            id: 'custpage_expense_item_name',
            type: serverWidget.FieldType.TEXT,
            label: 'Expense Item',
        });
        var expenseDescription = sublist.addField({
          id: 'custpage_expense_description',
          type: serverWidget.FieldType.TEXTAREA,
          label: 'Description'
        });
        var expenseAmount = sublist.addField({
            id: 'custpage_expense_amount',
            type: serverWidget.FieldType.FLOAT,
            label: 'Amount'
        });
        var sequenceNum = sublist.addField({
            id: 'custpage_expense_seq_num',
            type: serverWidget.FieldType.INTEGER,
            label: 'Sequence Number'
        });
        var expenseInternalId = sublist.addField({
            id: 'custpage_expense_internalid',
            type: serverWidget.FieldType.INTEGER,
            label: 'Expense Internal ID'
        });
        var item = sublist.addField({
            id: 'custpage_expense_item',
            type: serverWidget.FieldType.SELECT,
            label: 'Expense Item',
            source: 'item'
        });
        var _seq = sublist.addField({
          id: 'custpage_expense_amount_seq_tpl'
          , type: serverWidget.FieldType.FLOAT
          , label: 'Seq'
        });


        expenseDescription.updateDisplaySize({
          height : 1,
          width : 50
        });
        expenseDescription.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.ENTRY
        });
        expenseAmount.updateDisplayType({
        displayType : serverWidget.FieldDisplayType.ENTRY
      });
        _seq.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.ENTRY
        });

        item.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        // itemCategory.updateDisplayType({
        //     displayType : serverWidget.FieldDisplayType.HIDDEN
        // });
        sequenceNum.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        expenseInternalId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        return sublist;
    }

    function setSublistLineValues (sublist, projectExpenseArr) {
        // perform search of all bom items (sorted list)
        var expenseList = search.load({
            id: 'customsearch_bb_expense_item_list'
        });
        var counter = 0;
        expenseList.run().each(function(result) {
            var itemObj = {};
            itemObj.itemId = parseInt(result.getValue(expenseList.columns[0]));
            itemObj.itemName = result.getValue(expenseList.columns[2]);
            // itemObj.budgetCategory = result.getValue(expenseList.columns[1]);
            itemObj.sequenceNum = result.getValue(expenseList.columns[3]);
            // log.debug('item object', itemObj);
            sublist = setLineValues(sublist, counter, itemObj, projectExpenseArr);
            counter++;
            return true;
        });
        return sublist;

    }


    function setLineValues(sublist, lineNumber, itemObj, projectExpenseArr) {
        if (itemObj.itemId) {
            sublist.setSublistValue({
                id: 'custpage_expense_item',
                line: lineNumber,
                value: itemObj.itemId
            });
        }
        if (itemObj.itemName) {
            var name;
            if (itemObj.itemName.indexOf(':') != -1) {
                name = itemObj.itemName.split(':').pop();
            } else {
                name = itemObj.itemName
            }
            sublist.setSublistValue({
                id: 'custpage_expense_item_name',
                line: lineNumber,
                value: name
            });
        }
        if (itemObj.budgetCategory) {
            sublist.setSublistValue({
                id: 'custpage_expense_category',
                line: lineNumber,
                value: itemObj.budgetCategory
            });
        }
        if (itemObj.sequenceNum) {
            sublist.setSublistValue({
                id: 'custpage_expense_seq_num',
                line: lineNumber,
                value: itemObj.sequenceNum
            });
        }
        // perform search on current bom item array - if match is found, set the quantity for that line else leave value set to null
        // function returns object of bom item from projectBomArr array of objects
        var index = getMatchingExpenseRecordByItemId(projectExpenseArr, itemObj.itemId);
        // log.debug('index setting sublist values', index);
        if (index != -1) {
            // log.debug('indexed bom item', index);
            if (index.internalid) {
                sublist.setSublistValue({
                    id: 'custpage_expense_internalid',
                    line: lineNumber,
                    value: parseInt(index.internalid).toFixed(0)
                });
            }
            if (index.amount) {
                sublist.setSublistValue({
                    id: 'custpage_expense_amount',
                    line: lineNumber,
                    value: index.amount
                });
            }
            if (index.expenseDescription) {
                sublist.setSublistValue({
                    id: 'custpage_expense_description',
                    line: lineNumber,
                    value: index.expenseDescription
                });
            }
        }
        return sublist;

    }


    function getProjectRelatedExpenseRecords(projectId) {
        var arr = [];
        var expenseSearch = search.load({
            id: 'customsearch_bb_proj_expense_by_project'
        });
        var additionalFilters = ["AND", ["custrecord_bb_proj_exp_project","anyof", projectId]];
        var newFilterExpression = expenseSearch.filterExpression.concat(additionalFilters);
        expenseSearch.filterExpression = newFilterExpression;

        expenseSearch.run().each(function(results) {
            var expenseObj = {};
            expenseObj.internalid = parseInt(results.getValue(expenseSearch.columns[0]));
            expenseObj.budgetCategory = results.getValue(expenseSearch.columns[1]);
            expenseObj.budgetSequenceNum = results.getValue(expenseSearch.columns[2]);
            expenseObj.itemId = parseInt(results.getValue(expenseSearch.columns[3]));
            expenseObj.amount = results.getValue(expenseSearch.columns[4]);
            expenseObj.project = results.getValue(expenseSearch.columns[5]);
            expenseObj.expenseDescription = (results.getValue(expenseSearch.columns[6])) ? results.getValue(expenseSearch.columns[6]) : null;
            arr.push(expenseObj);
            return true;
        });
        return arr;
    }


    function getMatchingExpenseRecordByInternalId(projectExpenseArr, expenseId) {
        var indexNumber = projectExpenseArr.map(function(result) {return parseInt(result.internalid);}).indexOf(expenseId);
        if (indexNumber != -1) {
            return projectExpenseArr[indexNumber];
        } else {
            return -1;
        }
    }


    function getMatchingExpenseRecordByItemId(projectExpenseArr, itemId) {
        var indexNumber = projectExpenseArr.map(function(result) {return result.itemId;}).indexOf(itemId);
        if (indexNumber != -1) {
            return projectExpenseArr[indexNumber];
        } else {
            return -1;
        }
    }


    function processExpenseRecord(expenseId, project, amount, itemId, description) {
        var expenseRecord;
        if (expenseId) {
            expenseRecord = record.load({
                type: 'customrecord_bb_project_expense',
                id: expenseId,
                isDynamic: true
            });
        } else {
            expenseRecord = record.create({
                type: 'customrecord_bb_project_expense',
            });
        }
        // set project item quantity
        expenseRecord.setValue({
            fieldId: 'custrecord_bb_proj_exp_project',
            value: project
        });
        expenseRecord.setValue({
            fieldId: 'custrecord_bb_proj_exp_item',
            value: itemId
        });
        expenseRecord.setValue({
            fieldId: 'custrecord_bb_proj_exp_amount',
            value: amount
        });
        expenseRecord.setValue({
            fieldId: 'custrecord_bb_proj_expense_desc_text',
            value: description
        });

        var id = expenseRecord.save({
            ignoreMandatoryFields: true
        });
        log.debug('created expense internal id', id);
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

    return {
        onRequest: onRequest
    };

});