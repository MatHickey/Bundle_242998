/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */

 /**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/record', 'N/search', 'N/runtime', './BB SS/SS Lib/BB.SS.DocumentStatus.Service', 'N/file'],

function(record, search, runtime, docService, nFile) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
        var paramsObj = runtime.getCurrentScript();
        var projectId = JSON.parse(paramsObj.getParameter({
            name: 'custscript_preceding_project_id'
        }));
        var toTasks = JSON.parse(paramsObj.getParameter({
            name: 'custscript_preceding_task_array'
        }));
        var projectTemplateId = JSON.parse(paramsObj.getParameter({
            name: 'custscript_preceding_proj_temp_id'
        }));
        log.audit('Project Action Array', toTasks);
        log.audit('Project Action Array array length', toTasks.length);
        // search for config record here
        var configObj = configObjectValues(1);

        if (configObj.executeProceedingActions) {
            if (toTasks.length > 0) {
                for (var i = 0; i < toTasks.length; i++) {
                  var proceedingActionId = getProceedingProjectAction(projectId, toTasks[i].preceeding_package_action_id);
                  
                  if (proceedingActionId.length) {
                    log.debug('proceeding action id', proceedingActionId);
                    log.debug('projectId', projectId);
                    log.debug('toTasks[i].preceeding_package_action_id', toTasks[i].preceeding_package_action_id);
                    log.audit('projectAction internalid', toTasks[i].internalid);
                    try {
                      var rec = record.load({
                        type: 'customrecord_bb_project_action',
                        id: toTasks[i].internalid,
                        isDyanmic: false
                      });

                      rec.setValue('custrecord_bb_projact_preced_proj_action', proceedingActionId);

                      log.debug('save', rec.save({ignoreMandatoryFields: true}));
                    } catch (e) {
                        log.debug('error', e);
                    }
                  }
                }
            }
        }

    }

    function getProceedingProjectAction(projectId, actionId) {
        var actionIds = [];
        if (actionId && projectId) {
            var customrecord_bb_project_actionSearchObj = search.create({
                type: "customrecord_bb_project_action",
                filters:
                [
                    ["custrecord_bb_project","anyof", projectId], 
                    "AND", 
                    ["custrecord_bb_project_package_action","anyof", actionId.split(',')]
                ],
                columns:
                [
                    "internalid"
                ]
            });
            customrecord_bb_project_actionSearchObj.run().each(function(result){
                actionIds.push(result.getValue({name: 'internalid'}));
                return true;
            });
        }
        return actionIds;
    }

    function configObjectValues(configId) {
    	var obj = {
    		executeProceedingActions: false,
    		defaultStatus: 1
    	};
        var executeProceedingActions = false;
        if (configId) {
            var searchObj = search.lookupFields({
                type: 'customrecord_bb_solar_success_configurtn',
                id: configId,
                columns: ['custrecord_bb_config_use_preceding_actio', 'custrecord_bb_config_preceding_status_ty']
            });
            obj.executeProceedingActions = (searchObj.custrecord_bb_config_use_preceding_actio) ? searchObj.custrecord_bb_config_use_preceding_actio : false;
            obj.defaultStatus = (searchObj.custrecord_bb_config_preceding_status_ty.length > 0) ? searchObj.custrecord_bb_config_preceding_status_ty[0].value : 1
        }
        log.debug('config object values', obj);
        return obj;
    }

    function getProcedingPackageAction(preceedingPackag) {
        var procedingActionId = null;
        if (projectActionId) {
            var searchObj = search.lookupFields({
                type: 'customrecord_bb_project_action',
                id: projectActionId,
                columns: ['custrecord_bb_projact_preced_pack_action']
            });
            if (searchObj.custrecord_bb_projact_preced_pack_action.length > 0) {
                procedingActionId = searchObj.custrecord_bb_projact_preced_pack_action[0].value;
            }
        }
        return procedingActionId;
    }

    return {
        execute: execute
    };
    
});