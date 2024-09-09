/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/runtime', 'N/record', 'N/search',  './BB SS/SS Lib/BB.SS.MD.Entity.Document.Template.Lib', './BB SS/SS Lib/BB.SS.MD.LeadToProject'],
    function(runtime, record, search, docLib, leadToProject) {
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
        function getInputData() {
            var processArray = [];
            var searchId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_missing_preceding_acts'});
            if (searchId) {
                var precedingActionSearch = search.load({
                    id: searchId
                });
                precedingActionSearch.run().each(function(result) {
                    processArray.push({
                        projectId: result.getValue(precedingActionSearch.columns[0]),
                        templateId: result.getValue(precedingActionSearch.columns[1])
                    });
                    return true;
                })
            }
            log.audit('process array results', processArray);
            return processArray;
        }
        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        function map(context) {
            var obj = JSON.parse(context.value);
            log.debug('Map Stage object', obj);
            var projectId = obj.projectId;
            var template = obj.templateId;
            var toTasks = leadToProject.getTemplateRelatedProjectActions(projectId);
            var templateTasks = leadToProject.getTemplateRelatedProjectActions(template);
            var entityObj = docLib.getProjectDocumentTemplateRelatedData(projectId);
            var entityActions = docLib.getActionRecords(entityObj.projectAHJ, entityObj.projectUtility, entityObj.projectHOA, entityObj.projectState, entityObj.projectFinancier);
            toTasks = docLib.upsertProjectActions(entityActions, toTasks, projectId);
            var configObj = configObjectValues(1);
            if (configObj.executeProceedingActions) {
                if (toTasks.length > 0) {
                    for (var i = 0; i < toTasks.length; i++) {
                        var values = {};
                        var templateObj = null;
                        var newPrecedingAction = null;
                        var packageAction = toTasks[i].packageAction;
                        var index = templateTasks.map(function(data) {return data.packageAction}).indexOf(packageAction);
                        log.debug('index value found', index)
                        if (index != -1) {
                            templateObj = templateTasks[index];
                        }
                        if (toTasks[i].preceeding_package_action_id) {
                            newPrecedingAction = toTasks[i].preceeding_package_action_id;
                        } else if (templateObj) {
                            newPrecedingAction = templateObj.preceeding_package_action_id_from_package_action;
                            values['custrecord_bb_projact_preced_pack_action'] = templateObj.preceeding_package_action_id_from_package_action;
                        }
                        log.debug('new preceding package action value', newPrecedingAction);
                        var proceedingActionId = getProceedingProjectAction(projectId, newPrecedingAction);
                        log.debug('proceeding action id', proceedingActionId);
                        if (proceedingActionId) {
                            values['custrecord_bb_projact_preced_proj_action'] = proceedingActionId;
                            log.audit('projectAction internalid', toTasks[i].internalid);
                            try {
                                record.submitFields({
                                    type: 'customrecord_bb_project_action',
                                    id: toTasks[i].internalid,
                                    values: values,
                                    options: {
                                        ignoreMandatoryFields: true,
                                        disableTriggers:true
                                    }
                                });
                            } catch (e) {
                                log.error('error', e);
                            }
                        }
                    }
                }
            }
        }
        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context) {
        }
        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary) {
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

        function getProceedingProjectAction(projectId, actionId) {
            var projectActionId = null;
            if (actionId && projectId) {
                var customrecord_bb_project_actionSearchObj = search.create({
                    type: "customrecord_bb_project_action",
                    filters:
                        [
                            ["custrecord_bb_project","anyof", projectId],
                            "AND",
                            ["custrecord_bb_project_package_action","anyof", actionId]
                        ],
                    columns:
                        [
                            "internalid"
                        ]
                });
                customrecord_bb_project_actionSearchObj.run().each(function(result){
                    projectActionId = result.getValue({name: 'internalid'});
                    return true;
                });
            }
            return projectActionId;
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });