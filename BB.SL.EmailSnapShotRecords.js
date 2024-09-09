/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview - Email Commission Snap Shot results Suitelet
 */
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/runtime', 'N/redirect', 'N/task'],

function(record, search, serverWidget, runtime, redirect, task) {
   
    function onRequest(context) {
        if (context.request.method == 'GET') {
            var period = context.request.parameters.payrollPeriod;
            var recType = context.request.parameters.recType;
            var emailFormat =  context.request.parameters.emailFormat;

            var form = serverWidget.createForm({
                title: 'Email Commission Snap Shots'
            });

            form.clientScriptModulePath = './BB SS/SS Lib/BB.CS.CommissionSnapShot';

            var payrollPeriod = form.addField({
                id: 'custpage_payroll_period',
                type: serverWidget.FieldType.SELECT,
                label: 'Select Payroll Period',
                source: 'customrecord_bb_payroll_period'
            });
            var currentPeriod = getCurrentPayrollPeriod();
            log.debug('newest payroll period', currentPeriod);

            payrollPeriod.defaultValue = (period) ? period : currentPeriod;

            // record type
            var recordType = form.addField({
                id: 'custpage_record_type',
                type: serverWidget.FieldType.TEXT,
                label: 'Record Type'
            });
            recordType.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });
            var emailRecType = (recType) ? recType : 'emailsummary';
            recordType.defaultValue = emailRecType;

            //email format type
            var sendType = form.addField({
                id: 'custpage_email_type',
                type: serverWidget.FieldType.SELECT,
                label: 'Email Type'
            });

            sendType.addSelectOption({
                text: 'Summary',
                value: 1
            });
            sendType.addSelectOption({
                text: 'Detail',
                value: 2
            });
            sendType.defaultValue = (emailFormat) ? emailFormat : 1;

            // create sublist
            var sublist = form.addSublist({
                id: 'custpage_email_list',
                label: 'Current Payroll Period Project List',
                type: serverWidget.SublistType.LIST 
            });

            var pPeriod = (period) ? period : currentPeriod;
            sublist = createSuiteletFields(sublist, emailRecType);

            sublist.addButton({
                id: 'custpage_mark_all',
                label: 'Mark All',
                functionName: 'markAll(true, "custpage_email_list")'
            });
            sublist.addButton({
                id: 'custpage_mark_all',
                label: 'Unmark All',
                functionName: 'markAll(false, "custpage_email_list")'
            });

            processResultSet(sublist, 'customsearch_bb_email_comm_snap_shot', pPeriod, emailRecType);

            form.addSubmitButton({
                label: 'Send Email'
            });
            context.response.writePage(form);

        } else {
            //process button click here
            var payRoll = context.request.parameters.custpage_payroll_period;
            var type =  context.request.parameters.custpage_record_type; // rectype value from suitelet screen
            var emailType = context.request.parameters.custpage_email_type;
            log.debug('emailtype', emailType);
            var records = context.request;
            var lineCount = records.getLineCount({
                group: 'custpage_email_list'
            });
            log.debug('linecount', lineCount);
            var emailArr = [];
            if (lineCount != -1) {
                for (var i = 0; i < lineCount; i++) {
                    var projectList = [];
                    var marked = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_check_box',
                        line: i
                    });
                    var project = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_project',
                        line: i
                    });
                    var projectName = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_project_name',
                        line: i
                    });
                    var salesRep = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_salesrep',
                        line: i
                    });
                    var salesRepName = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_salesrep_name',
                        line: i
                    });
                    var salesRepEmail = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_salesrep_email',
                        line: i
                    });
                    var commAmtOwed = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_comm_amount',
                        line: i
                    });
                    var internalId = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_internalid',
                        line: i
                    });
                    var payrollPeriod = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_period',
                        line: i
                    });

                    var contractAmt = records.getSublistValue({
                        group: 'custpage_email_list',
                        name: 'custpage_total_contract_amount',
                        line: i
                    });


                    if (emailType == 2) {
                        // detail
                        var sendType = true;
                    } 
                    if (marked == 'T') {
                        if (i == 0) { // push first value into array
                            projectList.push({
                                project: project, 
                                projectName: projectName, 
                                commAmtOwed: commAmtOwed,
                                totalContractAmt: contractAmt,
                                snapShotId: internalId
                            });
                            emailArr.push({
                                salesRep: salesRep,
                                salesRepName: salesRepName,
                                salesRepEmail: salesRepEmail,
                                payrollPeriod: payrollPeriod,
                                internalId: internalId,
                                sendType: sendType,
                                projectArr : projectList
                            });
                            log.debug('email array index 0', emailArr);
                        } else {
                            var indexNumber = findMatchingSaleRepArrayValue(emailArr, salesRep);
                            if (indexNumber != -1) {
                                indexNumber.projectArr.push({
                                    project: project, 
                                    projectName: projectName, 
                                    commAmtOwed: commAmtOwed,
                                    totalContractAmt: contractAmt,
                                    snapShotId: internalId
                                });
                                log.debug('found salesrep value in email array', indexNumber);
                            } else {

                                projectList.push({
                                    project: project, 
                                    projectName: projectName, 
                                    commAmtOwed: commAmtOwed,
                                    totalContractAmt: contractAmt,
                                    snapShotId: internalId
                                });
                                emailArr.push({
                                    salesRep: salesRep,
                                    salesRepName: salesRepName,
                                    salesRepEmail: salesRepEmail,
                                    payrollPeriod: payrollPeriod,
                                    internalId: internalId,
                                    sendType: sendType,
                                    projectArr : projectList
                                });
                                log.debug('no match found in email array adding new value after 0 index', emailArr);
                            }
                        }
                    }//check if line is marked as true to process email
                }
            }
            log.debug('emailArr', emailArr);
            //push array value to map reduce script
            if (emailArr.length > 0) {

                var createEmailTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_bb_mr_email_snap_shots',
                    deploymentId: 'customdeploy_bb_mr_email_snap_shots',
                    params: {
                        'custscript_bb_email_array': emailArr
                    }
                });
                taskId = createEmailTask.submit();
            }
            // redirect back to suitelet
            redirect.toSuitelet({
                scriptId: 'customscript_bb_sl_email_comm_snap_shots',
                deploymentId: 'customdeploy_bb_sl_email_comm_snap_shots'
            });
        } // end of button click execution

    }

    function findMatchingSaleRepArrayValue(emailArr, salesRep) {
        log.debug('emailArr', emailArr);
        log.debug('salesRep Id', salesRep);
        if (salesRep && emailArr.length > 0) {
            var index = emailArr.map(function(result) {return result.salesRep}).indexOf(salesRep);
            log.debug('index number array position', index);
            if (index != -1) {
                return emailArr[index]
            } else {
                return -1
            }
        } else {
            return -1;
        }
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
            });
        });
        return period;

    }

    function processResultSet(sublist, searchId, pPeriod, recType) {
        var snapShotSearch = search.load({
            id: searchId
        });
        if (recType == 'emailsummary') {
            var summaryfilters = [["custrecord_bb_comm_snap_shot_pay_period","anyof", pPeriod], "AND", ["custrecord_bb_comm_snap_shot_journal","anyof","@NONE@"]];
            log.debug('email filters', summaryfilters);
            var newSummaryFilterExpression = snapShotSearch.filterExpression.concat(summaryfilters);
            snapShotSearch.filterExpression = newSummaryFilterExpression;
        } else {
            var additionalFilters = [["custrecord_bb_comm_snap_shot_pay_period","anyof", pPeriod], "AND", ["custrecord_bb_comm_snap_shot_journal","noneof","@NONE@"]];
            log.debug('email filters', additionalFilters);
            var newFilterExpression = snapShotSearch.filterExpression.concat(additionalFilters);
            snapShotSearch.filterExpression = newFilterExpression;
        }


        var resultIndex = 0;
        var resultStep = 1000; 
        do {
            var resultSet = snapShotSearch.run();
            var results = resultSet.getRange({
                start : resultIndex,
                end : resultIndex + resultStep
            });

            for (var i = 0; i < results.length; i++) {
                var snapShotObj = {};

                snapShotObj.project = results[i].getValue({
                    name : resultSet.columns[0]
                });
                snapShotObj.projectName = results[i].getText({
                    name: resultSet.columns[0]
                });
                snapShotObj.salesRep = results[i].getValue({
                    name : resultSet.columns[1]
                });
                snapShotObj.salesRepName = results[i].getText({
                    name: resultSet.columns[1]
                });
                snapShotObj.salesRepEmail = results[i].getValue({
                    name : resultSet.columns[2]
                });
                snapShotObj.commissionAmountOwed = results[i].getValue({
                    name : resultSet.columns[3]
                });
                snapShotObj.internalId = results[i].getValue({
                    name: resultSet.columns[4]
                });
                snapShotObj.payrollPeriod = results[i].getText({
                    name: resultSet.columns[5]
                });
                snapShotObj.totalContractAmt = results[i].getValue({
                    name: resultSet.columns[6]
                });


                setSublistValues(sublist, i, snapShotObj, recType);
            }

            resultIndex = resultIndex + resultStep;

        } while (results.length > 0)

    }

    function setSublistValues(sublist, lineNum, snapShotObj, recType) {
        if (snapShotObj.project) {
            sublist.setSublistValue({
                id: 'custpage_project',
                line: lineNum,
                value: snapShotObj.project
            });
        }

        if (snapShotObj.salesRep) {
            sublist.setSublistValue({
                id: 'custpage_salesrep',
                line: lineNum,
                value: snapShotObj.salesRep
            });
        }
        if (snapShotObj.salesRepEmail) {
            sublist.setSublistValue({
                id: 'custpage_salesrep_email',
                line: lineNum,
                value: snapShotObj.salesRepEmail
            });
        }
        if (snapShotObj.commissionAmountOwed) {
            sublist.setSublistValue({
                id: 'custpage_comm_amount',
                line: lineNum,
                value: snapShotObj.commissionAmountOwed
            });
        }
        if (snapShotObj.projectName) {
            sublist.setSublistValue({
                id: 'custpage_project_name',
                line: lineNum,
                value: snapShotObj.projectName
            });
        }
        if (snapShotObj.salesRepName) {
            sublist.setSublistValue({
                id: 'custpage_salesrep_name',
                line: lineNum,
                value: snapShotObj.salesRepName
            });
        }
        if (snapShotObj.internalId) {
            sublist.setSublistValue({
                id: 'custpage_internalid',
                line: lineNum,
                value: snapShotObj.internalId
            });
        }
        if (snapShotObj.payrollPeriod) {
            sublist.setSublistValue({
                id: 'custpage_period',
                line: lineNum,
                value: snapShotObj.payrollPeriod
            });
        }
        if (snapShotObj.totalContractAmt) {
            sublist.setSublistValue({
                id: 'custpage_total_contract_amount',
                line: lineNum,
                value: snapShotObj.totalContractAmt
            });
        }


    }

    function createSuiteletFields(sublist, recType) {
        var checkBox = sublist.addField({
            id: 'custpage_check_box',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Mark'
        });
        var project = sublist.addField({
            id: 'custpage_project',
            type: serverWidget.FieldType.SELECT,
            label: 'Project',
            source: 'job'
        });
        var salesRep = sublist.addField({
            id: 'custpage_salesrep',
            type: serverWidget.FieldType.SELECT,
            label: 'Sales Rep',
            source: 'employee'
        });
        var salesRepEmail = sublist.addField({
            id: 'custpage_salesrep_email',
            type: serverWidget.FieldType.EMAIL,
            label: 'Sales Rep Email'
        });
        var commissionAmt = sublist.addField({
            id: 'custpage_comm_amount',
            type: serverWidget.FieldType.FLOAT,
            label: 'Commission Amount Owed'
        });
        var projectName = sublist.addField({
            id: 'custpage_project_name',
            type: serverWidget.FieldType.TEXT,
            label: 'Project Name'
        });
        var salesRepName = sublist.addField({
            id: 'custpage_salesrep_name',
            type: serverWidget.FieldType.TEXT,
            label: 'Sales Rep Name'
        });
        var internalId = sublist.addField({
            id: 'custpage_internalid',
            type: serverWidget.FieldType.TEXT,
            label: 'internalid'
        });

        var payroll = sublist.addField({
            id: 'custpage_period',
            type: serverWidget.FieldType.TEXT,
            label: 'Payroll Period'
        });
        var totalContractAmt = sublist.addField({
            id: 'custpage_total_contract_amount',
            type: serverWidget.FieldType.FLOAT,
            label: 'Contract Amount'
        });

        project.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.INLINE
        });

        salesRep.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.INLINE
        });

        projectName.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        salesRepName.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        internalId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        payroll.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        if (recType == 'emailsummary') {
            // commissionAmt.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
            // totalContractAmt.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
            // adderTotal.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
            // homeownerRefund.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
            // otherRefund.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
            // utilityRefund.updateDisplayType({
            //     displayType : serverWidget.FieldDisplayType.HIDDEN
            // });
        }


        return sublist;

    }

    return {
        onRequest: onRequest
    };
    
});
