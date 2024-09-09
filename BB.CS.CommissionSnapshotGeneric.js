/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Commission Snap Shot Custom Client script  - handles validations on line edits and other related field automations
 */

/**
 * Copyright 2019-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/currentRecord', 'N/url', 'N/https', 'N/search','./BB.MD.MRStatusProgressBar.js'], function(currentRecord, url, https, search,mrStatusLib) {

    function pageInit(context) {

        var taskId = context.currentRecord.getValue({
            fieldId: 'custpage_taskid'
        });
        var scriptId = context.currentRecord.getValue({
            fieldId: 'custpage_scriptid'
        });
        var depId = context.currentRecord.getValue({
            fieldId: 'custpage_depid'
        });
        if (taskId) {
            mrStatusLib.callMapReduceStatusCheck(taskId, context, scriptId, depId);
        }
    }

    function saveRecord(context) {
        var currRecord = currentRecord.get();
        var payrollPeriod = currRecord.getValue({
            fieldId: 'custpage_payroll_period'
        });
        console.log('payroll period', payrollPeriod);
        if (!payrollPeriod) {
            alert('The payroll period MUST BE SELECTED before you can proceed with creating a Snap Shot');
            return false;
        } else {
            return true;
        }
    }

    function fieldChanged(context) {
        var currRecord = currentRecord.get();
        console.log('current record', currRecord);

        // var currentPeriod = location.search.split('payrollPeriod')[1];
        var periodLookup = location.search;
        var searchParam = new URLSearchParams(periodLookup);
        var currentPeriod = searchParam.get('payrollPeriod');

        var currentTaskId = null;
        var taskSearch = location.search;
        var searchParam = new URLSearchParams(taskSearch);
        currentTaskId = searchParam.get('taskId');


        var emailSentTypeSearch = location.search;
        var searchParam = new URLSearchParams(emailSentTypeSearch);
        var currentEmailType = searchParam.get('emailFormat');

        console.log('current period in url', currentPeriod);
        console.log('current taskid', currentTaskId);

        var period = currRecord.getValue({
            fieldId: 'custpage_payroll_period'
        });

        var emailType = currRecord.getValue({
            fieldId: 'custpage_email_type'
        });
        console.log('period', period);

        var recType = currRecord.getValue({
            fieldId: 'custpage_record_type'
        });

        var field = context.fieldId;
        console.log('field Id', field);

        if (field == 'custpage_payroll_period') {
            console.log('field has changed');
            if (recType == 'SnapShotJE') {
                // open create snap shot je suitelet
                if (currentPeriod != period) {
                    var snapShotJournalLink = url.resolveScript({
                        scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                        deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                        params: {
                            'payrollPeriod': period,
                            'recType': 'SnapShotJE',
                            'taskId': currentTaskId
                        }
                    });

                    window.open(snapShotJournalLink, '_self', false);
                    return true;
                }
            }
            if (recType == 'CreateSnapShot') {
                // open add snap shot suitelet
                if (currentPeriod != period) {
                    var snapShotLink = url.resolveScript({
                        scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                        deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                        params: {
                            'payrollPeriod': period,
                            'recType': 'CreateSnapShot',
                            'taskId': currentTaskId
                        }
                    });

                    window.open(snapShotLink, '_self', false);
                }
            }

            if (recType == 'DeleteSnapShot') {
                // open add snap shot suitelet
                if (currentPeriod != period) {
                    var snapShotLink = url.resolveScript({
                        scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                        deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                        params: {
                            'payrollPeriod': period,
                            'recType': 'DeleteSnapShot',
                            'taskId': currentTaskId
                        }
                    });

                    window.open(snapShotLink, '_self', false);
                }
            }

            if (recType == 'EditSnapShot') {
                // open add snap shot suitelet
                if (currentPeriod != period) {
                    var snapShotLink = url.resolveScript({
                        scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                        deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                        params: {
                            'payrollPeriod': period,
                            'recType': 'EditSnapShot',
                            'taskId': currentTaskId
                        }
                    });

                    window.open(snapShotLink, '_self', false);
                }
            }

            if (recType == 'emailsummary') {
                if (currentPeriod != period) {
                    var emailSummaryLink = url.resolveScript({
                        scriptId: 'customscript_bb_sl_email_comm_snap_shots',
                        deploymentId: 'customdeploy_bb_sl_email_comm_snap_shots',
                        params: {
                            'payrollPeriod': period,
                            'recType': (emailType == 2) ? 'emaildetail' : 'emailsummary',
                            'emailFormat': emailType,
                            'taskId': currentTaskId

                        }
                    });

                    window.open(emailSummaryLink, '_self', false);
                }
            }
            if (recType == 'emaildetail') {
                if (currentPeriod != period) {
                    var emailDetailLink = url.resolveScript({
                        scriptId: 'customscript_bb_sl_email_comm_snap_shots',
                        deploymentId: 'customdeploy_bb_sl_email_comm_snap_shots',
                        params: {
                            'payrollPeriod': period,
                            'recType': (emailType == 2) ? 'emaildetail' : 'emailsummary',
                            'emailFormat': emailType,
                            'taskId': currentTaskId
                        }
                    });

                    window.open(emailDetailLink, '_self', false);
                }
            }

        }// end of payroll period check

        if (field == 'custpage_email_type') {

            if (emailType != currentEmailType) {
                var emailReqest = url.resolveScript({
                    scriptId: 'customscript_bb_sl_email_comm_snap_shots',
                    deploymentId: 'customdeploy_bb_sl_email_comm_snap_shots',
                    params: {
                        'payrollPeriod': period,
                        'recType': (emailType == 2) ? 'emaildetail' : 'emailsummary',
                        'emailFormat': emailType,
                        'taskId': currentTaskId
                    }
                });

                window.open(emailReqest, '_self', false);
            }

        }
    }


    /*
      @ function - createCommJe(context) - calls suitelet that creates journal entries based on snap shot records created
      @ param - (context) Client script context
    */

    function createCommJe(context) {
        var currRecord = currentRecord.get();
        var payrollPeriod = currRecord.getValue({
            fieldId: 'custpage_payroll_period'
        });

        var currentTaskId = null;
        var taskSearch = location.search;
        var searchParam = new URLSearchParams(taskSearch);
        currentTaskId = searchParam.get('taskId');

        if (payrollPeriod) {

            var createJESnapShot = url.resolveScript({
                scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                params: {
                    'payrollPeriod': payrollPeriod,
                    'recType': 'SnapShotJE',
                    'taskId': currentTaskId
                }
            });

            window.open(createJESnapShot, '_self', false);

        } else {
            alert('No Payroll Period has been selected. Please enter in Payroll Period before attempting to create Journal Entries.');
        }
    }

    function returnToHome(context) {
        var currentTaskId = null;
        var taskSearch = location.search;
        var searchParam = new URLSearchParams(taskSearch);
        currentTaskId = searchParam.get('taskId');

        var currRecord = currentRecord.get();
        var payrollPeriod = currRecord.getValue({
            fieldId: 'custpage_payroll_period'
        });

        if (payrollPeriod) {

            var returnToHome = url.resolveScript({
                scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                params: {
                    'payrollPeriod': payrollPeriod,
                    'recType': 'CreateSnapShot',
                    'taskId': currentTaskId
                }
            });

            window.open(returnToHome, '_self', false);

        }
    }

    function deleteSnapShot(context) {
        var currentTaskId = null;
        var taskSearch = location.search;
        var searchParam = new URLSearchParams(taskSearch);
        currentTaskId = searchParam.get('taskId');

        var currRecord = currentRecord.get();
        var payrollPeriod = currRecord.getValue({
            fieldId: 'custpage_payroll_period'
        });

        if (payrollPeriod) {

            var snapShotJournalLink = url.resolveScript({
                scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                params: {
                    'payrollPeriod': payrollPeriod,
                    'recType': 'DeleteSnapShot',
                    'taskId': currentTaskId
                }
            });

            window.open(snapShotJournalLink, '_self', false);

        } else {
            alert('No Payroll Period has been selected. Please enter in Payroll Period before attempting to create Journal Entries.');
        }
    }


    function editSnapShot(context) {
        var currentTaskId = null;
        var taskSearch = location.search;
        var searchParam = new URLSearchParams(taskSearch);
        currentTaskId = searchParam.get('taskId');

        var currRecord = currentRecord.get();
        var payrollPeriod = currRecord.getValue({
            fieldId: 'custpage_payroll_period'
        });

        if (payrollPeriod) {

            var snapShotJournalLink = url.resolveScript({
                scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                params: {
                    'payrollPeriod': payrollPeriod,
                    'recType': 'EditSnapShot',
                    'taskId': currentTaskId
                }
            });

            window.open(snapShotJournalLink, '_self', false);

        } else {
            alert('No Payroll Period has been selected. Please enter in Payroll Period before attempting to create Journal Entries.');
        }
    }
    /*
      @ function - getPayrollDates(payrollPeriod) - get payroll record and returns start and end date for payroll period
      @ param - (integer) payrollPeriod - Payroll period custom record internal id - this record contains start and end date for a selected payroll period
    */

    function markAll(value, sublistValue) {
        var currentRec = currentRecord.get();
        var sublistCount = currentRec.getLineCount({
            sublistId: sublistValue
        });
        if (sublistCount > 0) {
            for (var c = 0; c < sublistCount; c++) {
                currentRec.selectLine({
                    sublistId: sublistValue,
                    line: c
                });
                currentRec.setCurrentSublistValue({
                    sublistId: sublistValue,
                    fieldId: 'custpage_check_box',
                    value: value
                });
            }
        }
    }

    function getPayrollDates(payrollPeriod) {
        if (payrollPeriod) {
            var dateObj = {};
            var dateValues = search.lookupFields({
                type: 'customrecord_bb_payroll_period',
                id: payrollPeriod,
                columns: ['custrecord_bb_payroll_start_date', 'custrecord_bb_payroll_end_date']
            });
            if (dateValues) {
                var startDate = dateValues.custrecord_bb_payroll_start_date;
                var endDate = dateValues.custrecord_bb_payroll_end_date;
                log.debug('payroll start date', startDate);
                log.debug('payroll end date', endDate);
                dateObj.startDate = startDate;
                dateObj.endDate = endDate;
            }
        } else {
            return null;
        }
        return dateObj;
    }

    function getCurrentPayrollPeriod() {
        var period;
        var customrecord_bb_payroll_periodSearchObj = search.create({
            type: "customrecord_bb_payroll_period",
            filters:
                [
                ],
            columns:
                [
                    search.createColumn({
                        name: "internalid",
                        summary: "GROUP"
                    }),
                    search.createColumn({
                        name: "custrecord_bb_payroll_end_date",
                        summary: "MAX",
                        sort: search.Sort.DESC
                    })
                ]
        });
        var searchResultCount = customrecord_bb_payroll_periodSearchObj.runPaged().count;
        log.debug("customrecord_bb_payroll_periodSearchObj result count",searchResultCount);
        customrecord_bb_payroll_periodSearchObj.run().each(function(result){
            period = result.getValue({
                name: 'internalid',
                summary: 'GROUP'
            })
        });
        console.log('period', period);
        return period;

    }

    function lineInit(context) {
        var snapShotRec = currentRecord.get();
        var jeId = snapShotRec.getCurrentSublistValue({
            sublistId: 'custpage_edit_snap_shot',
            fieldId: 'custpage_journal_entry'
        });

        log.debug('po id', jeId);
        if (jeId) {
            alert('The line you selected is associated to a Journal Entry, This line cannot be altered.');
            return false;
        } else {
            return true;
        }
    }
    function validateDelete(context) {
        var snapShotRec = currentRecord.get();
        var jeId = snapShotRec.getCurrentSublistValue({
            sublistId: 'custpage_edit_snap_shot',
            fieldId: 'custpage_journal_entry'
        });

        log.debug('po id', jeId);
        if (jeId) {
            alert('The line you are trying to remove is associated to a Journal Entry, This line cannot be removed');
            return false;
        } else {
            return true;
        }
    }

    function validateField(context) {
        var snapShotRec = currentRecord.get();

        var fieldId = context.fieldId;
        log.debug('fieldId', fieldId);
        if (fieldId == 'custpage_comm_amount') {
            var jeId = snapShotRec.getCurrentSublistValue({
                sublistId: 'custpage_edit_snap_shot',
                fieldId: 'custpage_journal_entry'
            });
            log.debug('je Id', jeId);
            if (jeId) {
                alert('This Snap Shot line is Associated to a Journal Entry and cannot be changed.');
                snapShotRec.cancelLine({
                    sublistId: 'custpage_edit_snap_shot'
                });
                return false;
            }
        }
        return true;
    }

    function validateLine(context) {
        var currRecord = currentRecord.get();
        var project = currRecord.getCurrentSublistValue({
            sublistId: 'custpage_edit_snap_shot',
            fieldId: 'custpage_project'
        });
        console.log('project in line validation', project);
        if (!project) {

            return false;
        } else {
            return true;
        }

    }

    function refreshSnapShot(context) {
        var currRecord = currentRecord.get();
        var recType = currRecord.getValue({fieldId: 'custpage_record_type'});
        var payrollPeriod = currRecord.getValue({fieldId: 'custpage_payroll_period'});
        var refreshSuitelet = url.resolveScript({
            scriptId: 'customscript_bb_sl_refresh_snap_shot',
            deploymentId: 'customdeploy_bb_sl_refresh_snap_shot',
            params: {
                recType: recType,
                payrollPeriod: payrollPeriod
            }
        });
        // alert('Your are attempting a snap shot refresh. Are you sure you want to continue?')
        if (confirm('Your are attempting a snap shot refresh. Are you sure you want to continue?')) {
            window.open(refreshSuitelet, '_self', false);
        }


    }

    function getLineCountFromSuitelet(sublistId) {
        var currRecord = currentRecord.get();
        if (sublistId) {
            var lineCount = currRecord.getLineCount({
                sublistId: sublistId
            });
            return lineCount;
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
       // saveRecord: saveRecord,
        createCommJe: createCommJe,
        deleteSnapShot: deleteSnapShot,
        editSnapShot: editSnapShot,
        returnToHome: returnToHome,
        markAll: markAll,
      //  lineInit: lineInit,
       // validateDelete: validateDelete,
      //  validateField: validateField,
      //  refreshSnapShot: refreshSnapShot,
      //  validateLine: validateLine
    };

});