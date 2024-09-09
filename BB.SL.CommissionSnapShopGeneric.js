/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/search', 'N/record', './BB.MD.createSnapShotGeneric.js', 'N/task', 'N/redirect', 'N/ui/serverWidget','N/runtime'], function (search, record, commSnapshotLib, task, redirect, serverWidget,runtime) {
    function onRequest(context) {
        if (context.request.method == 'GET') {

            var configurationId = getConfigurationRecordId();
            var config = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: configurationId
            });


            var recordType = context.request.parameters.recType;
            log.debug('recordType', recordType)
            var period = context.request.parameters.payrollPeriod;
            var submittedTaskId = context.request.parameters.mapreducetask;
            var form
            if (!submittedTaskId) {
                if (recordType == 'SnapShotJE') {
                    form = commSnapshotLib.snapshotprocessing(context, period, config, recordType);
                } else if (recordType == 'EditSnapShot') {
                    form = commSnapshotLib.snapshotprocessing(context, period, true, config, recordType);
                } else if (recordType == 'DeleteSnapShot') {
                    form = commSnapshotLib.snapshotprocessing(context, period, recordType);
                } else {
                    //create snap shot screen
                    form = commSnapshotLib.createSnapShotSublistFields(context, period, false, config, 'CreateSnapShot');
                }

            }else{
                var scriptObj = runtime.getCurrentScript()
                 form = serverWidget.createForm({
                    title: 'Consolidated Energy Details'
                });
                var fld_task = form.addField({
                    id: "custpage_taskid",
                    type: serverWidget.FieldType.TEXT,
                    label: 'task id'
                });

                fld_task.defaultValue = submittedTaskId;

                fld_task.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                var scriptId = form.addField({
                    id: "custpage_scriptid",
                    type: serverWidget.FieldType.TEXT,
                    label: 'task id'
                });

                scriptId.defaultValue = scriptObj.id;

                scriptId.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                var depId = form.addField({
                    id: "custpage_depid",
                    type: serverWidget.FieldType.TEXT,
                    label: 'task id'
                });

                depId.defaultValue = scriptObj.deploymentId;

                depId.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
            }

            form.clientScriptModulePath = './BB SS/SS Lib/BB.CS.CommissionSnapshotGeneric.js';
            context.response.writePage(form);
        } else {
            var payrollPeriod = context.request.parameters.custpage_payroll_period
            var recordType = context.request.parameters.custpage_record_type
            log.debug('payrollPeriod', payrollPeriod)
            log.debug('recordType', recordType)
            var projLines = context.request.getLineCount({
                group: 'custpage_snap_shot_list'
            });
            var mappingObj = getCommissionSnapShotMappings();

            log.debug('mappingObj', mappingObj)

            var commissionsnapshotcreationArray = []
            for (var num = 0; num < projLines; num++) {
                var mark = context.request.getSublistValue({
                    group: 'custpage_snap_shot_list',
                    name: 'custpage_check_box',
                    line: num
                });
                log.debug('mark', mark)
                if (mark == 'T') {

                    var commRecord = {}
                    commRecord['recordType'] = recordType

                    for (var ind in mappingObj['fieldMap']) {
                        log.debug('ind', ind)
                        log.debug('mappingObj[fieldMap][ind]', mappingObj['fieldMap'][ind])
                        var isIntegeger = mappingObj['fieldMap'][ind]['isIntegrer']
                        var isgroup = mappingObj['fieldMap'][ind]['isGroup']
                        var isAmount = mappingObj['fieldMap'][ind]['isAmount']
                        if (isgroup) {
                            commRecord['isGroup'] = ind
                        }
                        if (isAmount) {
                            commRecord['isAmount'] = ind
                        }
                        commRecord['custrecord_bb_comm_snap_shot_pay_period'] = payrollPeriod
                        if (isIntegeger) {
                            commRecord[ind] = parseInt(context.request.getSublistValue({
                                group: 'custpage_snap_shot_list',
                                name: mappingObj['fieldMap'][ind]['fieldId'],
                                line: num
                            }))
                        } else {
                            commRecord[ind] = context.request.getSublistValue({
                                group: 'custpage_snap_shot_list',
                                name: mappingObj['fieldMap'][ind]['fieldId'],
                                line: num
                            })
                        }

                    }
                    commissionsnapshotcreationArray.push(commRecord)
                }
            }
            log.debug('commissionsnapshotcreationArray', commissionsnapshotcreationArray)
            var mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_bb_mr_commissionsnapshotgen',
                deploymentId: 'customdeploy_bb_mr_commissionsnapshotgen',
                params: {
                    custscript_bbss_comm_array: commissionsnapshotcreationArray,
                }
            });
            var taskID = mrTask.submit();
            redirect.toSuitelet({
                scriptId: 'customscript_bb_sl_commissionsnapshopgen',
                deploymentId: 'customdeploy_bb_sl_commissionsnapshopgen',
                parameters: {
                    'mapreducetask': taskID
                }
            });
        }
    }


    function getConfigurationRecordId() {
        var configId;
        var configSearch = search.create({
            type: "customrecord_bb_solar_success_configurtn",
            filters:
                [],
            columns:
                [
                    search.createColumn({
                        name: "internalid",
                        summary: "MAX"
                    }),
                ]
        });
        var searchResultCount = configSearch.runPaged().count;
        log.debug("configSearch result count", searchResultCount);
        configSearch.run().each(function (result) {
            configId = result.getValue({
                name: 'internalid',
                summary: 'MAX'
            });

        });
        return configId;
    }


    function getCommissionSnapShotMappings() {
        var customrecord_bbss_comm_snapshot_mappingSearchObj = search.create({
            type: "customrecord_bbss_comm_snapshot_mapping",
            filters:
                [],
            columns:
                [
                    search.createColumn({
                        name: "name",
                        sort: search.Sort.ASC,
                        label: "Name"
                    }),
                    search.createColumn({
                        name: "custrecord_bbs_comm_dataset_field",
                        label: "Commission Data set Field"
                    }),
                    search.createColumn({
                        name: "custrecord_bbss_comm_snapshot_field",
                        label: "Commission Snapshot Field"
                    }),
                    search.createColumn({
                        name: "custrecord_bbss_is_integer",
                    }),
                    search.createColumn({
                        name: "custrecord_bbss_group_key",
                    }),
                    search.createColumn({
                        name: "custrecord_bbss_is_amount",
                    })
                ]
        });
        var searchResultCount = customrecord_bbss_comm_snapshot_mappingSearchObj.runPaged().count;
        log.debug("customrecord_bbss_comm_snapshot_mappingSearchObj result count", searchResultCount);
        var mappingObj = {}
        var nameObj = {}

        customrecord_bbss_comm_snapshot_mappingSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var mapObj = {}
            mapObj['fieldId'] = result.getValue({
                name: 'custrecord_bbs_comm_dataset_field'
            })
            mapObj['isIntegrer'] = result.getValue({
                name: 'custrecord_bbss_is_integer'
            })
            mapObj['isGroup'] = result.getValue({
                name: 'custrecord_bbss_group_key'
            })
            mapObj['isAmount'] = result.getValue({
                name: 'custrecord_bbss_is_amount'
            })
            nameObj[result.getValue({
                name: 'custrecord_bbss_comm_snapshot_field'
            })] = mapObj


            return true;
        });
        mappingObj['fieldMap'] = nameObj
        return mappingObj;
    }

    return {
        onRequest: onRequest
    };
});