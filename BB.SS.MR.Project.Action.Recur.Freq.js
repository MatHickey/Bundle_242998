'use strict';
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author Melody Mattheis
 * @overview Update Project Action Recurrence Frequency when this value is changed on the Action Template
 */
/**
 * Copyright 2017-2023 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */
define(['N/search', 'N/record', 'N/runtime', 'N/task'],
(nSearch, nRecord, nRuntime, nTask) => {
    /**
   * Find all Project Action records where Action Template and Action Group are the same as in the
   * modified Action Template record
   * @returns all Project Action records to be modified
   */
    const getInputData = () => {
        log.audit('SCRIPT START', '------------------------------');
        let search;
        let projectActionId;
        let projectActionObj = {};
        let projectActionArray = [];
        const script = nRuntime.getCurrentScript();
        const actionTemplateName = script.getParameter('custscript_bb_ss_actiontmpl_name');
        const actionGroup = script.getParameter('custscript_bb_ss_actiontmpl_group');
        const actionTemplateRecurFreq = script.getParameter('custscript_bb_ss_actiontmpl_recur_freq');
        log.debug('actionTemplateName', actionTemplateName);
        log.debug('actionGroup', actionGroup);
        log.debug('actionTemplateRecurFreq', actionTemplateRecurFreq);
        search = nSearch.create({
            type: "customrecord_bb_package_task",
            filters:
            [
                ["name","startswith",actionTemplateName]
            ],
            columns:
            [
                nSearch.createColumn({name: "internalid", label: "Internal ID"})
            ]
        });
        search.run().each(function(result){
            projectActionId = result.getValue('internalid');
            return true;
        });
        search = nSearch.create({
            type: "customrecord_bb_project_action",
            filters:
            [
                ["custrecord_bb_project_package_action","anyof",projectActionId], //Action Template
                "AND",
                ["custrecord_bb_package","anyof",actionGroup] //Action Group
            ],
            columns:
            [
                nSearch.createColumn({name: "internalid"}),
            ]
        });
        search.run().each(function(result) {
            projectActionObj = {};
            projectActionObj.projectActionId = result.getValue('internalid');
            projectActionObj.actionTemplateName = actionTemplateName;
            projectActionObj.actionGroup = actionGroup;
            projectActionObj.actionTemplateRecurFreq = actionTemplateRecurFreq;
            projectActionArray.push(projectActionObj);
            return true;
        });
        log.debug('projectActionArray', projectActionArray);
        return projectActionArray;
    }
    /**
   * Updates Recurrence Frequency in each Project Action record
   */
    const reduce = (context) => {
        log.debug('in reduce', context);
        let projectActionData = JSON.parse(context.values);
        log.debug('projectActionData', projectActionData);
        nRecord.submitFields({
            type: 'customrecord_bb_project_action',
            id: projectActionData.projectActionId,
            values: {
                'custrecord_bb_recurrence_frequency': projectActionData.actionTemplateRecurFreq
            },
            options: {
                enableSourcing: false,
                ignoreMandatoryFields: true
            }
        })
    }
    /**
     * Function deactivate used Action Template Queue records
     * @param id of the Action Template Queue record
     */
    const updateQueue = (id) => {
        log.audit('in updateQueue', id);
        nRecord.submitFields({
            type: 'customrecord_bb_ss_action_template_queue',
            id: id,
            values: {
                isinactive: true
            }
        });
    }
    /**
     * Function if there are active Action Template Queue records, create a task for each of them
     */
    const execQueue = () => {
        log.audit('in execQueue');
        let search = nSearch.create({
            type: 'customrecord_bb_ss_action_template_queue',
            filters: [
                ['isinactive', 'is', 'F']
            ],
            columns: [
                'internalid',
                'custrecord_bb_ss_atq_name',
                'custrecord_bb_ss_atq_action_group',
                'custrecord_bb_ss_atq_recur_freq'
            ]
        });
        let searchResultCount = search.runPaged().count;
        log.debug('searchResultCount', searchResultCount);
        search.run().each((res) => {
            nTask.create({
                taskType: nTask.TaskType.MAP_REDUCE,
                scriptId: 'customscript_bb_ss_mr_projact_recurfreq',                         //call this script
                deploymentId: 'customdeploy_bb_ss_mr_proj_actn_rec_freq',
                params: {
                    custscript_bb_ss_actiontmpl_queue: res.id,
                    custscript_bb_ss_actiontmpl_name: res.getValue('custrecord_bb_ss_atq_name'),
                    custscript_bb_ss_actiontmpl_group: res.getValue('custrecord_bb_ss_atq_action_group'),
                    custscript_bb_ss_actiontmpl_recur_freq: res.getValue('custrecord_bb_ss_atq_recur_freq')
                }
            }).submit();
            updateQueue(res.id);
        });
    }
    /**
     * Function summarizes the map reduce process
     * @param summary
     */
     const summarize = (summary) => {
        log.debug('in summarize');
        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error("Reduce Error for key: " + key, error);
            return true;
        });
        execQueue();
        log.audit('SCRIPT END', '------------------------------');
    }
    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    }
});