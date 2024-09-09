/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @Author Matt Lehman
 * @Overview - Project Action Client script validations
 */
define(['N/https', 'N/currentRecord', 'N/search', 'N/url'],

    function(https, currentRecord, search, url) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {

        }


        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(context) {
            var currRecord = context.currentRecord;
            var projectId = currRecord.getValue({
                fieldId: 'custrecord_bb_project'
            });
            var projectActionId = currRecord.id;
            var budgetItem = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_budget_item'
            });
            var amount = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_budget_amount'
            });
            var transType = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_trans_type'
            });
            var entity = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_entity'
            });
            var committedFromStartDaysCount = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_comit_start_dt_count'
            });
            var deliveryFromStartDaysCount = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_deliv_start_dt_count'
            });
            var terms = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_terms'
            });
            var recordId = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_internalid'
            });
            var errorMargin = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_error_margin'
            });
            var cashSource = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_cash_source'
            });
            var obligationLevel = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_obligation_level'
            });
            var deliveryDate = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_delivery_date'
            });

            if (budgetItem && transType && amount) {
                console.log('attemping post request');
                var urlLink = url.resolveScript({
                    deploymentId: 'customdeploy_bb_sl_proj_act_tran_sch_upt',
                    scriptId: 'customscript_bb_sl_proj_act_tran_sch_upt',
                    returnExternalUrl: false
                })
                var response = https.post({
                    url: urlLink,
                    body: {
                        action: 'upsert',
                        custrecord_bb_pats_project: projectId,
                        custrecord_bb_pats_project_action: projectActionId,
                        custrecord_bb_pats_transaction_type: transType,
                        custrecord_bb_pats_commit_srt_day_num: committedFromStartDaysCount,
                        custrecord_bb_pats_delivery_fm_start_ct: deliveryFromStartDaysCount,
                        custrecord_bb_pats_item: budgetItem,
                        custrecord_bb_pats_amount_num: amount,
                        custrecord_bb_pats_entity: entity,
                        custrecord_bb_pats_terms: terms,
                        custrecord_bb_obligation_level: obligationLevel,
                        custrecord_bb_cash_source: cashSource,
                        custrecord_bb_error_margin: errorMargin,
                        custrecord_bb_pats_delivery_date: deliveryDate,
                        id: recordId
                    }
                });
                console.log('response body', response.body);
                if (response.body != 'failure') {
                    currRecord.setCurrentSublistValue({
                        sublistId: 'custpage_proj_action_tran_sch_list',
                        fieldId: 'custpage_pats_internalid',
                        value: response.body
                    });
                    return true;
                } else if (response.body == 'failure') {
                    return false;
                } else {
                    return true;
                }
            } // end of suitelet request to upsert transaction schedule records

            // start validation for predecessor action
            var taskId = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_task_id'
            });
            var startDate = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_start_date'
            });
            var endDate = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_end_date'
            });
            var lagDays = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_lagdays'
            });
            var type = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_type'
            });
            var parentTaskId = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_parent_task_id'
            }) || getParentTaskId(projectActionId);

            if (taskId && projectActionId && parentTaskId) {
                console.log('attemping post request on predessor task upsert');
                var urlLink = url.resolveScript({
                    deploymentId: 'customscript_bb_sl_predecessor_task_uprt',
                    scriptId: 'customdeploy_bb_sl_predecessor_task_uprt',
                    returnExternalUrl: false
                });
                var response = https.post({
                    url: urlLink,
                    body: {
                        action: 'upsertpredecessor',
                        taskId: taskId,
                        projectActionId: projectActionId,
                        lagDays: lagDays,
                        parentTaskId: parentTaskId,
                        type: type
                    }
                });
                console.log('response body', response.body);
                if (response.body != 'failure') {
                    return true;
                } else if (response.body == 'failure') {
                    return false;
                } else {
                    return true;
                }
            }
            return true;
        }


        function validateDelete(context) {
            var currRecord = context.currentRecord;
            var projectId = currRecord.getValue({
                fieldId: 'custrecord_bb_project'
            });
            var projectActionId = currRecord.id;
            var transSchedulerecordId = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_tran_sch_list',
                fieldId: 'custpage_pats_internalid'
            });
            if (transSchedulerecordId) {
                console.log('attemping delete post request');
                var urlLink = url.resolveScript({
                    deploymentId: 'customdeploy_bb_sl_proj_act_tran_sch_upt',
                    scriptId: 'customscript_bb_sl_proj_act_tran_sch_upt',
                    returnExternalUrl: false
                });
                var response = https.post({
                    url: urlLink,
                    body: {
                        action: 'transScheduledelete',
                        id: transSchedulerecordId
                    }
                });
                console.log('response body', response.body);
                if (response.body == 'delete') {
                    return true;
                } else if (response.body == 'failure') {
                    return false;
                } else {
                    return true;
                }

            }


            var predecessorId = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_task_id'
            });
            var parentTaskId = currRecord.getCurrentSublistValue({
                sublistId: 'custpage_proj_action_pred_tasks',
                fieldId: 'custpage_pred_parent_task_id'
            }) || getParentTaskId(projectActionId);
            if (predecessorId && parentTaskId) {
                console.log('attemping delete post request');
                var urlLink = url.resolveScript({
                    deploymentId: 'customscript_bb_sl_predecessor_task_uprt',
                    scriptId: 'customdeploy_bb_sl_predecessor_task_uprt',
                    returnExternalUrl: false
                });
                var response = https.post({
                    url: urlLink,
                    body: {
                        action: 'predecessordelete',
                        id: predecessorId,
                        parentTaskId: parentTaskId
                    }
                });
                console.log('response body', response.body);
                if (response.body == 'delete') {
                    return true;
                } else if (response.body == 'failure') {
                    return false;
                } else {
                    return true;
                }
            }
            return true
        }

        function getParentTaskId(projectActionId) {
            var parentTaskId = null;
            if (projectActionId) {
                var projecttaskSearchObj = search.create({
                    type: "projecttask",
                    filters: [
                        ["custevent_bb_ss_project_action_list", "anyof", projectActionId]
                    ],
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "Parent Project Task Internal ID"
                        }),
                    ]
                });
                var searchResultCount = projecttaskSearchObj.runPaged().count;
                log.debug("projecttaskSearchObj result count", searchResultCount);
                projecttaskSearchObj.run().each(function(result) {
                    parentTaskId = result.getValue({
                        name: 'internalid'
                    });
                    return true;
                });
            }
            return parentTaskId;
        }

        return {
            pageInit: pageInit,
            validateLine: validateLine,
            validateDelete: validateDelete
        };

    });