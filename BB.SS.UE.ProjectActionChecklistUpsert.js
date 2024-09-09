/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @Overview - Send new checklist record and associate new checklist record to related project action
 */

define(['N/record', 'N/search', 'N/task', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'], function(record, search, task, batchProcessor) {

    function afterSubmit(scriptContext){
        try {
            var processArray = [];
            var trigger = scriptContext.type;
            var project = scriptContext.newRecord;
            var projectId = project.id;
            switch (trigger) {
                case 'edit':
                    if (projectId) {
                        var customrecord_bb_project_action_checklistSearchObj = search.create({
                            type: "customrecord_bb_project_action_checklist",
                            filters:
                                [
                                    ["isinactive","is","F"],
                                    "AND",
                                    ["custrecord_bb_pachklist_project_action","anyof","@NONE@"],
                                    "AND",
                                    ["custrecord_bb_pachklist_project","anyof",projectId]
                                ],
                            columns:
                                [
                                    search.createColumn({name: "internalid", label: "Internal ID"}),
                                    search.createColumn({name: "custrecord_bb_pachklist_title", label: "Title"}),
                                    search.createColumn({name: "custrecord_bb_pachklist_action_group", label: "Action Group"}),
                                    search.createColumn({name: "custrecord_bb_pachklist_action_template", label: "Action Template"}),
                                    search.createColumn({name: "custrecord_bb_pachklist_project", label: "Project"}),
                                    search.createColumn({name: "custrecord_bb_pachklist_project_action", label: "Project Action"})
                                ]
                        });
                        var searchResultCount = customrecord_bb_project_action_checklistSearchObj.runPaged().count;
                        log.debug("customrecord_bb_project_action_checklistSearchObj result count",searchResultCount);
                        customrecord_bb_project_action_checklistSearchObj.run().each(function(result){
                            processArray.push({
                                checklistId: result.getValue({name: 'internalid'}),
                                title: result.getValue({name: 'custrecord_bb_pachklist_title'}),
                                actionGroup: result.getValue({name: 'custrecord_bb_pachklist_action_group'}),
                                actionTemplate: result.getValue({name: 'custrecord_bb_pachklist_action_template'}),
                                projectId: result.getValue({name: 'custrecord_bb_pachklist_project'}),
                                projectActionId: result.getValue({name: 'custrecord_bb_pachklist_project_action'})
                            })
                            return true;
                        });
                        if (processArray.length > 0) {
                            var taskParameters = {};
                            taskParameters['custscript_bb_ss_checklist_values'] = processArray;
                            var scriptId = 'customscript_bb_ss_proj_act_chklist';
                            var deploymentId = 'customdeploy_bb_ss_checklist_values';
                            var taskType = task.TaskType.SCHEDULED_SCRIPT;
                            batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
                        }
                    }
                break;
            }
        } catch (e) {
            log.error('error processing project action checklist', e);
        }
    }


    return {
        afterSubmit: afterSubmit
    };

});
