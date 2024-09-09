/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/record', 'N/search', 'N/runtime', 'N/email', './BB SS/SS Lib/BB.MD.SnapShotLibrary'],

function(record, search, runtime, email, snapShot) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData(inputContext) {
        var arr = runtime.getCurrentScript().getParameter({
            name: 'custscript_array'
        });

        log.debug('array', arr);
        var array = JSON.parse(arr);

        return array;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(mapContext) {
        var obj = JSON.parse(mapContext.value);
        log.debug('Map Stage object', obj);

        var config = record.load({
            type: 'customrecord_bb_solar_success_configurtn',
            id: 1
        });

        try {

            if (obj.isJournalRecord) {
                //create commission snap shot journal
                log.debug('creating journal entry');
                var lookup = search.lookupFields({
                    type: search.Type.JOB,
                    id: obj.project,
                    columns: ['subsidiary']
                });
                log.debug('project lookup values', lookup);

                var subsid = lookup.subsidiary[0].value;

                var payrollLookup = search.lookupFields({
                    type: 'customrecord_bb_payroll_period',
                    id: obj.pRollPeriod,
                    columns: ['name']
                });
                var payrollName = payrollLookup.name;
       

                var memo = 'Commission Payroll for Pay Period: ' + payrollName;

                var commissionPayableAccount = config.getValue({
                    fieldId: 'custrecord_bb_comm_payable_account'
                });
                var commStandardExpenseAccount = config.getValue({
                    fieldId: 'custrecord_bb_comm_expense_account'
                });
                
                var jeRecord = record.create({
                    type: record.Type.JOURNAL_ENTRY,
                    isDynamic: true
                });

                if (obj.isOneWorld) {
                    jeRecord.setValue({
                        fieldId: 'subsidiary',
                        value: subsid
                    });
                }
                log.debug('journal date', obj.journalDate);
                var date = new Date();
                jeRecord.setValue({
                    fieldId: 'trandate',
                    value: (obj.journalDate) ? new Date(obj.journalDate) : new Date()
                });
                jeRecord.setValue({
                    fieldId: 'memo',
                    value: memo
                });
                log.debug('adding JE lines');
                //add multiple JE lines
                setJELines(jeRecord, commissionPayableAccount, obj.commAmt, false, memo, obj.project);// set credit line is not deferred line
                setJELines(jeRecord, commStandardExpenseAccount, obj.commAmt, true, memo, obj.project);// set standard commission line amount

                var jeId = jeRecord.save();

                // submit je record back to snap shot record when Journal is created
                record.submitFields({
                    type: 'customrecord_bb_commission_snap_shot',
                    id: obj.internalId,
                    values: {
                        'custrecord_bb_comm_snap_shot_journal': jeId,
                        'custrecord_bb_snap_shot_paid_comm_amt': obj.commAmt
                    },
                    options: {
                        ignoreMandatoryFields: true
                    }
                });
                log.debug('project record save, internalid', obj.project);

                var totalPaidAmt = snapShot.getTotalCommissionPaidAmt(obj.project);
                log.debug('total paid amount', totalPaidAmt);

                record.submitFields({
                    type: record.Type.JOB,
                    id: obj.project,
                    values: {
                        'custentity_bb_paid_comm_amount': totalPaidAmt
                    },
                    options: {
                        ignoreMandatoryFields: true
                    }
                });
                log.debug('Journal Entry Created');

            } else {
                //create snapshot record
                
                var snapShotRec;
                if (obj.exetype == 'create') {
                    log.debug('creating commission snap shot');
                    snapShotRec = record.create({
                        type: 'customrecord_bb_commission_snap_shot'
                    });
                } else {
                    log.debug('editing commission snap shot');
                    snapShotRec = record.load({
                        type: 'customrecord_bb_commission_snap_shot',
                        id: obj.snapShotId
                    });
                }
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_comm_snap_shot_project',
                    value: obj.proj
                });
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_comm_snap_shot_sales_rep',
                    value: obj.sRep
                });
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_comm_snap_shot_comm_amt',
                    value: obj.commAmt
                });
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_comm_snap_shot_pay_period',
                    value: obj.payPeriod
                });
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_snap_shot_comm_ovrd_amt',
                    value: obj.salesRepOverRideAmt
                });
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_snap_shot_paid_comm_amt',
                    value: obj.paidCommAmt
                });
                snapShotRec.setValue({
                    fieldId: 'custrecord_bb_snap_shot_manu_pd_comm_amt',
                    value: obj.manualPaidAmt
                });

                var id = snapShotRec.save();

                record.submitFields({
                    type: record.Type.JOB,
                    id: obj.proj,
                    values: {
                        'custentity_bb_comm_snap_shot_record': id
                    },
                    options: {
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });

            }
            // delete snap shot records without Journal entries
            if (obj.isDelete) {
                if (obj.snapShotId) {
                    record.delete({
                        type: 'customrecord_bb_commission_snap_shot',
                        id: obj.snapShotId
                    });
                    if (obj.proj) {
                        var id = snapShot.getSnapShotRecordAfterDelete(obj.proj);
                        if (id) {
                            record.submitFields({
                                type: record.Type.JOB,
                                id: obj.proj,
                                values: {
                                    'custentity_bb_comm_snap_shot_record': id
                                },
                                options : {
                                    ignoreMandatoryFields: true
                                }
                            });
                        }
                    }
                }
            }
            mapContext.write({
                key: 'snapshot',
                value: obj
            });
        } catch (err) {
            obj['error'] = err;
            log.audit({
                title: 'Error related to map object ' + obj,
                details: 'Error Details for processing object : ' + obj + ' Error Message '  + err
            });
            mapContext.write({
                key: 'snapshot',
                value: obj
            });
        }

    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
        context.write({
            key: 'snapshot',
            value: context.values
        });
    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(context) {
        var currentUser = runtime.getCurrentUser();
        var userId = currentUser.id;
        var userEmail = currentUser.email;

        var processedArr = [];
        var successfulArr = [];
        var errorArr = [];

        var successTotal

        context.output.iterator().each(function (key, value) { 

            processedArr.push({
                key: key,
                value: value
            });
            return true;
        });

        var summaryMessage = "Usage: " + context.usage + " Concurrency: " + context.concurrency +
        " Number of yields: " + context.yields;
        log.audit({ title: 'Summary of usage', details: summaryMessage });

        if (processedArr.length > 0) {
            var arrayString = processedArr[0].value;
            var arrayObj = JSON.parse(arrayString);
            var arrayLength = arrayObj.length;

            for (var e = 0; e < arrayObj.length; e++) {
                var objVal = JSON.parse(arrayObj[e]);
                if (objVal.error) {
                    if (objVal.proj) {
                        var projectName = search.lookupFields({
                            type: search.Type.JOB,
                            id: objVal.proj,
                            columns: ['entityid']
                        });
                        log.audit({ title: 'adding project name', details: JSON.stringify(projectName)});
                        objVal['projName'] = projectName.entityid;
                    }
                    errorArr.push(objVal);
                } else {

                    successfulArr.push(objVal);
                }
            }

            log.audit({ title: 'Total Number or Records Processed', details: arrayLength});
            log.audit({ title: 'Total Successful Processed Records', details: successfulArr.length});
            log.audit({ title: 'Total Error Records', details: errorArr.length});

            log.audit({ title: 'Error Records', details: JSON.stringify(errorArr)});
            log.audit({ title: 'Success Records', details: JSON.stringify(errorArr)});
        }
        var total = arrayLength;
        var errorTotal = errorArr.length;
        var successTotal = successfulArr.length;

        var body = '\n';
        body += '\n';
        body += '<h1>Commission Snap Shot Summary Report</h1>';
        body += '\n';
        body += '\n';
        body += '<p>Total Number of Records Processed : ' + total + '</p>';
        body += '\n';
        body += '\n';
        body += '<p>Total Number of Successes : ' + successTotal + '</p>';
        body += '\n';
        body += '\n';
        body += '<p>Total Number of Errors : ' + errorTotal + '</p>';
        body += '\n';
        body += '\n';

        if (errorArr.length > 0) {
            body += '<p><b>Returned Error List</b></p>';
            body += '\n';
            body += '\n';
            body += '<table width="75%">';
            body += '   <tr>';
            body += '       <th align="left">Project</th><th align="left">Error</th>';
            body += '   </tr>'

            for (var z = 0; z < errorArr.length; z++) {
                log.audit({ title: 'Success Records', details: JSON.stringify(errorArr[z])});
                body += '<tr>';
                body += '   <td width="20%">' + errorArr[z].projName + '</td><td>' + JSON.stringify(errorArr[z].error) + '</td>';
                body += '</tr>';
            }
            body += '</table>';

        }

        email.send({
            author: userId,
            recipients: userEmail,
            subject: 'Commission Snap Shot Processing is Complete',
            body: body,
        });

        log.audit({
            title: 'Summary Email Successfully Sent',
            details: 'Complete'
        });

    }

    function setJELines(jeRecord, account, commissionAmt, isDeferred, memo, project) {
        jeRecord.selectNewLine('line');

        jeRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'account',
            value: account
        });
        jeRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: (isDeferred) ? 'debit' : 'credit',
            value: commissionAmt
        });
        jeRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'memo',
            value: memo
        });
        jeRecord.setCurrentSublistValue({
            sublistId: 'line',
            fieldId: 'entity',
            value: project
        });

        jeRecord.commitLine('line');

    }


    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});