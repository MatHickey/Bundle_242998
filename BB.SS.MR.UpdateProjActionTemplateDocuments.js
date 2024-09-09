/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/record', 'N/search', './BB SS/SS Lib/BB.SS.MD.Entity.Document.Template.Lib'],

function(runtime, record, search, docLib) {
   
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
        var actionArr = [];
        var projectId = runtime.getCurrentScript().getParameter({
            name: 'custscript_bb_proj_action_project'
        });
        if (projectId) {
            // run search for all project actions related to project
            var customrecord_bb_project_actionSearchObj = search.create({
                type: "customrecord_bb_project_action",
                filters:
                [
                   ["custrecord_bb_project","anyof", projectId]
                ],
                columns:
                [
                    "internalid",
                    "custrecord_bb_package",
                    "custrecord_bb_project_package_action",
                    "custrecord_bb_proj_act_temp_doc_rec",
                    "custrecord_bb_proj_doc_required_optional",
                    "custrecord_bb_project"
                ]
            });
            var searchResultCount = customrecord_bb_project_actionSearchObj.runPaged().count;
            log.debug("customrecord_bb_project_actionSearchObj result count",searchResultCount);
            customrecord_bb_project_actionSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var obj = {};
                obj['internalid'] = result.getValue({name: 'internalid'});
                obj['custrecord_bb_package'] = result.getValue({name: 'custrecord_bb_package'});
                obj['custrecord_bb_project_package_action'] = result.getValue({name: 'custrecord_bb_project_package_action'});
                obj['custrecord_bb_proj_act_temp_doc_rec'] = result.getValue({name: 'custrecord_bb_proj_act_temp_doc_rec'});
                obj['custrecord_bb_proj_doc_required_optional'] = result.getValue({name: 'custrecord_bb_proj_doc_required_optional'});
                obj['custrecord_bb_project'] = result.getValue({name: 'custrecord_bb_project'});
                actionArr.push(obj);
                return true;
            });
        }
        if (actionArr.length > 0) {
            return actionArr;
        }
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        var obj = JSON.parse(context.value);
        log.audit('map stage object', obj);
        try {
            var entityActions = docLib.getAllActionRecords();
            // log.audit('entityActions', entityActions);

            //get project data, ahj, utilty, hoa, state and financier ids
            var projectObj = docLib.getProjectDocumentTemplateRelatedData(obj.custrecord_bb_project);
            // log.audit('projectObj', projectObj);
            var projectAction = record.load({
                type: 'customrecord_bb_project_action',
                id: obj.internalid,
                isDynamic: true
            });
            log.audit('obj.custrecord_bb_project_package_action', obj.custrecord_bb_project_package_action);
            log.audit('entityActions.hoaActions', entityActions.hoaActions);
            log.audit('hoa filtered array', getHOAMatchingData(entityActions.hoaActions, obj.custrecord_bb_project_package_action));

            /**
            * Check entity actions for document template record, loop over all entity action records
            *if ((package action id = action record package action id) && projectObj.action type == action record.type) see example below
            *example projectObj.finacier (financier from project) = action record (finanicer on action record)
            *if the action record is required is true, and action record has document template - replace project action document template with one from action record
            *if the action record is required is false and project action record already has document template, leave project action document in place
            */

            // check ahj action records for matching data
            if (docLib.getAHJMatchingData(entityActions.ahjActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data) {return data.custrecord_bb_ahj_record}).indexOf(projectObj.projectAHJ) != -1) {
                var ahjIndex = docLib.getAHJMatchingData(entityActions.ahjActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data) {return data.custrecord_bb_ahj_record}).indexOf(projectObj.projectAHJ);
                log.audit('ahj index', ahjIndex);

                var ahjObj = docLib.getAHJMatchingData(entityActions.ahjActions, parseInt(obj.custrecord_bb_project_package_action))[ahjIndex];
                if (ahjObj.custrecord_bb_ahj_record == projectObj.projectAHJ) {
                    // check if action is required or optional
                    if (ahjObj.custrecord_bb_ahj_req_optional_list == 1) {// required document
                        if (ahjObj.custrecord_bb_ahj_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: ahjObj.custrecord_bb_ahj_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_doc_required_optional',
                                value: 1
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'AJH'
                            });

                        }
                    } else { // action is optional
                        if (!obj.custrecord_bb_proj_act_temp_doc_rec && ahjObj.custrecord_bb_ahj_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: ahjObj.custrecord_bb_ahj_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'AJH'
                            });
                        }
                    }
                }

            } else if (docLib.getUtilMatchingData(entityActions.utilActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data){ return data.custrecord_bb_utility_record}).indexOf(projectObj.projectUtility) != -1) {
                // check utility action records for matching data
                var utilIndex = docLib.getUtilMatchingData(entityActions.utilActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data){ return data.custrecord_bb_utility_record}).indexOf(projectObj.projectUtility);
                log.audit('utilIndex', utilIndex);
                var utilObj = docLib.getUtilMatchingData(entityActions.utilActions, parseInt(obj.custrecord_bb_project_package_action))[utilIndex];
                if (utilObj.custrecord_bb_utility_record == projectObj.projectUtility) {
                    // check if action is required or optional
                    if (utilObj.custrecord_bb_utility_req_optional_list == 1) {// required document
                        if (utilObj.custrecord_bb_utility_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: utilObj.custrecord_bb_utility_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_doc_required_optional',
                                value: 1
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'Utility'
                            });
                        }
                    } else { // action is optional
                        if (!obj.custrecord_bb_proj_act_temp_doc_rec && utilObj.custrecord_bb_utility_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: utilObj.custrecord_bb_utility_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'Utility'
                            });
                        }
                    }
                }

            } else if (docLib.getHOAMatchingData(entityActions.hoaActions, obj.custrecord_bb_project_package_action).map(function(data) {return data.custrecord_bb_hoa_record}).indexOf(parseInt(projectObj.projectHOA)) != -1) {
                // check hoa action records for matching data
                var hoaIndex = docLib.getHOAMatchingData(entityActions.hoaActions, obj.custrecord_bb_project_package_action).map(function(data) {return data.custrecord_bb_hoa_record}).indexOf(parseInt(projectObj.projectHOA));
                log.audit('hoaIndex', hoaIndex);
                var hoaObj = docLib.getHOAMatchingData(entityActions.hoaActions, obj.custrecord_bb_project_package_action)[hoaIndex];
                if (hoaObj.custrecord_bb_hoa_record == projectObj.projectHOA) {
                    // check if action is required or optional
                    if (hoaObj.custrecord_bb_hoa_req_optional_list == 1) {// required document
                        if (hoaObj.custrecord_bb_hoa_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: hoaObj.custrecord_bb_hoa_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_doc_required_optional',
                                value: 1
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'Homeowners Association'
                            });
                        } 
                    } else { // action is optional
                        if (!obj.custrecord_bb_proj_act_temp_doc_rec && hoaObj.custrecord_bb_hoa_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: hoaObj.custrecord_bb_hoa_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'Homeowners Association'
                            });
                        }
                    }
                }

            } else if (docLib.getStateMatchingData(entityActions.stateActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data) {return data.custrecord_bb_state_record}).indexOf(projectObj.projectState) != -1) {
                // check state action records for matching data
                var stateIndex = docLib.getStateMatchingData(entityActions.stateActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data) {return data.custrecord_bb_state_record}).indexOf(projectObj.projectState);
                log.audit('stateIndex', stateIndex);
                var stateObj = docLib.getStateMatchingData(entityActions.stateActions, parseInt(obj.custrecord_bb_project_package_action))[stateIndex];
                if (stateObj.custrecord_bb_state_record == projectObj.projectState) {
                    // check if action is required or optional
                    if (stateObj.custrecord_bb_state_req_optional_list == 1) {// required document
                        if (stateObj.custrecord_bb_state_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: stateObj.custrecord_bb_state_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_doc_required_optional',
                                value: 1
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'State'
                            });
                        }
                    } else { // action is optional
                        if (!obj.custrecord_bb_proj_act_temp_doc_rec && stateObj.custrecord_bb_state_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: stateObj.custrecord_bb_state_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'State'
                            });
                        }
                    }

                }

            } else if (docLib.getFinMatchingData(entityActions.finActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data) { return data.custrecord_bb_financier_record}).indexOf(projectObj.projectFinancier) != -1) {
                // check financier action records for matching data
                var finIndex = docLib.getFinMatchingData(entityActions.finActions, parseInt(obj.custrecord_bb_project_package_action)).map(function(data) { return data.custrecord_bb_financier_record}).indexOf(projectObj.projectFinancier);
                log.audit('finIndex', finIndex);
                var finObj = docLib.getFinMatchingData(entityActions.finActions, parseInt(obj.custrecord_bb_project_package_action))[finIndex];
                if (finObj.custrecord_bb_financier_record == projectObj.projectFinancier) {
                    // check if action is required or optional
                    if (finObj.custrecord_bb_fin_req_optional_list == 1) {// required document
                        if (finObj.custrecord_bb_fin_doc_template) {
                            //set document
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: finObj.custrecord_bb_fin_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_doc_required_optional',
                                value: 1
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'Financier'
                            });
                        }
                    } else { // action is optional
                        if (!obj.custrecord_bb_proj_act_temp_doc_rec && finObj.custrecord_bb_fin_doc_template) {
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_temp_doc_rec',
                                value: finObj.custrecord_bb_fin_doc_template
                            });
                            projectAction.setValue({
                                fieldId: 'custrecord_bb_proj_act_from_action_rec',
                                value: 'Financier'
                            });
                        }
                    }
                }
            } else {
                //do nothing
            }

            projectAction.save({
                ignoreMandatoryFields: true,
                disableTriggers: true
            });


        } catch (e) {
            log.error('error', e);
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

    function getAHJMatchingData(array, packageAction) {
        var filterArr = array.filter(function(data) {
            return data.custrecord_bb_ahj_package_action == packageAction;
        });
        return filterArr;
    }

        function getUtilMatchingData(array, packageAction) {
        var filterArr = array.filter(function(data) {
            return data.custrecord_bb_utility_package_action == packageAction;
        });
        return filterArr;
    }

    function getHOAMatchingData(array, packageAction) {
        var filterArr = array.filter(function(data) {
            return data.custrecord_bb_hoa_package_action == packageAction;
        });
        return filterArr;
    }
    function getStateMatchingData(array, packageAction) {
        var filterArr = array.filter(function(data) {
            return data.custrecord_bb_state_package_action == packageAction;
        });
        return filterArr;
    }
    function getFinMatchingData(array, packageAction) {
        var filterArr = array.filter(function(data) {
            return data.custrecord_bb_fin_package_action == packageAction;
        });
        return filterArr;
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});
