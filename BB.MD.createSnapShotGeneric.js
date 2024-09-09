/* jshint unused:true, undef:true */
define( // jshint ignore:line
    ['N/url', 'N/https', './util.js', 'N/search', 'N/runtime', 'N/query', 'N/ui/serverWidget'],

    function (url, https, util, search, runtime, query, serverWidget) {

        var fieldTypeMapping = {
            'select': serverWidget.FieldType.SELECT,
            'text': serverWidget.FieldType.TEXT
        }

        function createSnapShotSublistFields(context, period, editSublist, config, recType) {

            var commissionDataSet = config.getValue({
                fieldId: 'custrecord_bbss_commission_dataset_id'
            });
            var myLoadedQuery = query.load({
                id: commissionDataSet
            });

            var form = serverWidget.createForm({
                title: 'Create Commission Snap Shots'
            });

            var payrollPeriod = form.addField({
                id: 'custpage_payroll_period',
                type: serverWidget.FieldType.SELECT,
                label: 'Select Payroll Period',
                source: 'customrecord_bb_payroll_period'
            });

            var period = context.request.parameters.payrollPeriod;

            var currentPeriod = getCurrentPayrollPeriod();
            log.debug('newest payroll period', currentPeriod);

            payrollPeriod.defaultValue = (period) ? period : currentPeriod;

            var recordType = form.addField({
                id: 'custpage_record_type',
                type: serverWidget.FieldType.TEXT,
                label: 'Record Type'
            });
            recordType.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            recordType.defaultValue = recType;

            if (myLoadedQuery) {

                var sublist = form.addSublist({
                    id: 'custpage_snap_shot_list',
                    label: 'Records Available to Add to Snap Shot',
                    type: serverWidget.SublistType.LIST
                });

                sublist = createSuiteletFields(sublist, recType, myLoadedQuery);

                processSnapShotResults(myLoadedQuery, sublist, period, false, false, false);

                sublist.addButton({
                    id: 'custpage_mark_all',
                    label: 'Mark All',
                    functionName: 'markAll(true, "custpage_snap_shot_list")'
                });
                sublist.addButton({
                    id: 'custpage_mark_all',
                    label: 'Unmark All',
                    functionName: 'markAll(false, "custpage_snap_shot_list")'
                });

            } else {
                form.addPageInitMessage({
                    type: message.Type.INFORMATION,
                    message: 'There is no Data setup on the configuration record for Commission Snap Shots, please see your adminstrator.',
                    duration: 10000
                });
            }

            form.addSubmitButton({
                label: 'Save Commission SnapShot'
            });
            var editSnapShot = form.addButton({
                id: 'custpage_delete_snap_shot',
                label: 'Edit Snap Shot',
                functionName: 'editSnapShot'
            });

            var deleteSnapShot = form.addButton({
                id: 'custpage_delete_snap_shot',
                label: 'Delete Snap Shot',
                functionName: 'deleteSnapShot'
            });

            var createCommJournal = form.addButton({
                id: 'custpage_create_comm_je',
                label: 'Create Commission Journals',
                functionName: 'createCommJe'
            });


            return form;
        }


        function createSuiteletFields(sublist, recType, myLoadedQuery) {
            sublist.addField({
                id: 'custpage_check_box',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Mark'
            });
            for (var index in myLoadedQuery.columns) {
                var fieldCode = myLoadedQuery.columns[index];
                var fieldArr = fieldCode.label.split('.');
                var fieldType = fieldArr[0];
                var fieldId = fieldArr[1];
                var fieldlabel = fieldArr[2]
                var fieldSource = fieldArr[3]

                log.debug('fieldId', fieldId)
                log.debug('fieldSource', fieldSource)

                if (fieldSource) {
                    sublist.addField({
                        id: fieldId,
                        type: fieldTypeMapping[fieldType],
                        label: fieldlabel,
                        source: fieldSource
                    });
                } else {
                    sublist.addField({
                        id: fieldId,
                        type: fieldTypeMapping[fieldType],
                        label: fieldlabel
                    });
                }


            }
            var results = myLoadedQuery.run();
            log.debug('results', results)
            return sublist;
        }

        function getCurrentPayrollPeriod() {
            var period;
            var customrecord_bb_payroll_periodSearchObj = search.create({
                type: "customrecord_bb_payroll_period",
                filters:
                    [],
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
            log.debug("customrecord_bb_payroll_periodSearchObj result count", searchResultCount);
            customrecord_bb_payroll_periodSearchObj.run().each(function (result) {
                period = result.getValue({
                    name: 'internalid',
                    summary: 'GROUP'
                })
            });
            return period;

        }

        function processSnapShotResults(myLoadedQuery, sublist, payrollPeriod, editSublist, deleteSublist, createJe) {

            var resultSet = myLoadedQuery.run()
            var columnArr = []
            for (var index in myLoadedQuery.columns) {
                var fieldCode = myLoadedQuery.columns[index];
                var fieldArr = fieldCode.label.split('.');
                var fieldId = fieldArr[1];
                columnArr.push(fieldId)
            }
            for (var ind = 0; ind < resultSet.results.length; ind++) {
                for (var num = 0; num < columnArr.length; num++) {
                    log.debug('columnArr[num]', columnArr[num])
                    log.debug('resultSet.results.values[num]', resultSet.results[ind].values[num])

                    sublist.setSublistValue({
                        id: columnArr[num],
                        line: ind,
                        value: resultSet.results[ind].values[num]
                    });

                }
            }
        }

        function snapshotprocessing(context, period, editSublist, config, recType) {
            var editDeleteSavedSearchId = runtime.getCurrentScript().getParameter({
                name: 'custscript_bbss_editdeletesublist_search'
            });
            var searchData = search.load({
                id: editDeleteSavedSearchId,
                type: 'customrecord_bb_commission_snap_shot'
            })
            var recordType = context.request.parameters.recType;
            var form;
            if(recordType == 'EditSnapShot'){
                 form = serverWidget.createForm({
                    title: 'Edit Commission Snap Shots'
                });
            }else if(recordType == 'DeleteSnapShot'){
                 form = serverWidget.createForm({
                    title: 'Delete Commission Snap Shots'
                });
            }else if(recordType == 'SnapShotJE'){
                form = serverWidget.createForm({
                    title: 'Create Snapshot Journal Entry'
                });
            }


            var payrollPeriod = form.addField({
                id: 'custpage_payroll_period',
                type: serverWidget.FieldType.SELECT,
                label: 'Select Payroll Period',
                source: 'customrecord_bb_payroll_period'
            });

            var period = context.request.parameters.payrollPeriod;

            var currentPeriod = getCurrentPayrollPeriod();
            log.debug('newest payroll period', currentPeriod);

            payrollPeriod.defaultValue = (period) ? period : currentPeriod;

            var recordTypeField = form.addField({
                id: 'custpage_record_type',
                type: serverWidget.FieldType.TEXT,
                label: 'Record Type'
            });
            recordTypeField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            recordTypeField.defaultValue = recordType;
            var sublist;
            if(recordType == 'EditSnapShot'){
                sublist = form.addSublist({
                    id: 'custpage_snap_shot_list',
                    type: serverWidget.SublistType.LIST,
                    label: 'Edit Snap Shot Records'
                });
            }else if(recordType == 'DeleteSnapShot'){
                sublist = form.addSublist({
                    id: 'custpage_snap_shot_list',
                    type: serverWidget.SublistType.LIST,
                    label: 'Delete Snap Shot Records'
                });
            }else if(recordType == 'SnapShotJE'){
                sublist = form.addSublist({
                    id: 'custpage_snap_shot_list',
                    type: serverWidget.SublistType.LIST,
                    label: 'Create SnapShot JE'
                });
            }




            form.addSubmitButton({
                label: 'Save'
            });

            var returnToHome = form.addButton({
                id: 'custpage_return_to_home',
                label: 'Back',
                functionName: 'returnToHome'
            });

            sublist = createEditDeleteCommSnapShotSuiteletFields(sublist, searchData);
            sublist.addButton({
                id: 'custpage_mark_all',
                label: 'Mark All',
                functionName: 'markAll(true, "custpage_snap_shot_list")'
            });
            sublist.addButton({
                id: 'custpage_mark_all',
                label: 'Unmark All',
                functionName: 'markAll(false, "custpage_snap_shot_list")'
            });

              var showButton = processEditDeleteSnapShotResults(searchData, sublist, period,recordType);
             /* if (showButton) {
                  var refresh = form.addButton({
                      id: 'custpage_refesh_list',
                      label: 'Refresh Snap Shot',
                      functionName: 'refreshSnapShot'
                  });
              }*/

            return form;

        }


        function createEditDeleteCommSnapShotSuiteletFields(sublist, searchData) {


            sublist.addField({
                id: 'custpage_check_box',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Mark'
            });
            for (var index in searchData.columns) {
                var fieldCode = searchData.columns[index].label;
                var fieldArr = fieldCode.split('.');
                var fieldType = fieldArr[0];
                var fieldId = fieldArr[1];
                var fieldlabel = fieldArr[2]
                var fieldSource = fieldArr[3]


                if (fieldSource) {
                    sublist.addField({
                        id: fieldId,
                        type: fieldTypeMapping[fieldType],
                        label: fieldlabel,
                        source: fieldSource
                    });
                } else {
                    sublist.addField({
                        id: fieldId,
                        type: fieldTypeMapping[fieldType],
                        label: fieldlabel
                    });
                }


            }
            return sublist;
        }

        function processEditDeleteSnapShotResults(searchData, sublist, period,recordType) {

            if(recordType=='SnapShotJE') {
                var jeFilter = search.createFilter({
                    name: 'custrecord_bb_comm_snap_shot_journal',
                    operator: search.Operator.ANYOF,
                    values: '@NONE@'
                })
                searchData.filters.push(jeFilter)
            }
                var periodFilter = search.createFilter({
                    name: 'custrecord_bb_comm_snap_shot_pay_period',
                    operator: search.Operator.ANYOF,
                    values: period
                })


            searchData.filters.push(periodFilter)


            var columnArr = []
            for (var index in searchData.columns) {
                var fieldCode = searchData.columns[index].label;
                var fieldArr = fieldCode.split('.');
                var fieldId = fieldArr[1];
                columnArr.push(fieldId)
            }
            var counter=0;
            log.debug('searchData',searchData)
            searchData.run().each(function(result) {
                log.debug('result',result)
                for (var num = 0; num < columnArr.length; num++) {

                    sublist.setSublistValue({
                        id: columnArr[num],
                        line: counter,
                        value: result.getValue(result.columns[num])
                    });

                }
                counter=counter+1;
                return true;
            });

        }



        return {
            createSnapShotSublistFields: createSnapShotSublistFields,
            snapshotprocessing: snapshotprocessing,
        };
    })
