/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Refresh Commission Snap Shot Suitelet
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
define(['N/record', 'N/search', 'N/redirect', 'N/task'],

function(record, search, redirect, task) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        if  (context.request.method == 'GET') {
            var recType = context.request.parameters.recType;
            var payrollPeriod = context.request.parameters.payrollPeriod;
            log.debug('payroll period', payrollPeriod);
            if (payrollPeriod) {
                var snapShotSearch = search.load({
                    id: 'customsearch_bb_refresh_comm_snap_shot'
                });

                var additionalFilters = [["custrecord_bb_comm_snap_shot_pay_period","anyof", payrollPeriod]];
                log.debug('filters edit sublist', additionalFilters);
                var newFilterExpression = snapShotSearch.filterExpression.concat(additionalFilters);
                snapShotSearch.filterExpression = newFilterExpression;

                log.debug('refresh snap shot');
                var resultIndex = 0;
                var resultStep = 1000; 
                var refreshArr = [];
                do {
                    var resultSet = snapShotSearch.run();
                    var results = resultSet.getRange({
                        start : resultIndex,
                        end : resultIndex + resultStep
                    });

                    for (var i = 0; i < results.length; i++) {

                        var proj = results[i].getValue({
                            name : resultSet.columns[0]
                        });
                        var sRep = results[i].getValue({
                            name : resultSet.columns[1]
                        });
                        var commAmt = results[i].getValue({
                            name : resultSet.columns[2]
                        });
                        var salesRepOverRideAmt = results[i].getValue({
                            name : resultSet.columns[3]
                        });

                        var paidCommAmt = results[i].getValue({
                            name : resultSet.columns[4]
                        });
                        var manualPaidAmt = results[i].getValue({
                            name : resultSet.columns[5]
                        });
                        var journal = results[i].getValue({
                            name : resultSet.columns[6]
                        });
                        var snapShotId = results[i].getValue({
                            name : resultSet.columns[7]
                        });
                        var payPeriod = results[i].getValue({
                            name : resultSet.columns[8]
                        });
                        var commCalcAmt = results[i].getValue({
                            name : resultSet.columns[9]
                        });

                        if (!journal) {
                            refreshArr.push({
                                proj: proj,
                                sRep: sRep,
                                commAmt: commAmt,
                                commCalcAmt: commCalcAmt,
                                salesRepOverRideAmt: salesRepOverRideAmt,
                                paidCommAmt: paidCommAmt,
                                manualPaidAmt: manualPaidAmt,
                                payPeriod: payPeriod,
                                isJournalRecord: false,
                                isDelete: false,
                                exetype: 'edit',
                                snapShotId: snapShotId
                            });
                        }
                    }

                    resultIndex = resultIndex + resultStep;

                } while (results.length > 0)

                log.debug('refresh array count', refreshArr.length);
                log.debug('array value', refreshArr);
                var taskId = null;
                if (refreshArr.length > 0) {
                    var createSnapShotTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_bb_mr_create_snap_shot_recs',
                        deploymentId: 'customdeploy_bb_mr_create_snap_shot_recs',
                        params: {
                            'custscript_array': refreshArr
                        }
                    });
                    taskId = createSnapShotTask.submit();
                }

            } // end of payroll period check
            redirect.toSuitelet({
                scriptId: 'customscript_bb_sl_create_comm_snap_shot',
                deploymentId: 'customdeploy_bb_sl_create_comm_snap_shot',
                parameters: {
                    'processMessage': 'Yes',
                    'taskId': taskId
                }
            });
        }// request method check
    }

    return {
        onRequest: onRequest
    };
    
});
