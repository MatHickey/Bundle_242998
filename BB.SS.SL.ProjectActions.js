/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/redirect', 'N/task', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'],

function(serverWidget, record, search, redirect, task, batchProcessor) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        if (context.request.method == 'GET') {
            var phase = context.request.parameters.phase;
            var package = context.request.parameters.package;
            var projId = context.request.parameters.projectId;
            var form = serverWidget.createForm({
                title: 'Multi-Project Action Submission'
            });
            var projectGroup = form.addFieldGroup({
                id: 'custpage_project_group',
                label: 'Project Related Fields'
            });
            var projectRecord = form.addField({
                id: 'custpage_header_project_id',
                type: serverWidget.FieldType.SELECT,
                label: 'Project',
                source: 'job',
                container: 'custpage_project_group'
            });
            projectRecord.defaultValue = projId;
            projectRecord.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.INLINE
            });

            // filter fields
            var filterGroup = form.addFieldGroup({
                id: 'custpage_filter_group',
                label: 'Project Action Filters'
            });
            var phaseRecord = form.addField({
                id: 'custpage_phase_id',
                type: serverWidget.FieldType.SELECT,
                label: 'Phase',
                source: 'customrecord_bb_phase',
                container: 'custpage_filter_group'
            });
            phaseRecord.defaultValue = (phase) ? phase : null;

            var packageRecord = form.addField({
                id: 'custpage_package_id',
                type: serverWidget.FieldType.SELECT,
                label: 'Package',
                container: 'custpage_filter_group'
            });
            packageRecord.addSelectOption({
                value: '',
                text: ''
            });
            getPackageSelectOptions(packageRecord, phase);

            packageRecord.defaultValue = (package) ? package: null;

            var sublist = form.addSublist({
                id: 'custpage_project_action_list',
                type: serverWidget.SublistType.INLINEEDITOR,
                label: 'Project Actions'
            });

            sublist = createSuiteletFields(sublist, package, projId);

            processSublistResults(sublist, package, phase, projId);

            // form.addSubmitButton({
            //     label: 'Submit'
            // });
            form.clientScriptModulePath = './BB.SS.CS.ProjectActionSuitelet';


            context.response.writePage(form);
        } 

        if (context.request.method == 'POST') {
            var values = {};
            if (context.request.parameters.action == 'updateline' && context.request.parameters.projectActionId) {
                try {
                    log.debug('params', context.request.parameters);
                    // set some fields,
                    if (context.request.parameters.docStatus && context.request.parameters.docStatusDate) {
                        values['custrecord_bb_document_status'] = context.request.parameters.docStatus;
                        values['custrecord_bb_document_status_date'] = new Date(context.request.parameters.docStatusDate);
                    }
                    if (context.request.parameters.submitToEmp) {
                        values['custrecord_bb_proj_act_assigned_to_emp'] = context.request.parameters.submitToEmp;
                    }
                    if (context.request.parameters.submitToRole) {
                        values['custrecord_bb_proj_act_assigned_role'] = context.request.parameters.submitToRole;
                    }
                    if (context.request.parameters.actionItem) {
                        values['custrecord_bb_proj_action_item'] = context.request.parameters.actionItem;
                    }
                    if (context.request.parameters.budgetAmount) {
                        values['custrecord_bb_proj_action_amount'] = context.request.parameters.budgetAmount;
                    }
                    if (context.request.parameters.responseDays) {
                        values['custrecord_exp_duration_busn_day_count'] = context.request.parameters.responseDays;
                    }
                    if (context.request.parameters.precedingAction) {
                        values['custrecord_bb_projact_preced_proj_action'] = context.request.parameters.precedingAction;
                    }
                    // setting general fields required for the save
                    values['custrecord_bb_project'] = context.request.parameters.projectId;
                    values['custrecord_bb_project_package_action'] = context.request.parameters.packageActionId;
                    values['custrecord_bb_package'] = context.request.parameters.packageId;
                    record.submitFields({
                        type: 'customrecord_bb_project_action',
                        id: context.request.parameters.projectActionId,
                        values: values,
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });
                    // send back expected complete date
                    var expectedResponseDate = getExpectedCompleteDate(context.request.parameters.projectActionId);
                    log.debug('expected reponse date', expectedResponseDate);
                    if (expectedResponseDate) {
                        var responseDateString = String(expectedResponseDate)
                        context.response.write(responseDateString);
                        // context.response.write('success'); 
                    } else {
                        context.response.write('success'); 
                    }
                    log.debug('successful update to project action');
                    return;
                } catch (e) {
                    log.debug('error update to project action', e);
                    context.response.write('failure');
                    return 
                }
            }
            // return 
        }

    }

    function getExpectedCompleteDate(id) {
        var expectedResponseDate = null;
        if (id) {
            var customrecord_bb_project_actionSearchObj = search.create({
                type: "customrecord_bb_project_action",
                filters:
                [
                    ["internalid","anyof",id]
                ],
                columns:
                [
                    "internalid",
                    search.createColumn({
                        name: "name",
                        sort: search.Sort.ASC
                    }),
                    "custrecord_bb_proj_action_response_date"
                ]
            });
            customrecord_bb_project_actionSearchObj.run().each(function(result){
                expectedResponseDate = result.getValue({name: 'custrecord_bb_proj_action_response_date'});
                return true;
            });
        }
        log.debug('expected response date in search result', expectedResponseDate);
        return expectedResponseDate;
    }


    function createSuiteletFields(sublist, package, projectId) {
        var projActionId = sublist.addField({
            id: 'custpage_project_action_id',
            type: serverWidget.FieldType.TEXT,
            label: 'Project Action ID'
        });
        projActionId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });
        var packageId = sublist.addField({
            id: 'custpage_package_id',
            type: serverWidget.FieldType.SELECT,
            label: 'Package',
            source: 'customrecord_bb_package'
        });
        packageId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        var phase = sublist.addField({
            id: 'custpage_phase_id',
            type: serverWidget.FieldType.SELECT,
            label: 'Phase',
            source: 'customrecord_bb_phase'
        });
        phase.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
        });

        var packageActionId = sublist.addField({
            id: 'custpage_package_action_id',
            type: serverWidget.FieldType.SELECT,
            label: 'Package Action',
            source: 'customrecord_bb_package_task'
        });
        packageActionId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.DISABLED
        });

        var docStatus = sublist.addField({
            id: 'custpage_doc_status_id',
            type: serverWidget.FieldType.SELECT,
            label: 'Action Status'
        });
        docStatus.addSelectOption({
            value: '',
            text: ''
        });
        getDocumentStatusSelectOptions(docStatus, package); // QO: TODO: sort the options

        var docStatusDate = sublist.addField({
            id: 'custpage_doc_status_date',
            type: serverWidget.FieldType.DATE,
            label: 'Action Status Date'
        });
        docStatusDate.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.DISABLED
        });

        var preceedingProjectAction = sublist.addField({
            id: 'custpage_preceeding_proj_action_id',
            type: serverWidget.FieldType.SELECT,
            label: 'Preceeding Project Action'
        });
        preceedingProjectAction.addSelectOption({
            value: '',
            text: ''
        });
        // add select option to filter project actions based on project
        getProjectActionRecords(preceedingProjectAction, projectId);

        var expectedDate = sublist.addField({
            id: 'custpage_expected_date',
            type: serverWidget.FieldType.DATE,
            label: 'Expected Complete Date'
        });
//        expectedDate.updateDisplayType({
//            displayType : serverWidget.FieldDisplayType.DISABLED
//        });
//        var responseDays = sublist.addField({
//            id: 'custpage_response_days',
//            type: serverWidget.FieldType.TEXT,
//            label: 'Duration In Days'
//        });
        var assignedToRole = sublist.addField({
            id: 'custpage_assigned_to_role',
            type: serverWidget.FieldType.SELECT,
            label: 'Assigned To Role',
            source: 'role'
        });
        var assignedTo = sublist.addField({
            id: 'custpage_assigned_to_emp',
            type: serverWidget.FieldType.SELECT,
            label: 'Assigned To',
            source: 'employee'
        });
//        var budgetItem = sublist.addField({
//            id: 'custpage_action_item',
//            type: serverWidget.FieldType.SELECT,
//            label: 'Budget Item',
//            source: 'item'
//        });
//        var budgetAmount = sublist.addField({
//            id: 'custpage_budget_amount',
//            type: serverWidget.FieldType.FLOAT,
//            label: 'Budget Amount'
//        });
        return sublist;
    }

    function getPackageSelectOptions(fieldObj, phase) {
        if (phase) {
            var customrecord_bb_packageSearchObj = search.create({
                type: "customrecord_bb_package",
                filters:
                [
                    ["custrecord_bb_phase","anyof", phase]
                ],
                columns:
                [
                    "internalid",
                    "name",
                    search.createColumn({
                        name: "custrecord_bb_package_sequence_num",
                        sort: search.Sort.ASC
                    })
                ]
            });
            customrecord_bb_packageSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var id = result.getValue({name: 'internalid'});
                var text = result.getValue({name: 'name'})
                if (fieldObj) {
                    fieldObj.addSelectOption({
                        value: id,
                        text: text
                    });

                }
                return true;
            });
            if (fieldObj) {
                return fieldObj;
            }
        }
    }


    /**
     * Get the Action Status based on sequence
     */
    function getDocumentStatusSelectOptions(docStatus, package) {
        if (package) {
            var docStatusSearch = search.create({
                type: "customrecord_bb_document_status",
                filters:
                [
                    ["custrecord_bb_doc_status_package","anyof", package], 
                    "AND", 
                    ["isinactive","is","F"]
                ],
                columns:
                [
                	"internalid",
                	"name",
                    search.createColumn({
                        name: "custrecord_bb_doc_status_seq",
                        sort: search.Sort.ASC
                     })
                ]
            });
            docStatusSearch.run().each(function(result){
                var id = result.getValue({
                    name: 'internalid'
                });
                var text = result.getValue({
                    name: 'name'
                })
                if (docStatus) {
                    docStatus.addSelectOption({
                        value: id,
                        text: text
                    });

                }
                return true;
            });
            if (docStatus) {
                return docStatus;
            }
        }
    }



    function processSublistResults(sublist, package, phase, projectId) {
        var configObj = search.lookupFields({
            type: 'customrecord_bb_solar_success_configurtn',
            id: 1,
            columns: ['custrecord_expected_response_days']
        });
        var defaultExpectedResonseDays = configObj.custrecord_expected_response_days;
        var counter = 0;
        if (phase && package && projectId) {
            var customrecord_bb_project_actionSearchObj = search.create({
                type: "customrecord_bb_project_action",
                filters:
                [
                    ["custrecord_bb_package.custrecord_bb_phase","anyof", phase], 
                    "AND", 
                    ["custrecord_bb_package","anyof", package],
                    "AND", 
                    ["custrecord_bb_project","anyof", projectId],
                    "AND",
                    ["isinactive","is","F"],
                    "AND",
                    ["custrecord_bb_proj_actn_previous_rev_box", "is", "F"]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "custrecord_bb_project", label: "Project"}),
                    search.createColumn({name: "custrecord_bb_package", label: "Package"}),
                    search.createColumn({
                        name: "custrecord_bb_phase",
                        join: "CUSTRECORD_BB_PACKAGE",
                        label: "Phase"
                    }),
                    search.createColumn({name: "custrecord_bb_project_package_action", label: "Package Action"}),
                    search.createColumn({name: "custrecord_bb_document_status_date", label: "Action Status Date"}),
                    search.createColumn({name: "custrecord_bb_document_status", label: "Action Status"}),
                    search.createColumn({name: "custrecord_bb_projact_preced_proj_action", label: "Preceding project Action"}),
                    search.createColumn({name: "custrecord_bb_proj_act_assigned_role", label: "Assigned To Role"}),
                    search.createColumn({name: "custrecord_bb_proj_act_assigned_to_emp", label: "Assigned To"}),
                    search.createColumn({name: "custrecord_bb_proj_action_item", label: "Action Item"}),
                    search.createColumn({name: "custrecord_bb_proj_action_response_date", label: "Expected Date"}),
                    search.createColumn({name: "custrecord_exp_duration_busn_day_count", label: "Duration in Days"}),
                    search.createColumn({name: "custrecord_bb_proj_action_amount", label: "Budget Amount"}),
                ]
            });
            var searchResultCount = customrecord_bb_project_actionSearchObj.runPaged().count;
            log.debug("customrecord_bb_project_actionSearchObj result count",searchResultCount);
            customrecord_bb_project_actionSearchObj.run().each(function(result){
                var obj = {};
                obj['internalid'] = result.getValue({name: 'internalid'});
                obj['projectId'] = result.getValue({name: 'custrecord_bb_project'});
                obj['packageId'] = result.getValue({name: 'custrecord_bb_package'});
                obj['phaseId'] = result.getValue({name: 'custrecord_bb_phase', join: 'CUSTRECORD_BB_PACKAGE'});
                obj['packageActionId'] = result.getValue({name: 'custrecord_bb_project_package_action'});
                obj['responseDays'] = (result.getValue({name: 'custrecord_exp_duration_busn_day_count'})) ? result.getValue({name: 'custrecord_exp_duration_busn_day_count'}) : defaultExpectedResonseDays;
                obj['docStatusDate'] = result.getValue({name: 'custrecord_bb_document_status_date'});
                obj['expectedDate'] = result.getValue({name: 'custrecord_bb_proj_action_response_date'}); 
                obj['docStatus'] = result.getValue({name: 'custrecord_bb_document_status'});
                obj['precedingAction'] = result.getValue({name: 'custrecord_bb_projact_preced_proj_action'});
                obj['assignedToRole'] = result.getValue({name: 'custrecord_bb_proj_act_assigned_role'});
                obj['assignedToEmp'] = result.getValue({name: 'custrecord_bb_proj_act_assigned_to_emp'});
                obj['actionItem'] = result.getValue({name: 'custrecord_bb_proj_action_item'});
                
                obj['budgetAmount'] = result.getValue({name: 'custrecord_bb_proj_action_amount'});
                setSublistValues(sublist, obj, counter);
                counter++
                return true;
            });
        }
    }


    function setSublistValues(sublist, obj, lineNum) {
        if (obj.internalid) {
            sublist.setSublistValue({
                id: 'custpage_project_action_id',
                line: lineNum,
                value: obj.internalid
            });
        }
        if (obj.packageId) {
            sublist.setSublistValue({
                id: 'custpage_package_id',
                line: lineNum,
                value: obj.packageId
            });
        }
        if (obj.phaseId) {
            sublist.setSublistValue({
                id: 'custpage_phase_id',
                line: lineNum,
                value: obj.phaseId
            });
        }
        if (obj.packageActionId) {
            sublist.setSublistValue({
                id: 'custpage_package_action_id',
                line: lineNum,
                value: obj.packageActionId
            });
        }
        if (obj.expectedDate) {
            sublist.setSublistValue({
                id: 'custpage_expected_date',
                line: lineNum,
                value: obj.expectedDate
            });        
        }
        if (obj.docStatus) {
            sublist.setSublistValue({
                id: 'custpage_doc_status_id',
                line: lineNum,
                value: obj.docStatus
            });
        }
        if (obj.docStatusDate) {
            sublist.setSublistValue({
                id: 'custpage_doc_status_date',
                line: lineNum,
                value: obj.docStatusDate
            });
        }
        if (obj.precedingAction) {
            sublist.setSublistValue({
                id: 'custpage_preceeding_proj_action_id',
                line: lineNum,
                value: obj.precedingAction
            });
        }
        if (obj.assignedToRole) {
            sublist.setSublistValue({
                id: 'custpage_assigned_to_role',
                line: lineNum,
                value: obj.assignedToRole
            });
        }
        if (obj.assignedToEmp) {
            sublist.setSublistValue({
                id: 'custpage_assigned_to_emp',
                line: lineNum,
                value: obj.assignedToEmp
            });
        }
        if (obj.actionItem) {
            sublist.setSublistValue({
                id: 'custpage_action_item',
                line: lineNum,
                value: obj.actionItem
            });
        }
        if (obj.responseDays) {
            sublist.setSublistValue({
                id: 'custpage_response_days',
                line: lineNum,
                value: obj.responseDays
            });
        }
        if (obj.budgetAmount) {
            sublist.setSublistValue({
                id: 'custpage_budget_amount',
                line: lineNum,
                value: obj.budgetAmount
            });
        }
    }


    function getProjectActionRecords(fieldObj, projectId) {
        if (projectId) {
            var customrecord_bb_project_actionSearchObj = search.create({
                type: "customrecord_bb_project_action",
                filters:
                [
                    ["custrecord_bb_project","anyof", projectId],
                    "AND", 
                    ["isinactive","is","F"]

                ],
                columns:
                [
                    search.createColumn({name: "internalid"}),
                    search.createColumn({name: "name"}),
                ]
            });
            var searchResultCount = customrecord_bb_project_actionSearchObj.runPaged().count;
            log.debug("customrecord_bb_project_actionSearchObj result count",searchResultCount);
            customrecord_bb_project_actionSearchObj.run().each(function(result){
                var id = result.getValue({name: 'internalid'});
                var text = result.getValue({name: 'name'});
                if (fieldObj) {
                    fieldObj.addSelectOption({
                        value: id,
                        text: text
                    })
                }
                return true;
            });
            if (fieldObj) {
                return fieldObj
            }
        }
    }

    return {
        onRequest: onRequest
    };
    
});