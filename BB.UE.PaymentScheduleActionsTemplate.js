/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 *@NModuleScope Public
 */

 /*
 * Copyright 2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/record', 'N/search', 'N/query', 'N/task', './BB SS/SS Lib/BB.MD.AdvPaymentModules', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'], 
    function (record, search, query, task, advpay, taskProcessor) {

    function beforeSubmit(context) {
        var rec = context.newRecord;
        var templateid = rec.getValue('custrecord_bb_ss_advpay_template');
        var financier = rec.getValue('custrecord_bbss_advpay_financier_list');
        log.debug('before template', templateid);
        var projectId = rec.getValue({fieldId: 'custrecord_bbss_advpay_project_list'});
        if (templateid) {
            var amount = rec.getValue('custrecord_bbss_advpay_amount');
            log.debug('before amount', amount);
            var dealerpct = rec.getValue('custrecord_bbss_advpay_dealer_fee_perc');
            var dealerFeeTotal = rec.getValue('custrecord_bbss_advpay_dealer_fee_perc');
            log.debug('dealer pct', dealerpct);

            if (amount && dealerpct && !dealerFeeTotal) {
                var dealertotal = parseFloat(dealerpct) / 100 * parseFloat(amount);
                log.debug('dealer total', dealertotal);
                rec.setValue({ fieldId: 'custrecord_bbss_advpay_dealer_fee_total', value: dealertotal });
            }

            if (financier) {
                var sql = "SELECT SSC.custrecord_bb_advpay_use_advpay AS usepayments, SSC.custrecord_bb_direct_pay_item AS configdirectitem, CR.custentity_bb_dealer_fee_item AS customdealeritem, CR.id AS custid, SSC.custrecord_bb_direct_pay_search AS configdirectsearch, CR.custentity_bb_direct_pay_item AS customerdirectpay FROM customrecord_bb_solar_success_configurtn SSC JOIN customer CR ON CR.id = CR.id WHERE SSC.id like 1 AND CR.id like ?"
                var results = query.runSuiteQL({ query: sql, params: [financier] });
                results = results.asMappedResults();
                if (!rec.getValue({ fieldId: 'custrecord_bbss_advpay_dealer_fee_item' }) && results[0].customdealeritem) rec.setValue({ fieldId: 'custrecord_bbss_advpay_dealer_fee_item', value: results[0].customdealeritem });

                if (!rec.getValue({ fieldId: 'custrecord_bbss_advpay_directpayitem' }) && (results[0].configdirectitem || results[0].customerdirectpay)) {
                    if (results[0].customerdirectpay) rec.setValue({ fieldId: 'custrecord_bbss_advpay_directpayitem', value: results[0].customerdirectpay });
                    if (!results[0].customerdirectpay) rec.setValue({ fieldId: 'custrecord_bbss_advpay_directpayitem', value: results[0].configdirectitem });
                }

                var directPayAmount = null;
                var directPaySearch = results[0].configdirectsearch;
                if (directPaySearch) {
                    var directPay = search.load({
                        id: directPaySearch
                    });
                    log.debug('project id', projectId);
                    if (projectId) {
                        var additionalFilters = ["AND", ["custbody_bb_project","anyof", projectId]];
                        var newFilterExpression = directPay.filterExpression.concat(additionalFilters);
                        directPay.filterExpression = newFilterExpression;
                        directPay.run().each(function(results) {
                            directPayAmount = results.getValue({name: 'amount', summary: 'SUM'});
                        });
                        log.debug('direct pay amount from search', directPayAmount);
                        if (directPayAmount) {
                            rec.setValue({ fieldId: 'custrecord_bbss_advpay_direct_pay_amt', value: directPayAmount });
                        }
                    }
                }
            }
            // rec.setValue({ fieldId: 'custrecord_bbss_advpay_dealer_fee_total', value: dealertotal });
        }
    }

    function afterSubmit(context) {
        var trigger = context.type;
        var advPaymentRecord = context.newRecord;
        var advPaymentRecordId = advPaymentRecord.id;
        var projectId = advPaymentRecord.getValue({fieldId: 'custrecord_bbss_advpay_project_list'});
        var templateId = advPaymentRecord.getValue({fieldId: 'custrecord_bb_ss_advpay_template'});
        var genmilestones = advPaymentRecord.getValue('custrecord_bb_advpay_milestone_created');
        var financier = advPaymentRecord.getValue('custrecord_bbss_advpay_financier_list');
        switch (trigger) {
            case 'edit':
            case 'xedit':
            case 'create':
            
                if (!genmilestones) {
                    advpay.createMilestones(templateId, advPaymentRecordId, projectId);
                    record.submitFields({
                        type: 'customrecord_bbss_adv_payment_schedule',
                        id: advPaymentRecordId,
                        values: {
                            custrecord_bb_advpay_milestone_created: true
                        }
                    });
                };
                // execute only if sub records are already created, get subrecords and evaluate to generation transactions based on milestone date
                if (genmilestones) { // sublist id for advanced milestone records = recmachcustrecord_bbss_adv_subpay_schedule
                    var processArray = advpay.getAdvPaymentScheduleTransactionToProcessFromRecord(advPaymentRecord);
                    if (processArray.length > 0) {
                        // send to processing script call task
                        var taskParameters = {};
                        taskParameters['custscript_bb_adv_tran_array'] = processArray;

                        var scriptId = 'customscript_bb_ss_adv_mile_trans';
                        var deploymentId = 'customdeploy_bb_ss_adv_mile_trans';
                        var taskType = task.TaskType.SCHEDULED_SCRIPT;

                        taskProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
                    }
                }
                // calculate expected AR and Invoiced AR
                record.submitFields({
                    type: 'customrecord_bbss_adv_payment_schedule',
                    id: advPaymentRecordId,
                    values: {
                        'custrecord_bbss_advpay_already_amount': getInvoicedARTotal(advPaymentRecordId),
                        'custrecord_bbss_advpay_expected_ar_amt': calculateExpectedAR(advPaymentRecord)
                    },
                    options: {
                        ignoreMandatoryFields: true
                    }
                });
            break;
        }

    }

    function getInvoicedARTotal(advPaymentRecordId) {
        var invoicedARTotal = 0.00;
        if (advPaymentRecordId) {
            var transactionSearchObj = search.create({
                type: "transaction",
                filters:
                [
                    ["formulanumeric: {custbody_bbss_adv_payschedlist.id}","equalto",advPaymentRecordId], 
                    "AND", 
                    ["mainline","is","T"]
                ],
                columns:
                [
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
                invoicedARTotal = result.getValue({name: 'amount', summary: 'SUM'});
                return true;
            });
        } 
        return invoicedARTotal;
    }

    function calculateExpectedAR(advPaymentRecord) {
        var amount = advPaymentRecord.getValue('custrecord_bbss_advpay_amount');
        var dealerFeeTotal = advPaymentRecord.getValue('custrecord_bbss_advpay_dealer_fee_total') || 0.00;
        var directPayAmount = advPaymentRecord.getValue('custrecord_bbss_advpay_direct_pay_amt') || 0.00;
        return amount - dealerFeeTotal - directPayAmount;
    }


    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    }
});