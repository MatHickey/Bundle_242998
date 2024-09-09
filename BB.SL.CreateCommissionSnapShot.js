/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Suitelet Commission Snap Shot Selection Form Suitelet script includes form generation for edit, delete, and create commission snap shot journals
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


define(['N/ui/serverWidget', 'N/ui/message', 'N/record', 'N/search', 'N/redirect', 'N/runtime', 'N/task', 'N/config', './BB SS/SS Lib/BB.MD.SnapShotLibrary'], 
    function(serverWidget, message, record, search, redirect, runtime, task, nsconfig, sublist) {
   
    /**
     * Definition of the Suitelet script trigger point
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        if (context.request.method == 'GET') {
            var configurationId = getConfigurationRecordId();
            var config = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: configurationId
            });
            var customScript = config.getValue({
                fieldId: 'custrecord_bb_snap_shot_custom_script'
            });
            if (customScript) {
                var scriptObj = getCustomScriptIDs(customScript);
                if (scriptObj.scriptId && scriptObj.deploymentId) {
                    //redirect to custom suitelet
                    redirect.toSuitelet({
                        scriptId: scriptObj.scriptId,
                        deploymentId: scriptObj.deploymentId
                    });
                }
            }

            var recordType = context.request.parameters.recType;
            var period = context.request.parameters.payrollPeriod;
            var submittedTaskId = context.request.parameters.taskId;

            var form;
            if (recordType == 'SnapShotJE') {
                form = sublist.createSnapShotJournalSublistFields(context, period, config, recordType);
            } else if (recordType == 'EditSnapShot') {
                form = sublist.createEditSnapShotSublistFields(context, period, true, config, recordType);
            } else if (recordType == 'DeleteSnapShot') {
                form = sublist.createDeleteSublist(context, period, recordType);
            } else {
                //create snap shot screen
                form = sublist.createSnapShotSublistFields(context, period, false, config, 'CreateSnapShot');
            }
            var lineCount = form.addField({
                id: 'custpage_line_count',
                type: serverWidget.FieldType.TEXT,
                label: 'Number of Records'
            });
            lineCount.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            var savedSearchs = config.getValue({
                fieldId: 'custrecord_bb_comm_oops_reports'
            });
            var savedSearchNames = config.getText({
                fieldId: 'custrecord_bb_comm_oops_reports'
            });

            var companyInfo = nsconfig.load({
                type: nsconfig.Type.COMPANY_INFORMATION
            });
            var accountNum = companyInfo.getValue({
                fieldId: 'companyid'
            });
            var accountId = '';
            var pattern = new RegExp(/[_]/);
            if (pattern.test(accountNum)) {
                var sbacctId = accountNum.split('_').shift();
                var number = accountNum.split('_').pop();
                accountId = sbacctId + '-' + number;
            } else {
                accountId = accountNum;
            }

            log.debug('config oops report', savedSearchs);
            var linkString = '';
            if (savedSearchs.length > 0) {
                for (var x = 0; x < savedSearchs.length; x++) {
                    var searchId = savedSearchs[x];
                    var searchName = savedSearchNames[x];
                    linkString += '<a target="_blank" href= "https://' + accountId + '.app.netsuite.com/app/common/search/searchresults.nl?searchid=' + searchId + '&saverun=T&whence=">' + searchName + '</a> \n';
                }
            }
            log.debug('linkstring', linkString);

            var oopsReportLinks = form.addField({
                id: 'custpage_oops_report',
                type: serverWidget.FieldType.RICHTEXT,
                label: 'Oops Reports'
            });
            oopsReportLinks.defaultValue = linkString;

            oopsReportLinks.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            form.clientScriptModulePath = './BB SS/SS Lib/BB.CS.CommissionSnapShot';

            var completion = null;
            if (submittedTaskId) {

                var summary = task.checkStatus({
                    taskId: submittedTaskId
                });
                completion = summary.getPercentageCompleted();
                log.debug('completion', completion);
                if (completion < 100) {
                    form.addPageInitMessage({
                        type: message.Type.INFORMATION,
                        message: 'Your Submission was Successful. Your records have been sent for processing, please allow several minutes for processing.',
                        duration: 10000
                    });
                    var progressBar = form.addField({
                        id: 'custpage_progress_bar',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Progress'
                    });
                    progressBar.defaultValue =  '<!DOCTYPE html>' +
                        '<html>' + 
                        '<head>' +
                            '<meta charset="utf-8">' +
                            '<title>HTML5 Progress Bar</title>' +
                            '<style>' +
                                '#progress_bar wrapper {' +
                                    'width: 60%;' +
                                    'margin: 0 auto;' +
                                    'text-align: center;' +
                                '}' +
                            '</style>' +
                        '</head>' +
                        '<body>' +
                        
                            '<div class="wrapper">' +
                                '<h1>Current Progress</h1>' +
                                '<progress class="custom-progress" max="100" value="' + completion + '"></progress>' +
                             '</div>' +

                        '</body>' +
                        // '<iframe src= "" id="progress_bar">' +
                        //     '<h1></h1>'
                        // '</iframe>' +
                            // '<script>' +
                            //     'window.setInterval(function() {' +
                            //     '    reloadIFrame()' +
                            //     '}, 3000);' +

                            //     'function reloadIFrame() {' +
                            //     '    console.log("reloading..");' +
                            //     '    document.getElementById("progress_bar").contentWindow.location.reload();' +
                            //     '}'+
                            // '</script>' +
                        '</html>'
                }
            }
            context.response.writePage(form);

        } else {

            // process here after button click get sublist values from parameters and send details from Array to scheduled or map reduce to create snap shot records. 

            var recordType = context.request.parameters.custpage_record_type;
            log.debug('record type to process', recordType);

            if (context.request.parameters.custpage_journal_date) {
                var journalDate = context.request.parameters.custpage_journal_date;
                log.debug('Journal Date', journalDate);
            }

            var groupName = getGroupName(recordType);

            var snapShotArray = [];
            var deleteArr = [];
            var jeArray = [];

            var snapShotLines = context.request.getLineCount({
                group: groupName
            });
            var snapShotRec = context.request;

            var payPeriod = context.request.parameters.custpage_payroll_period;
            log.debug('payperiod in submit request', payPeriod);

            for (var s = 0; s < snapShotLines; s++) {
                var marked = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_check_box',
                    line: s
                });

                var proj = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_project',
                    line: s
                });
                var sRep = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_salesrep',
                    line: s
                });
                var commAmt = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_comm_amount',
                    line: s
                });
                var commCalcAmt = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_comm_calc_amount',
                    line: s
                });
                var salesRepOverRideAmt = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_comm_override_amount',
                    line: s
                });
                var paidCommAmt = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_comm_paid_amount',
                    line: s
                });
                var manualPaidAmt = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_manual_paid_amount',
                    line: s
                });
                var journal = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_journal_entry',
                    line: s
                });
                var snapShotId = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_internalid',
                    line: s
                });
                var payrollPeriod = snapShotRec.getSublistValue({
                    group: groupName,
                    name: 'custpage_pay_period',
                    line: s
                });
                log.debug('line is marked', marked);
                // create snap shot only array push
                if (recordType == 'CreateSnapShot' && marked == 'T') {
                    snapShotArray.push({
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
                        exetype: 'create'
                    });

                } else if (recordType == 'EditSnapShot' && !journal && marked == 'T') {
                    snapShotArray.push({
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

                } else if (recordType == 'DeleteSnapShot' && !journal && marked == 'T') {
                    deleteArr.push({
                        snapShotId: snapShotId,
                        journal: journal,
                        proj: proj,
                        isDelete: true
                    });

                } else if (recordType == 'SnapShotJE' && marked == 'T') {
                    jeArray.push({
                        project: proj,
                        sRep: sRep,
                        commAmt: commAmt,
                        pRollPeriod: payPeriod,
                        internalId: snapShotId,
                        isOneWorld: true,
                        isJournalRecord: true,
                        journalDate: journalDate,
                        isDelete: false
                    });

                } else {
                    //do nothing
                }

            }// end of loop
            var taskId = null;
            if (snapShotArray.length > 0) {
                var createSnapShotTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_bb_mr_create_snap_shot_recs',
                    deploymentId: 'customdeploy_bb_mr_create_snap_shot_recs',
                    params: {
                        'custscript_array': snapShotArray
                    }
                });
                taskId = createSnapShotTask.submit();
            }

            if (deleteArr.length > 0) {
                var createSnapShotTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_bb_mr_create_snap_shot_recs',
                    deploymentId: 'customdeploy_bb_mr_create_snap_shot_recs',
                    params: {
                        'custscript_array': deleteArr
                    }
                });
                taskId = createSnapShotTask.submit();
            }

            if (jeArray.length > 0) {
                var createSnapShotJETask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_bb_mr_create_snap_shot_recs',
                    deploymentId: 'customdeploy_bb_mr_create_snap_shot_recs',
                    params: {
                        'custscript_array': jeArray
                    }
                });
                taskId = createSnapShotJETask.submit();
            }

            redirect.toSuitelet({
                scriptId: 'customscript_bb_sl_create_comm_snap_shot',
                deploymentId: 'customdeploy_bb_sl_create_comm_snap_shot',
                parameters: {
                    'processMessage': 'Yes',
                    'taskId': taskId
                }
            });
        
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

    function getGroupName(recordType) {
        switch (recordType) {
            case 'CreateSnapShot' : return 'custpage_snap_shot_list';
            case 'EditSnapShot' : return 'custpage_edit_snap_shot';
            case 'DeleteSnapShot' : return 'custpage_delete_snap_shot_list';
            case 'SnapShotJE' : return 'custpage_snap_shot_je_list';
        }
    }

    function getConfigurationRecordId() {
        var configId;
        var configSearch = search.create({
            type: "customrecord_bb_solar_success_configurtn",
            filters:
            [
            ],
            columns:
            [
                search.createColumn({
                    name: "internalid",
                    summary: "MAX"
                }),
            ]
        });
        var searchResultCount = configSearch.runPaged().count;
        log.debug("configSearch result count",searchResultCount);
        configSearch.run().each(function(result){
            configId = result.getValue({
                name: 'internalid',
                summary: 'MAX'
            });
           
        });
        return configId;
    }

    return {
        onRequest: onRequest
    };
    
});