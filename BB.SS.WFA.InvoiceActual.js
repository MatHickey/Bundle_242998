/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Invoice Actual WFA script.
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

define(['N/record', 'N/search', 'N/runtime', 'N/config'],

function(record, search, runtime, nsConfig) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @Since 2016.1
     */
    function onAction(scriptContext) {
        try {
            var projectAction = scriptContext.newRecord;
            var projectId = projectAction.getValue({fieldId: 'custrecord_bb_project'});
            var packageActionId = projectAction.getValue({fieldId: 'custrecord_bb_project_package_action'});
            var statusType = projectAction.getValue({fieldId: 'custrecord_bb_action_status_type'});
            log.debug('status type id', statusType);

            if (projectId && packageActionId) {
                // lookup the project financier payment schedule, find the matching package action trigger action and get the milestone percentage
                var projectObj = search.lookupFields({
                    type: search.Type.JOB,
                    id: projectId,
                    columns: ['custentity_bb_project_so', 'custentity_bb_financier_payment_schedule']
                });
                var soId = searchProjectSalesOrder(projectId);
                var scheduleId = (projectObj.custentity_bb_financier_payment_schedule.length > 0) ? projectObj.custentity_bb_financier_payment_schedule[0].value : null;

                log.debug('soId', soId);
                log.debug('scheduleId', scheduleId);

                var configObj = search.lookupFields({
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: projectAction.getValue({fieldId: 'custrecord_bb_proj_action_config_record'}) || 1,
                    columns: ['custrecord_bb_advpay_use_advpay', 'custrecord_bb_proc_action_from_sch_bool']
                });
                var useAdvancedPayments = configObj.custrecord_bb_advpay_use_advpay;
                var useMilestoneSchedule = configObj.custrecord_bb_proc_action_from_sch_bool;

                if (soId && scheduleId && statusType == 4 && useMilestoneSchedule) { 
                    var milestoneObj = getMatchingMilestoneDetails(scheduleId, packageActionId);
                    var milestoneArray = milestoneObj.submissionArray;
                    var finalPackage = milestoneObj.finalPackage;
                    log.debug('milestone array values', milestoneObj);
                    // possibly add a check here for already generated milestone invoice record.
                    var existingTransactionCount = checkForExistingTransaction(projectId, milestoneArray);
                    if (existingTransactionCount == 0) {
                        transformSalesOrderToInvoice(soId, milestoneArray, finalPackage, projectId);
                    }
                } else if (soId && statusType == 4 && useAdvancedPayments) {

                    var advArray = getMatchingADVMilestoneByPackageAction(projectId, packageActionId);
                    if (advArray.length > 0) {
                        var existingTrans = checkForExistingTransaction(projectId, advArray);
                        log.debug('existing transaction count', existingTrans);
                        if (existingTrans == 0) {
                            var isFinalADVPackage = checkADVFinalPackage(projectId, advArray[0].milestoneId);
                            transformSalesOrderToInvoice(soId, advArray, isFinalADVPackage, projectId);
                        }
                    }

                }
            }

        } catch (e) {
            log.error('error generating invoice actual transaction', e);
        }
        return projectAction.id;
    }


    function getMatchingMilestoneDetails(scheduleId, packageActionId) {
        var finalPackage = false;
        var finalPackageId;
        log.debug('scheduleId', scheduleId);
        log.debug('packageActionId', packageActionId);
        var submissionArray = [];
        if (scheduleId) {
            var customrecord_bb_milestone_pay_scheduleSearchObj = search.create({
                type: "customrecord_bb_milestone_pay_schedule",
                filters:
                [
                    ["internalid","anyof", scheduleId]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "custrecord_bb_m0_package_action", label: "M0 Action"}),
                    search.createColumn({name: "custrecord_bb_m0_amount", label: "M0 Amount"}),
                    search.createColumn({name: "custrecord_bb_m0_percent", label: "M0 Percent"}),
                    search.createColumn({name: "custrecord_bb_m1_percent", label: "M1 Percent"}),
                    search.createColumn({name: "custrecord_bb_m1_package_action", label: "M1 Action"}),
                    search.createColumn({name: "custrecord_bb_m1_amount", label: "M1 Amount"}),
                    search.createColumn({name: "custrecord_bb_m2_package_action", label: "M2 Action"}),
                    search.createColumn({name: "custrecord_bb_m2_percent", label: "M2 Percent"}),
                    search.createColumn({name: "custrecord_bb_m2_amount", label: "M2 Amount"}),
                    search.createColumn({name: "custrecord_bb_m3_package_action", label: "M3 Action"}),
                    search.createColumn({name: "custrecord_bb_m3_percent", label: "M3 Percent"}),
                    search.createColumn({name: "custrecord_bb_m3_amount", label: "M3 Amount"}),
                    search.createColumn({name: "custrecord_bb_m4_package_action", label: "M4 Action"}),
                    search.createColumn({name: "custrecord_bb_m4_amount", label: "M4 Amount"}),
                    search.createColumn({name: "custrecord_bb_m4_percent", label: "M4 Percent"}),
                    search.createColumn({name: "custrecord_bb_m5_package_action", label: "M5 Action"}),
                    search.createColumn({name: "custrecord_bb_m5_amount", label: "M5 Amount"}),
                    search.createColumn({name: "custrecord_bb_m5_percent", label: "M5 Percent"}),
                    search.createColumn({name: "custrecord_bb_m6_package_action", label: "M6 Action"}),
                    search.createColumn({name: "custrecord_bb_m6_amount", label: "M6 Amount"}),
                    search.createColumn({name: "custrecord_bb_m6_percent", label: "M6 Percent"}),
                    search.createColumn({name: "custrecord_bb_m7_package_action", label: "M7 Action"}),
                    search.createColumn({name: "custrecord_bb_m7_amount", label: "M7 Amount"}),
                    search.createColumn({name: "custrecord_bb_m7_percent", label: "M7 Percent"})
                ]
            });
            log.debug('search results', customrecord_bb_milestone_pay_scheduleSearchObj);
            customrecord_bb_milestone_pay_scheduleSearchObj.run().each(function(result){
                if (packageActionId == result.getValue({name: 'custrecord_bb_m0_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m0_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m0_percent'}),
                        milestoneId: 1
                    });
                } 
                if (packageActionId == result.getValue({name: 'custrecord_bb_m1_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m1_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m1_percent'}),
                        milestoneId: 3
                    });
                } 
                if (packageActionId == result.getValue({name: 'custrecord_bb_m2_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m2_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m2_percent'}),
                        milestoneId: 4
                    });
                } 
                if (packageActionId == result.getValue({name: 'custrecord_bb_m3_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m3_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m3_percent'}),
                        milestoneId: 5
                    });
                }
                if (packageActionId == result.getValue({name: 'custrecord_bb_m4_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m4_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m4_percent'}),
                        milestoneId: 8
                    });
                } 
                if (packageActionId == result.getValue({name: 'custrecord_bb_m5_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m5_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m5_percent'}),
                        milestoneId: 9
                    });
                } 
                if (packageActionId == result.getValue({name: 'custrecord_bb_m6_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m6_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m6_percent'}),
                        milestoneId: 10
                    });
                }
                if (packageActionId == result.getValue({name: 'custrecord_bb_m7_package_action'})) {
                    submissionArray.push({
                        packageActionId: result.getValue({name: 'custrecord_bb_m7_package_action'}),
                        percent: result.getValue({name: 'custrecord_bb_m7_percent'}),
                        milestoneId: 11
                    });
                }
                if (result.getValue({name: 'custrecord_bb_m7_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m7_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m6_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m6_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m5_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m5_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m4_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m4_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m3_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m3_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m2_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m2_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m1_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m1_package_action'});
                } else if (result.getValue({name: 'custrecord_bb_m0_percent'})) {
                    finalPackageId = result.getValue({name: 'custrecord_bb_m0_package_action'});
                }
               return true;
            });
            if (finalPackageId == packageActionId) {
                finalPackage = true;
            }
        }
        return {
            submissionArray: submissionArray,
            finalPackage: finalPackage
        }
    }


    function getMatchingADVMilestoneByPackageAction(projectId, packageActionId) {
        var submissionArray = [];
        if (projectId && packageActionId) {
            var customrecord_bbss_adv_sub_pay_scheduleSearchObj = search.create({
                type: "customrecord_bbss_adv_sub_pay_schedule",
                filters:
                [
                    ["custrecord_bbss_adv_subpay_project","anyof", projectId], 
                    "AND", 
                    ["custrecord_bbss_adv_subpay_action_list","anyof", packageActionId], 
                    "AND", 
                    ["custrecord_bbss_adv_subpay_transaction","anyof","@NONE@"]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_milestone", label: "Milestone"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_action_list", label: "Action"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_amount", label: "Amount"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_amount_pct", label: "Amount %"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_milestonedate", label: "Milestone Date"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_transaction", label: "Transaction"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_project", label: "Project"})
                ]
            });
            var searchResultCount = customrecord_bbss_adv_sub_pay_scheduleSearchObj.runPaged().count;
            log.debug("matching package actions on advanced milestone record count",searchResultCount);
            customrecord_bbss_adv_sub_pay_scheduleSearchObj.run().each(function(result){
                submissionArray.push({
                    packageActionId: result.getValue({name: 'custrecord_bbss_adv_subpay_action_list'}),
                    percent: result.getValue({name: 'custrecord_bbss_adv_subpay_amount_pct'}),
                    milestoneId: result.getValue({name: 'custrecord_bbss_adv_subpay_milestone'}),
                });
                return true;
            }); 
        }
        return submissionArray;
    }


    function transformSalesOrderToInvoice(soId, milestoneArray, finalPackage, projectId, advChildId, advParentId) {
        log.debug('milestone array values', milestoneArray);
        if (soId && milestoneArray.length > 0) {
            // get sales order lines with qty and bom id
            var soLineArray = getSalesOrderLineQuantity(soId);
            var invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: soId,
                toType: record.Type.INVOICE,
                isDynamic: true
            });
            invoice.setValue({
                fieldId: 'custbody_bb_milestone',
                value: milestoneArray[0].milestoneId
            });
            var companyInfo = nsConfig.load({
                type: nsConfig.Type.ACCOUNTING_PREFERENCES
            });

            invoice.setValue({
                fieldId: 'account',
                value: companyInfo.getValue({fieldId: 'ARACCOUNT'})
            });
            var milestonePercent;
            if (typeof(milestoneArray[0].percent) == 'string') {
                log.debug('converting percent from string to number');
                var rawPercent = parseFloat(milestoneArray[0].percent);
                milestonePercent = (rawPercent >= 1) ? parseFloat(milestoneArray[0].percent) / 100 : parseFloat(milestoneArray[0].percent);
            }
            if (typeof(milestoneArray[0].percent) == 'number') {
                milestonePercent = (milestoneArray[0].percent >= 1) ? parseFloat(milestoneArray[0].percent) / 100 : parseFloat(milestoneArray[0].percent);
            }

            var lineCount = invoice.getLineCount({
                sublistId: 'item'
            });
            var invoiceTotal = invoice.getValue({
                fieldId: 'total'
            });
            log.debug('total')
            if (lineCount > 0 && !finalPackage) {
                log.debug('updating lines for milestone percents');
                for (var i = 0; i < lineCount; i++) {
                    invoice.selectLine({
                        sublistId: 'item',
                        line: i
                    });
                    var currentQty = invoice.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    });
                    var itemId = parseInt(invoice.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
                    }));

                    var matchingObj = getMatchingBomRecordByBomId(soLineArray, itemId);
                    log.debug('matchingObj', matchingObj);
                    if (matchingObj != -1) {
                        var soQty = matchingObj.quantity;
                        log.debug('milestonePercent', milestonePercent);
                        var milestoneQty = soQty * milestonePercent;
                        invoice.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: milestoneQty
                        });
                    }
                    invoice.commitLine({
                        sublistId: 'item'
                    });
                }
            }
            if (advChildId && advParentId) {
                invoice.setValue({
                    fieldId: 'custbody_bbss_adv_pay_subschedlink',
                    value: advChildId
                });
                invoice.setValue({
                    fieldId: 'custbody_bbss_adv_payschedlist',
                    value: advParentId
                });
            }

            var invId = invoice.save({
                ignoreMandatoryFields: true
            });
            return invId;

            // run validation on amount
            if (finalPackage) {
                var transObj = getInvoiceAndSalesOrderTotals(projectId);
                log.debug('transObj', transObj);
                var invTotal = transObj.invTotal;
                var soTotal = transObj.soTotal;
                if (invTotal > soTotal) {
                    var adjustmentAmt = invTotal - soTotal;
                    log.debug('adjustmentAmt', adjustmentAmt);
                    var adjustmentInv = record.load({
                        type: record.Type.INVOICE,
                        id: invId,
                        isDynamic: true
                    });
                    var invLineCount = adjustmentInv.getLineCount({
                        sublistId: 'item'
                    });
                    var lineNumber = invLineCount - 2; // gets last line on order just above the subtotal line
                    log.debug('linecount', invLineCount);
                    log.debug('lineNumber', lineNumber);
                    
                    adjustmentInv.selectLine({
                        sublistId: 'item',
                        line: lineNumber
                    });
                    var lineAmount = adjustmentInv.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount'
                    });

                    var newAmount = lineAmount - adjustmentAmt;
                    log.debug('lineAmount', lineAmount);
                    log.debug('newAmount', newAmount);

                    adjustmentInv.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: newAmount
                    });
                    adjustmentInv.commitLine({
                        sublistId: 'item'
                    });
                    var id = adjustmentInv.save({
                        ignoreMandatoryFields: true
                    });

                }
            } 
        }
    }


    function checkForExistingTransaction(projectId, milestoneArray) {
        if (projectId && milestoneArray.length > 0) {
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                [
                    ["type","anyof","CustInvc"], 
                    "AND", 
                    ["custbody_bb_project","anyof", projectId], 
                    "AND", 
                    ["mainline","is","T"],
                    "AND", 
                    ["custbody_bb_milestone","anyof", milestoneArray[0].milestoneId]
               ],
               columns:
               [
                  "internalid"
               ]
            });
            var searchResultCount = invoiceSearchObj.runPaged().count;
            log.debug("invoiceSearchObj result count",searchResultCount);
            return searchResultCount;
        }
    }


    function checkADVFinalPackage(projectId, milestoneId) {
        var isFinalPackage = false;
        var customrecord_bbss_adv_sub_pay_scheduleSearchObj = search.create({
           type: "customrecord_bbss_adv_sub_pay_schedule",
            filters:
            [
                ["custrecord_bbss_adv_subpay_project","anyof", projectId], 
                "AND", 
                ["custrecord_bbss_adv_subpay_milestone","noneof","2","6","7","12"]
            ],
            columns:
            [
                search.createColumn({
                    name: "custrecord_bbss_adv_subpay_milestone",
                    summary: "MAX",
                    sort: search.Sort.DESC,
                    label: "Milestone"
                })
            ]
        });
        var searchResultCount = customrecord_bbss_adv_sub_pay_scheduleSearchObj.runPaged().count;
        log.debug("customrecord_bbss_adv_sub_pay_scheduleSearchObj result count",searchResultCount);
        customrecord_bbss_adv_sub_pay_scheduleSearchObj.run().each(function(result){
            if (milestoneId == result.getValue({name: 'custrecord_bbss_adv_subpay_milestone', summary: 'MAX'})) {
                isFinalPackage = true;
            }
            return true;
        });
        return isFinalPackage;
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


    function getSalesOrderLineQuantity(soId) {
        var soLineArray = [];
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
                search.createColumn({name: "quantitybilled", label: "Quantity Billed"})
            ]
        });
        var searchResultCount = transactionSearchObj.runPaged().count;
        log.debug("transactionSearchObj result count",searchResultCount);
        transactionSearchObj.run().each(function(result){
            soLineArray.push({
                itemId: parseInt(result.getValue({name: 'item'})),
                bomId: parseInt(result.getValue({name: 'custcol_bb_adder_bom_id'})),
                quantity: parseInt(result.getValue({name: 'quantity'})),
                billQuantity: result.getValue({name: 'quantitybilled'}),
            })
            return true;
        });

        return soLineArray;
    }


    function getInvoiceAndSalesOrderTotals(projectId) {
        var soTotal = parseFloat(0.00);
        var invTotal = parseFloat(0.00);
        if (projectId) {
            var transactionSearchObj = search.create({
                type: "transaction",
                filters:
                [
                    ["type","anyof","SalesOrd","CustInvc"], 
                    "AND", 
                    ["custbody_bb_project","anyof", projectId], 
                    "AND", 
                    ["mainline","is","T"]
                ],
                columns:
                [
                    search.createColumn({
                        name: "type",
                        summary: "GROUP",
                        label: "Type"
                    }),
                    search.createColumn({
                        name: "amount",
                        summary: "SUM",
                        label: "Amount"
                    })
                ]
            });
            var searchResultCount = transactionSearchObj.runPaged().count;
            log.debug("transactionSearchObj result count",searchResultCount);
            transactionSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var type = result.getValue({name: 'type', summary: 'GROUP'});
                var amount = result.getValue({name: 'amount', summary: 'SUM'});
                log.debug('type', type);
                if (type == 'SalesOrd') {
                    soTotal = parseFloat(amount);
                }
                if (type == 'CustInvc') {
                    invTotal = parseFloat(amount);
                }
                return true;
            });
        }
        return {
            soTotal: soTotal,
            invTotal: invTotal
        }
    }


    function getMatchingBomRecordByBomId(soLineArray, itemId) {
        var indexNumber = soLineArray.map(function(result) {return result.itemId;}).indexOf(itemId);
        if (indexNumber != -1) {
            return soLineArray[indexNumber];
        } else {
            return -1;
        }
    }


    return {
        onAction : onAction,
        checkADVFinalPackage: checkADVFinalPackage,
        transformSalesOrderToInvoice: transformSalesOrderToInvoice

    };
    
});