/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Wright
 */
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/runtime', 'N/redirect'],

    function(record, search, serverWidget, runtime, redirect) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            try {
                if (context.request.method == 'GET') {

                    var projectId = context.request.parameters.recordId;
                    var aiaRecordID = context.request.parameters.aiaRecordID || getAIARecordIdByProject(projectId);
                    log.debug('recordId', projectId);
                    log.debug('aiaRecordId', aiaRecordID);

                    var form = serverWidget.createForm({
                        title: 'Payment Application'
                    });
                    form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.CS.AIABilling';

                    var projectField = form.addField({
                        id: 'custpage_bb_aia_bill_project',
                        label: 'Project',
                        type: serverWidget.FieldType.SELECT,
                        source: 'job'
                    });
                    projectField.defaultValue = (projectId) ? projectId : null;

                    projectField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });

                    if (projectId) {
                        //create the search function here for get all data
                        var headerObj = getAIABIllingLineResults(projectId, aiaRecordID); // results here are used to set the header suitelet fields

                    }
                    ;

                    var aiaRecordField = form.addField({
                        id: 'custpage_bb_aia_bill_id',
                        label: 'Payment Application Record',
                        type: serverWidget.FieldType.SELECT,
                        source: 'customrecord_bb_aia_billing'
                    });
                    aiaRecordField.defaultValue = aiaRecordID;
                    aiaRecordField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });

                    var contractAmountField = form.addField({
                        id: 'custpage_bb_aia_bill_contract_amt',
                        label: 'Contract Amount',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    contractAmountField.defaultValue = headerObj.contractAmount;

                    var changeOrderTotal = form.addField({
                        id: 'custpage_bb_aia_bill_chng_ord_amt',
                        label: 'Change Order Total',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    changeOrderTotal.defaultValue = headerObj.changeOrderTotal;

                    var setDefaultItems = form.addField({
                        id: 'custpage_bb_aia_bill_set_default_item',
                        label: 'Set Default Item',
                        type: serverWidget.FieldType.CHECKBOX
                    });

                    var retainage = form.addField({
                        id: 'custpage_bb_aia_bill_retainage_prct',
                        label: 'Retainage',
                        type: serverWidget.FieldType.PERCENT
                    });
                    retainage.defaultValue = headerObj.retainage;

                    var materialsStored = form.addField({
                        id: 'custpage_bb_aia_bill_mat_str_prcnt',
                        label: 'Materials Stored',
                        type: serverWidget.FieldType.PERCENT
                    });
                    materialsStored.defaultValue = headerObj.materialsStored;

                    var totalRetainage = form.addField({
                        id: 'custpage_bb_aia_bill_total_retain_amt',
                        label: 'Total Retainage',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    totalRetainage.defaultValue = headerObj.totalRetainage;

                    var totalEarnLessRetain = form.addField({
                        id: 'custpage_bb_aia_bill_ernd_lessretn_amt',
                        label: 'Total Earned Less Retainage',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    totalEarnLessRetain.defaultValue = headerObj.totalLessRetainage;

                    var lessPrevCertFor = form.addField({
                        id: 'custpage_bb_aia_bill_les_prev_cert_amt',
                        label: 'Less Previous Certification For Payment',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    lessPrevCertFor.defaultValue = headerObj.lessPrevCert;

                    var currentPaymentDue = form.addField({
                        id: 'custpage_bb_aia_bill_curr_pay_due_amt',
                        label: 'Current Payment Due',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    currentPaymentDue.defaultValue = headerObj.currentPaymentDue;

                    var balToFinishPlusRetain = form.addField({
                        id: 'custpage_bb_aia_bill_bal_to_finish_amt',
                        label: 'Balance to Finish Plus Retainage',
                        type: serverWidget.FieldType.CURRENCY
                    });
                    balToFinishPlusRetain.defaultValue = headerObj.balanceToFinish;

                    var salesOrder = form.addField({
                        id: 'custrecord_bb_aia_bill_sales_order',
                        label: 'Sales Order',
                        type: serverWidget.FieldType.SELECT,
                        source: 'transaction'
                    });

                    salesOrder.defaultValue = (headerObj.salesOrder) ? headerObj.salesOrder : null;

                    salesOrder.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });

                    form.addSubmitButton({
                        label: 'Submit'
                    });
                    form.addButton({
                        id: 'custpage_print',
                        label: 'Print Payment Application',
                        functionName: 'print'
                    });

                    var aiaSublist = form.addSublist({
                        id: 'custpage_aia_list',
                        type: serverWidget.SublistType.INLINEEDITOR,
                        label: 'Schedule of Values'
                    });

                    log.debug('headerObj', headerObj);
                    setSublistLines(aiaSublist, headerObj);
                    context.response.writePage(form)
                } else {
                    var aiaObj = {};
                    // process the button click here.
                    aiaObj.project = context.request.parameters.custpage_bb_aia_bill_project;
                    aiaObj.recordId = context.request.parameters.custpage_bb_aia_bill_id;
                    aiaObj.contractAmt = context.request.parameters.custpage_bb_aia_bill_contract_amt;
                    aiaObj.changeOrderTotal = context.request.parameters.custpage_bb_aia_bill_chng_ord_amt;
                    aiaObj.retainage = context.request.parameters.custpage_bb_aia_bill_retainage_prct;
                    aiaObj.materialsStored = context.request.parameters.custpage_bb_aia_bill_mat_str_prcnt;
                    aiaObj.totalRetainage = context.request.parameters.custpage_bb_aia_bill_total_retain_amt;
                    aiaObj.totalEarnLessRetain = context.request.parameters.custpage_bb_aia_bill_ernd_lessretn_amt;
                    aiaObj.lessPrevCertFor = context.request.parameters.custpage_bb_aia_bill_les_prev_cert_amt;
                    aiaObj.currentPaymentDue = context.request.parameters.custpage_bb_aia_bill_curr_pay_due_amt;
                    aiaObj.balanceToFinish = context.request.parameters.custpage_bb_aia_bill_bal_to_finish_amt;
                    log.debug('aiaObj parameters', aiaObj);
                    var lineArr = [];
                    var invArr = [];


                    var aiaLine = context.request;
                    var lineCount = aiaLine.getLineCount({
                        group: 'custpage_aia_list'
                    });
                    if (lineCount > 0) {
                        for (var i = 0; i < lineCount; i++) {
                            var lineObj = {};
                            lineObj['parent'] = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_parent',
                                line: i
                            });
                            lineObj['balanceToFinish'] = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_bb_aia_bill_line_bal_fin_amt',
                                line: i
                            });
                            lineObj.parent = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_parent',
                                line: i
                            });
                            lineObj.descrOfWork = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_line_descrpt_item',
                                line: i
                            });
                            lineObj.descrText = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_line_descrpt_text',
                                line: i
                            });
                            lineObj.scheduledValue = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_lin_scheduled_amt',
                                line: i
                            });
                            lineObj.fromPrevApp = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_from_prev_app_amt',
                                line: i
                            });
                            lineObj.thisPeriodAmt = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_line_period_amt',
                                line: i
                            });
                            lineObj.matsStored = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_line_mat_store_prcnt',
                                line: i
                            });
                            lineObj.totalCompletedStoredToDate = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_line_cmpt_str_amt',
                                line: i
                            });
                            lineObj.gCPercent = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_bb_aia_bill_line_gc_percent',
                                line: i
                            });
                            lineObj.retainageAmt = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_line_retain_amt',
                                line: i
                            });
                            lineObj.internalId = aiaLine.getSublistValue({
                                group: 'custpage_aia_list',
                                name: 'custpage_aia_bill_internalid',
                                line: i
                            });
                            lineArr.push(lineObj);
                            if (lineObj.thisPeriodAmt && lineObj.gCPercent) {
                                invArr.push(lineObj);
                            }
                        }
                        aiaObj.lines = lineArr;
                        aiaObj.invLines = invArr;
                    }
                    log.debug('AIA Obj', aiaObj);
                    //generate AIA Record and Lines
                    var aiaRecordID = createAIARecord(aiaObj);
                    invoiceAIARecord(aiaObj);

                    redirect.toSuitelet({
                        scriptId: 'customscript_bb_ss_sl_aia_billing',
                        deploymentId: 'customdeploy_bb_ss_sl_aia_billing',
                        parameters: {
                            recordId: aiaObj.project,
                            aiaRecordID: aiaRecordID
                        }
                    })
                }
            }catch (e) {
                log.error('ERROR', e);
                pageHandler(context.response, e.message);
            }
        }

        function getAIABIllingLineResults(projectId, recordId) {
            var counter = 0;
            var filters = [["isinactive", "is", "F"], "AND", ["custrecord_bb_aia_bill_project", "anyof",projectId]];
            if (recordId) {
                filters.push("AND", ["internalid", "anyof", recordId])
            }
            var customrecord_bb_aia_billingSearchObj = search.create({
                type: "customrecord_bb_aia_billing",
                filters: filters,
                columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        // search.createColumn({
                        //     name: "name",
                        //     sort: search.Sort.ASC,
                        //     label: "Name"
                        // }),
                        search.createColumn({name: "custrecord_bb_aia_bill_contract_amt", label: "Contract Amount"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_chng_ord_amt", label: "Change Order Total"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_retainage_prct", label: "Retainage"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_mat_str_prcnt", label: "Materials Stored"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_total_retain_amt", label: "Total Retainage"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_ernd_lessretn_amt", label: "Total Earned Less Retainage"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_les_prev_cert_amt", label: "Less Previous Certification For"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_curr_pay_due_amt", label: "Current Payment Due"}),
                        search.createColumn({name: "custrecord_bb_aia_bill_bal_to_finish_amt", label: "Balance to Finish Plus Retainage"}),
                        //TO DO add ascending to sort the lines
                        search.createColumn({
                            name: "internalid",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "custrecord_bb_aia_bill_line_bal_fin_amt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Balance to Finish"
                        }),
                        search.createColumn({
                            name: "custrecord_aia_bill_line_descrpt_item",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Description of Work"
                        }),
                        search.createColumn({
                            name: "custrecord_bb_aia_bill_from_prev_app_amt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "From Previous Application"
                        }),
                        search.createColumn({
                            name: "custrecord_bb_aia_bill_line_gc_percent",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "G/C %"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "custrecord_aia_bill_line_mat_store_prcnt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Materials Stored"
                        }),
                        search.createColumn({
                            name: "custrecord_aia_bill_parent",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Parent"
                        }),
                        search.createColumn({
                            name: "custrecord_aia_bill_line_retain_amt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Retainage Amount"
                        }),
                        search.createColumn({
                            name: "custrecord_aia_bill_lin_scheduled_amt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Scheduled Value"
                        }),
                        search.createColumn({
                            name: "custrecord_aia_bill_line_period_amt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "This Period Amount"
                        }),
                        search.createColumn({
                            name: "custrecord_bb_aia_bill_line_cmpt_str_amt",
                            join: "CUSTRECORD_AIA_BILL_PARENT",
                            label: "Total Completed and Stored To Date"
                        }),
                        search.createColumn({name: "custrecord_bb_aia_bill_sales_order", label: "Sales Order"})
                    ]
            });
            var searchResultCount = customrecord_bb_aia_billingSearchObj.runPaged().count;
            log.debug("customrecord_bb_aia_billing_lineSearchObj result count",searchResultCount);
            var lineArray = [];
            var obj = {};
            customrecord_bb_aia_billingSearchObj.run().each(function(result){
                var lineObj = {};
                //here will be define the header details
                if (counter == 0) {
                    obj.balanceToFinish = result.getValue({name: 'custrecord_bb_aia_bill_bal_to_finish_amt'});
                    obj.parent = result.getValue({name: 'internalid'});
                    obj.projectId = projectId;
                    obj.contractAmount = result.getValue({name: "custrecord_bb_aia_bill_contract_amt"});
                    obj.changeOrderTotal = result.getValue({name: "custrecord_bb_aia_bill_chng_ord_amt"});
                    obj.retainage = result.getValue({name: "custrecord_bb_aia_bill_retainage_prct"});
                    obj.materialsStored = result.getValue({name: "custrecord_bb_aia_bill_mat_str_prcnt"});
                    obj.totalRetainage = result.getValue({name: "custrecord_bb_aia_bill_total_retain_amt"});
                    obj.totalLessRetainage = result.getValue({name: "custrecord_bb_aia_bill_ernd_lessretn_amt"});
                    obj.lessPrevCert = result.getValue({name: "custrecord_bb_aia_bill_les_prev_cert_amt"});
                    obj.currentPaymentDue = result.getValue({name: "custrecord_bb_aia_bill_curr_pay_due_amt"});
                    obj.salesOrder = result.getValue({name: "custrecord_bb_aia_bill_sales_order"});
                };
                // define the line details
                lineObj.internalId = result.getValue({name: "internalid", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.balanceToFinish = result.getValue({name: "custrecord_bb_aia_bill_line_bal_fin_amt", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.descrOfWork = result.getValue({name: "custrecord_aia_bill_line_descrpt_item", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.descrText = result.getText({name: 'custrecord_aia_bill_line_descrpt_item', join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.fromPrevApp = result.getValue({name: "custrecord_bb_aia_bill_from_prev_app_amt",join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.gCPercent = result.getValue({name: "custrecord_bb_aia_bill_line_gc_percent", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.matsStored = result.getValue({name: "custrecord_aia_bill_line_mat_store_prcnt", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.parent = result.getValue({name: 'internalid'});
                lineObj.retainageAmt = result.getValue({name: "custrecord_aia_bill_line_retain_amt", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.scheduledValue = result.getValue({name: "custrecord_aia_bill_lin_scheduled_amt", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.thisPeriodAmt = result.getValue({name: "custrecord_aia_bill_line_period_amt", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineObj.totalCompletedStoredToDate = result.getValue({name: "custrecord_bb_aia_bill_line_cmpt_str_amt", join: "CUSTRECORD_AIA_BILL_PARENT"});
                lineArray.push(lineObj);
                counter++;
                return true;
            });
            obj.lines = lineArray;
            return obj;
        }

        function setSublistLines(sublist, obj) {

            createSuiteletFields(sublist);
            if(obj.lines.length > 0) {
                for (var i = 0; i < obj.lines.length; i++) {
                    var lineObj = obj.lines[i];
                    if (lineObj.internalId) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_internalid',
                            line: i,
                            value: lineObj.internalId
                        });
                    }
                    if (lineObj.balanceToFinish) {
                        sublist.setSublistValue({
                            id: 'custpage_bb_aia_bill_line_bal_fin_amt',
                            line: i,
                            value: lineObj.balanceToFinish
                        });
                    }
                    if (lineObj.parent) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_parent',
                            line: i,
                            value: lineObj.parent
                        });
                    };
                    if (lineObj.descrOfWork) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_line_descrpt_item',
                            line: i,
                            value: lineObj.descrOfWork
                        });
                    };
                    if (lineObj.descrText) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_line_descrpt_text',
                            line: i,
                            value: lineObj.descrText
                        });
                    };
                    if (lineObj.scheduledValue) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_lin_scheduled_amt',
                            line: i,
                            value: lineObj.scheduledValue
                        });
                    };
                    if (lineObj.fromPrevApp) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_from_prev_app_amt',
                            line: i,
                            value: lineObj.fromPrevApp
                        });
                    };
                    if (lineObj.thisPeriodAmt) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_line_period_amt',
                            line: i,
                            value: lineObj.thisPeriodAmt
                        });
                    };
                    if (lineObj.matsStored) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_line_mat_store_prcnt',
                            line: i,
                            value: lineObj.matsStored
                        });
                    };
                    if (lineObj.totalCompletedStoredToDate) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_line_cmpt_str_amt',
                            line: i,
                            value: lineObj.totalCompletedStoredToDate
                        });
                    };
                    if (lineObj.gCPercent) {
                        sublist.setSublistValue({
                            id: 'custpage_bb_aia_bill_line_gc_percent',
                            line: i,
                            value: lineObj.gCPercent
                        });
                    };
                    if (lineObj.retainageAmt) {
                        sublist.setSublistValue({
                            id: 'custpage_aia_bill_line_retain_amt',
                            line: i,
                            value: lineObj.retainageAmt
                        });
                    };
                }
            }
        }

        function createSuiteletFields(aiaSublist) {
            var internalId = aiaSublist.addField({
                id: 'custpage_aia_bill_internalid',
                type: serverWidget.FieldType.TEXT,
                label: 'Internal ID'
            });
            //internalId.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});

            var parent = aiaSublist.addField({
                id: 'custpage_aia_bill_parent',
                type: serverWidget.FieldType.SELECT,
                label: 'Parent',
                source: 'customrecord_bb_aia_billing'
            });
            //parent.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});


            var descOfWork = aiaSublist.addField({
                id: 'custpage_aia_bill_line_descrpt_item',
                type: serverWidget.FieldType.SELECT,
                label: 'Description of Work'
            });
            descOfWork = setSublistItemsForScheduleOfValue(descOfWork);


            var scheduledValue = aiaSublist.addField({
                id: 'custpage_aia_bill_lin_scheduled_amt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Scheduled Value'
            });

            var gcPercent = aiaSublist.addField({
                id: 'custpage_bb_aia_bill_line_gc_percent',
                type: serverWidget.FieldType.PERCENT,
                label: 'G/C %'
            });

            var fromPrevApplication = aiaSublist.addField({
                id: 'custpage_aia_bill_from_prev_app_amt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'From Previous Application'
            });
            fromPrevApplication.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

            var thisPeriodAmt = aiaSublist.addField({
                id: 'custpage_aia_bill_line_period_amt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'This Period Amount'
            });
            thisPeriodAmt.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});


            var materialsStored = aiaSublist.addField({
                id: 'custpage_aia_bill_line_mat_store_prcnt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Materials Stored'
            });

            var totalCompleteStoredToDate = aiaSublist.addField({
                id: 'custpage_aia_bill_line_cmpt_str_amt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Total Completed and Stored to Date'
            });

            var balToFinish = aiaSublist.addField({
                id: 'custpage_bb_aia_bill_line_bal_fin_amt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Balance to Finish'
            });
            //balToFinish.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

            var retainAmt = aiaSublist.addField({
                id: 'custpage_aia_bill_line_retain_amt',
                type: serverWidget.FieldType.CURRENCY,
                label: 'Retainage Amount'
            });
        }

        function createAIARecord(aiaObj) {
            log.debug('aiaObj', aiaObj);
            if (aiaObj.lines.length > 0 && aiaObj.recordId) {
                var aiaRecord = record.load({type: 'customrecord_bb_aia_billing', id: aiaObj.recordId, isDynamic: true})
            }
            else {
                var aiaRecord = record.create({type: 'customrecord_bb_aia_billing', isDynamic: true})
            }
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_project', value: aiaObj.project});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_contract_amt', value: aiaObj.contractAmt});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_chng_ord_amt', value: aiaObj.changeOrderTotal});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_retainage_prct', value: parseFloat(aiaObj.retainage)/100});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_mat_str_prcnt', value: parseFloat(aiaObj.materialsStored)/100});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_total_retain_amt', value: aiaObj.totalRetainage});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_ernd_lessretn_amt', value: aiaObj.totalEarnLessRetain});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_les_prev_cert_amt', value: aiaObj.lessPrevCertFor});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_curr_pay_due_amt', value: aiaObj.currentPaymentDue});
            aiaRecord.setValue({fieldId:'custrecord_bb_aia_bill_bal_to_finish_amt', value: aiaObj.balanceToFinish});

            var soId = aiaRecord.getValue({fieldId: 'custrecord_bb_aia_bill_sales_order'});
            var aiaRecordId = aiaRecord.save();

            for (var i = 0; i < aiaObj.lines.length; i++) {
                var lineId = aiaObj.lines[i].internalId;
                if (lineId) {
                    var aiaLineRecord = record.load({type:'customrecord_bb_aia_billing_line', id: lineId, isDynamic: true});
                }
                else {
                    var aiaLineRecord = record.create({type:'customrecord_bb_aia_billing_line', isDynamic: true});
                }
                aiaLineRecord.setValue({fieldId:'custrecord_aia_bill_parent', value: aiaRecordId});
                aiaLineRecord.setValue({fieldId:'custrecord_aia_bill_line_descrpt_item', value: aiaObj.lines[i].descrOfWork});
                aiaLineRecord.setValue({fieldId:'custrecord_aia_bill_lin_scheduled_amt', value: aiaObj.lines[i].scheduledValue});
                aiaLineRecord.setValue({fieldId:'custrecord_bb_aia_bill_from_prev_app_amt', value: aiaObj.lines[i].fromPrevApp});
                aiaLineRecord.setValue({fieldId:'custrecord_aia_bill_line_period_amt', value: aiaObj.lines[i].thisPeriodAmt});
                aiaLineRecord.setValue({fieldId:'custrecord_aia_bill_line_mat_store_prcnt', value: parseFloat(aiaObj.lines[i].materialsStored)});
                aiaLineRecord.setValue({fieldId:'custrecord_bb_aia_bill_line_cmpt_str_amt', value: aiaObj.lines[i].totalCompletedStoredToDate});
                aiaLineRecord.setValue({fieldId:'custrecord_bb_aia_bill_line_gc_percent', value: parseFloat(aiaObj.lines[i].gCPercent)});
                aiaLineRecord.setValue({fieldId:'custrecord_bb_aia_bill_line_bal_fin_amt', value: aiaObj.lines[i].balanceToFinish});
                aiaLineRecord.setValue({fieldId:'custrecord_aia_bill_line_retain_amt', value: aiaObj.lines[i].retainageAmt});

                var aiaLineRecordId = aiaLineRecord.save();
                aiaObj.lines[i].internalId = aiaLineRecordId;
            }
            values = {};
            if (soId) {
                soId = updateSalesOrder(aiaObj, soId);
            } else {
                soId = createSalesOrder(aiaObj);
            }
            if (soId) {
                values['custrecord_bb_aia_bill_sales_order'] = soId;
            }
            values['custrecord_bb_aia_bill_curr_pay_due_amt'] = 0;
            record.submitFields({
                type: 'customrecord_bb_aia_billing',
                id: aiaRecordId,
                values: values,
                options: {ignoreMandatoryFields: true}
            });
            return aiaRecordId;
        }

        function createSalesOrder(aiaObj) {
            var projObj = search.lookupFields({
                type: search.Type.JOB,
                id: aiaObj.project,
                columns: [
                    'custentity_bb_financier_customer',
                    'custentity_bb_project_location',
                    'subsidiary'
                ]
            })
            var salesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });
            salesOrder.setValue({fieldId: 'entity', value:(projObj.custentity_bb_financier_customer.length > 0) ? projObj.custentity_bb_financier_customer[0].value : null});
            salesOrder.setValue({fieldId: 'subsidiary', value:projObj.subsidiary[0].value});
            salesOrder.setValue({fieldId: 'trandate', value: new Date()});
            salesOrder.setValue({fieldId: 'location', value:(projObj.custentity_bb_project_location.length > 0) ? projObj.custentity_bb_project_location[0].value : null});

            for (var i = 0; i < aiaObj.lines.length; i++) {
                var lineId = aiaObj.lines[i].internalId;
                log.debug('lineId', lineId);
                salesOrder.selectNewLine({sublistId: 'item'});
                salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value:aiaObj.lines[i].descrOfWork});
                salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_ss_aia_work_description', value:aiaObj.lines[i].descrText});
                salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value:1});
                salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value:aiaObj.lines[i].scheduledValue});
                salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_aia_billing_line_id', value: lineId});
                salesOrder.commitLine('item');
            }
            aiaObj.soId = salesOrder.save({ignoreMandatoryFields: true});
            return aiaObj.soId;
        }

        function updateSalesOrder(aiaObj, salesOrderId) {
            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: true
            });

            for (var i = 0; i < aiaObj.lines.length; i++) {
                var lineId = aiaObj.lines[i].internalId;
                var index = salesOrder.findSublistLineWithValue({sublistId: 'item', fieldId:'custcol_bb_aia_billing_line_id', value: lineId });
                if(index != -1) {
                    salesOrder.selectLine({sublistId: 'item', line: index});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value:aiaObj.lines[i].descrOfWork, line: i});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_ss_aia_work_description', value:aiaObj.lines[i].descrText});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value:1, line: i});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value:aiaObj.lines[i].scheduledValue, line: i});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_aia_billing_line_id', value: lineId, line: i});
                    salesOrder.commitLine('item');
                } else {
                    salesOrder.selectNewLine({sublistId: 'item'});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value:aiaObj.lines[i].descrOfWork});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_ss_aia_work_description', value:aiaObj.lines[i].descrText});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value:1});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value:aiaObj.lines[i].scheduledValue});
                    salesOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_aia_billing_line_id', value: lineId});
                    salesOrder.commitLine('item');
                }
            }
            aiaObj.soId = salesOrder.save({ignoreMandatoryFields: true});
            return aiaObj.soId;
        }

        function invoiceAIARecord(aiaObj) {
            var removeLineArr = [];
            if (aiaObj.invLines.length > 0 && aiaObj.soId) {
                var invoice = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: aiaObj.soId,
                    toType: record.Type.INVOICE,
                    isDynamic: true
                });

                var bbConfigId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_solar_sucess_configuration'});
                

                var acctLookUp = search.lookupFields({
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: bbConfigId,
                    columns: ['custrecord_bb_schedule_values_default_ar']
                });

                var account = acctLookUp.custrecord_bb_schedule_values_default_ar[0].value;

                log.debug('account',account);
                //invoice.setValue({fieldId: 'account', value: runtime.getCurrentScript().getParameter({name: 'custscript_bb_aia_account'})});
                invoice.setValue({fieldId: 'account', value: account});
                var invLineCount = invoice.getLineCount({sublistId: 'item'});
                for (var i = 0; i < invLineCount; i++) {
                    invoice.selectLine({sublistId: 'item', line: i});
                    var aiaBillingId = parseInt(invoice.getCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_aia_billing_line_id'}));
                    var index = aiaObj.invLines.map(function (data) {
                        return data.internalId
                    }).indexOf(aiaBillingId);
                    log.debug('index', index);
                    if (index == -1) {
                        removeLineArr.push(aiaBillingId);
                        //invoice.removeLine({sublistId: 'item', line: i});
                    } else {
                        var invLineObj = aiaObj.invLines[index];
                        log.debug('invLineObj', invLineObj)
                        var gcPercent = parseFloat(invLineObj.gCPercent) / 100;
                        log.debug('gcPercent', gcPercent);
                        invoice.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: gcPercent / 1});
                        invoice.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: invLineObj.thisPeriodAmt});

                        try {
                            log.debug('sched val', parseFloat(invLineObj.scheduledValue));
                            log.debug('TPA', parseFloat(invLineObj.thisPeriodAmt));
                            log.debug('TCSTD', (invLineObj.balanceToFinish != null) ? parseFloat(invLineObj.balanceToFinish) : 0);
                            var TCSTD = (invLineObj.totalCompletedStoredToDate != null) ? parseFloat(invLineObj.totalCompletedStoredToDate) : 0;
                            var balanceToFinish = parseFloat(invLineObj.scheduledValue) - (parseFloat(invLineObj.thisPeriodAmt) + TCSTD);
                            var totalCompStoredToDate = parseFloat(invLineObj.thisPeriodAmt) + TCSTD;
                            log.debug('TCSTD', balanceToFinish);
                            record.submitFields({
                                type: 'customrecord_bb_aia_billing_line',
                                id: invLineObj.internalId,
                                values: {
                                    'custrecord_aia_bill_line_period_amt': null,
                                    'custrecord_bb_aia_bill_line_bal_fin_amt': balanceToFinish,
                                    'custrecord_bb_aia_bill_line_gc_percent': null,
                                    'custrecord_bb_aia_bill_line_cmpt_str_amt': totalCompStoredToDate
                                },
                                options: {
                                    ignoreMandatoryFields: true
                                }
                            })
                        } catch (e) {
                            log.error('error', e);
                        }

                    }
                    invoice.commitLine({sublistId: 'item'});

                }
                log.debug('removeLineArr', removeLineArr);
                if (removeLineArr.length > 0) {
                    for (var t = 0; t < removeLineArr.length; t++) {
                        var index = invoice.findSublistLineWithValue({sublistId: 'item', fieldId:'custcol_bb_aia_billing_line_id', value: removeLineArr[t] });
                        if (index != -1) {
                            invoice.removeLine({sublistId: 'item', line: index});
                        }
                    }
                }
                invoice.save({ignoreMandatoryFields: true});

            }
        }

        function getAIARecordIdByProject(projectId) {
            var aiaRecordID = null;
            var customrecord_bb_aia_billingSearchObj = search.create({
                type: "customrecord_bb_aia_billing",
                filters:
                    [
                        ["custrecord_bb_aia_bill_project","anyof",projectId],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"})
                    ]
            });
            var searchResultCount = customrecord_bb_aia_billingSearchObj.runPaged().count;
            log.debug("customrecord_bb_aia_billingSearchObj result count",searchResultCount);
            var result = customrecord_bb_aia_billingSearchObj.run().getRange({start: 0, end: 1});
            if (result.length > 0) {
                aiaRecordID = result[0].getValue({name: "internalid"});
            }
            return aiaRecordID;
        }
        function isEmpty (stValue) {
            return ((stValue === '' || stValue == null || false) || (stValue.constructor === Array && stValue.length === 0) || (stValue.constructor === Object && (function (v) {
                for (var k in v)
                    return false;
                return true;
            })(stValue)));
        };

        function setSublistItemsForScheduleOfValue(descOfWork){
            var itemSearchObj = search.create({
                type: "item",
                filters:
                    [
                        ["custitem_bb_show_in_schedule_of_values","is","T"],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "itemid",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({name: "internalid", label: "Internal ID"})
                    ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            log.debug("itemSearchObj result count",searchResultCount);
            if(searchResultCount > 0) {
                itemSearchObj.run().each(function (result) {
                    // .run().each has a limit of 4,000 results

                    descOfWork.addSelectOption({
                        value: result.getValue('internalid'),
                        text: result.getValue('itemid')
                    });

                    return true;
                });
            }

            return descOfWork;
        }

        function pageHandler(response, message){
            var form = serverWidget.createForm({
                title: "Something Went Wrong"
            });
            var script = "win = window.close();";
            form.addButton({
                id: 'custpage_btn_close',
                label: 'Close',
                functionName: script
            });
            var outputHTMLField = form.addField({
                id: 'custpage_output_html',
                label: 'Output',
                type: serverWidget.FieldType.INLINEHTML
            });
            outputHTMLField.defaultValue = message;
            outputHTMLField.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            });
            response.writePage(form);
        }


        return {
            onRequest: onRequest
        };

    });
