/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/runtime', 'N/record', 'N/search', 'N/query'], function (runtime, record, search, query) {
    /**
     * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
     * @param {Object} inputContext
     * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {Object} inputContext.ObjectRef - Object that references the input data
     * @typedef {Object} ObjectRef
     * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
     * @property {string} ObjectRef.type - Type of the record instance that contains the input data
     * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
     * @since 2015.2
     */
    const getInputData = () => {
        var array = [];
        var searchId = runtime.getCurrentScript().getParameter({ name: 'custscript_bb_checklist_search' });
        if (searchId) {
            var projectSearch = search.load({
                id: searchId
            });
            projectSearch.run().each(function (result) {
                array.push(result.getValue({ name: 'internalid' }));
                return true;
            });
        }
        return array;
    };

    /**
     * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
     * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
     * context.
     * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
     *     is provided automatically based on the results of the getInputData stage.
     * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
     *     function on the current key-value pair
     * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
     *     pair
     * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} mapContext.key - Key to be processed during the map stage
     * @param {string} mapContext.value - Value to be processed during the map stage
     * @since 2015.2
     */
    const map = (mapContext) => {
        log.debug({
            title: `${mapContext.key} START MAP`,
            details: `${mapContext.value}`
        });
        let projectId = JSON.parse(mapContext.value);
        let projectActionsResults = getProjectActions(projectId);
        let actionGroupArray = projectActionsResults
            .map((res) => res.actionGroup)
            .filter((v, i, a) => a.indexOf(v) == i); //filter unique actionGroup internal ids
        let actionTemplateArray = projectActionsResults
            .map((res) => res.actionTemplate)
            .filter((v, i, a) => a.indexOf(v) == i); //filter unique actionTemplate internal ids
        if (actionTemplateArray.length <= 0) {
            return;
        }
        let actionTemplateChecklistResults = getActionTemplateChecklists(actionTemplateArray, actionGroupArray);
        if (actionTemplateChecklistResults <= 0) {
            return;
        }
        let projectActionChecklistResults = getProjectActionChecklists(
            projectId,
            actionTemplateArray,
            actionGroupArray
        ); //if this return an empty array, it means that all Project Action Checklists are missing in the Project

        actionTemplateChecklistResults.forEach((actionTemplateChecklist) => {
            let found = projectActionChecklistResults.find((projectActionChecklist) => {
                return (
                    projectActionChecklist.actionGroup == actionTemplateChecklist.actionGroup &&
                    projectActionChecklist.actionTemplate == actionTemplateChecklist.actionTemplate &&
                    projectActionChecklist.title == actionTemplateChecklist.name
                );
            });
            if (isEmpty(found)) {
                //missing Project Action Checklist, needs to be created
                let foundProjectAction = projectActionsResults.find((projectAction) => {
                    return (
                        projectAction.actionGroup == actionTemplateChecklist.actionGroup &&
                        projectAction.actionTemplate == actionTemplateChecklist.actionTemplate
                    );
                });
                if (isEmpty(foundProjectAction)) {
                    //Project Action is not found in the data, premature exit
                    return;
                }
                let fieldValueMap = {
                    custrecord_bb_pachklist_title: actionTemplateChecklist.name,
                    custrecord_bb_pachklist_project: projectId,
                    custrecord_bb_pachklist_project_action: foundProjectAction.internalid,
                    custrecord_bb_pachklist_action_group: actionTemplateChecklist.actionGroup,
                    custrecord_bb_pachklist_action_template: actionTemplateChecklist.actionTemplate,
                    custrecord_bb_pachklist_act_template: actionTemplateChecklist.internalid
                };
                mapContext.write({
                    key: `${projectId}_${foundProjectAction.internalid}_${actionTemplateChecklist.actionGroup}_${actionTemplateChecklist.actionTemplate}`,
                    value: fieldValueMap
                });
            } else {
                log.debug({
                    title: `${projectId} Project Action Checklist Exists`,
                    details: {
                        message: 'Project Action Checklist Exist for this Project with the following parameters',
                        actionTemplateChecklist
                    }
                });
            }
        });
        log.debug({
            title: `${mapContext.key} END MAP`,
            details: `${mapContext.value}`
        });
    };

    /**
     * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
     * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
     * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
     *     provided automatically based on the results of the map stage.
     * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
     *     reduce function on the current group
     * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
     * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} reduceContext.key - Key to be processed during the reduce stage
     * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
     *     for processing
     * @since 2015.2
     */
    const reduce = (reduceContext) => {
        log.debug({
            title: `${reduceContext.key} START REDUCE`,
            details: `${reduceContext.values}`
        });

        let {values} = reduceContext;

        values.forEach((fieldMapValue) => {
            try {
                fieldMapValue = JSON.parse(fieldMapValue);
                // try-catch has to enclose only the code that does the record.create not the loop
                let _rec = record.create({
                    type: 'customrecord_bb_project_action_checklist',
                    isDynamic: true
                });
                for (let fieldId in fieldMapValue) {
                    _rec.setValue({
                        fieldId,
                        value: fieldMapValue[fieldId]
                    });
                }
                let id = _rec.save({
                    ignoreMandatoryFields: true
                });
                log.audit({
                    title: `${reduceContext.key} SUCCESS`,
                    details: `customrecord_bb_project_action_checklist:${id}`
                });
            } catch (e) {
                log.error({
                    title: `${reduceContext.key} REDUCE ERROR PROJECT ACTION CHECKLIST CREATE`,
                    details: {
                        fieldMapValue,
                        e
                    }
                });
            }
        });
        log.debug({
            title: `${reduceContext.key} END REDUCE`,
            details: '+++++'
        });
    };

    /**
     * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
     * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
     * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
     * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
     *     script
     * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
     * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
     * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
     * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
     *     script
     * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
     * @param {Object} summaryContext.inputSummary - Statistics about the input stage
     * @param {Object} summaryContext.mapSummary - Statistics about the map stage
     * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
     * @since 2015.2
     */
    const summarize = (summaryContext) => {
        summaryContext.mapSummary.errors.iterator().each((key, error, executionNo) => {
            log.error({
                title: `${key} MAP ERROR`,
                details: error
            });
            return true;
        });
        summaryContext.reduceSummary.errors.iterator().each((key, error, executionNo) => {
            log.error({
                title: `${key} REDUCE ERROR`,
                details: error
            });
            return true;
        });
    };

    /**
     * Retrieve the Project Actions within the Project record
     * @param {number} projectId internal id of the Project Record
     * @returns {Object[]}
     */
    const getProjectActions = (projectId) => {
        if (isEmpty(projectId)) {
            return [];
        }
        let projectActionsQuery = query.create({
            type: 'customrecord_bb_project_action'
        });
        projectActionsQuery.condition = projectActionsQuery.and(
            projectActionsQuery.createCondition({
                fieldId: 'custrecord_bb_project',
                operator: query.Operator.ANY_OF,
                values: projectId
            }),
            projectActionsQuery.createCondition({
                fieldId: 'isinactive',
                operator: query.Operator.IS,
                values: false
            })
        );
        projectActionsQuery.columns = [
            projectActionsQuery.createColumn({
                fieldId: 'id',
                alias: 'internalid',
                label: 'Project Action Internal Id'
            }),
            projectActionsQuery.createColumn({
                fieldId: 'custrecord_bb_project',
                alias: 'projectId',
                label: 'Project Internal Id'
            }),
            projectActionsQuery.createColumn({
                fieldId: 'custrecord_bb_package',
                alias: 'actionGroup',
                label: 'Action Group' //label is not used in script but this is the label in the UI
            }),
            projectActionsQuery.createColumn({
                fieldId: 'custrecord_bb_project_package_action',
                alias: 'actionTemplate',
                label: 'Action Template'
            })
        ];
        return projectActionsQuery.run().asMappedResults();
    };

    /**
     * Retrieves Action Template Checklist.
     * @param {array} actionTemplateArray internal ids of Action Template
     * @param {array} actionGroupArray internal ids of Action Group
     * @returns {Object[]}
     */
    const getActionTemplateChecklists = (actionTemplateArray, actionGroupArray) => {
        if (isEmpty(actionTemplateArray) && isEmpty(actionGroupArray)) {
            return [];
        }
        let actionTemplateChecklistQuery = query.create({
            type: 'customrecord_bb_atchklist'
        });
        actionTemplateChecklistQuery.condition = actionTemplateChecklistQuery.and(
            actionTemplateChecklistQuery.or(
                actionTemplateChecklistQuery.createCondition({
                    fieldId: 'custrecord_bb_atchklist_action_template',
                    operator: query.Operator.ANY_OF,
                    values: actionTemplateArray
                }),
                actionTemplateChecklistQuery.createCondition({
                    fieldId: 'custrecord_bb_atchklist_action_group',
                    operator: query.Operator.ANY_OF,
                    values: actionGroupArray
                })
            ),
            actionTemplateChecklistQuery.createCondition({
                fieldId: 'isinactive',
                operator: query.Operator.IS,
                values: false
            })
        );
        actionTemplateChecklistQuery.columns = [
            actionTemplateChecklistQuery.createColumn({
                fieldId: 'id',
                alias: 'internalid',
                label: 'Internal Id'
            }),
            actionTemplateChecklistQuery.createColumn({
                fieldId: 'name',
                alias: 'name',
                label: 'Name'
            }),
            actionTemplateChecklistQuery.createColumn({
                fieldId: 'custrecord_bb_atchklist_action_group',
                alias: 'actionGroup',
                label: 'Action Group'
            }),
            actionTemplateChecklistQuery.createColumn({
                fieldId: 'custrecord_bb_atchklist_action_template',
                alias: 'actionTemplate',
                label: 'Action Template'
            })
        ];
        actionTemplateChecklistQuery.sort = [
            actionTemplateChecklistQuery.createSort({
                column: actionTemplateChecklistQuery.columns[1],
                ascending: true
            })
        ];
        return actionTemplateChecklistQuery.run().asMappedResults();
    };

    /**
     * Retrieve the Project Action Checklists associated to Project
     * @param {number} projectId internal id of the Project record
     * @param {array} actionTemplateArray internal ids of Action Template
     * @param {array} actionGroupArray internal ids of Action Group
     * @returns {Object[]}
     */
    const getProjectActionChecklists = (projectId, actionTemplateArray, actionGroupArray) => {
        if (isEmpty(projectId) && isEmpty(actionTemplateArray) && isEmpty(actionGroupArray)) {
            return [];
        }
        let projectActionChecklistQuery = query.create({
            type: 'customrecord_bb_project_action_checklist'
        });
        projectActionChecklistQuery.condition = projectActionChecklistQuery.and(
            projectActionChecklistQuery.createCondition({
                fieldId: 'custrecord_bb_pachklist_project',
                operator: query.Operator.ANY_OF,
                values: projectId
            }),
            projectActionChecklistQuery.or(
                projectActionChecklistQuery.createCondition({
                    fieldId: 'custrecord_bb_pachklist_action_group',
                    operator: query.Operator.ANY_OF,
                    values: actionGroupArray
                }),
                projectActionChecklistQuery.createCondition({
                    fieldId: 'custrecord_bb_pachklist_action_template',
                    operator: query.Operator.ANY_OF,
                    values: actionTemplateArray
                })
            ),
            projectActionChecklistQuery.createCondition({
                fieldId: 'isinactive',
                operator: query.Operator.IS,
                values: false
            })
        );
        projectActionChecklistQuery.columns = [
            projectActionChecklistQuery.createColumn({
                fieldId: 'id',
                alias: 'internalid',
                label: 'Internal Id'
            }),
            projectActionChecklistQuery.createColumn({
                fieldId: 'custrecord_bb_pachklist_action_group',
                alias: 'actionGroup',
                label: 'Action Group'
            }),
            projectActionChecklistQuery.createColumn({
                fieldId: 'custrecord_bb_pachklist_action_template',
                alias: 'actionTemplate',
                label: 'Action Template'
            }),
            projectActionChecklistQuery.createColumn({
                fieldId: 'custrecord_bb_pachklist_title',
                alias: 'title',
                label: 'Title'
            })
        ];
        return projectActionChecklistQuery.run().asMappedResults();
    };

    const isEmpty = (stValue) => {
        return (
            stValue === '' ||
            stValue == null ||
            stValue == undefined ||
            (stValue.constructor === Array && stValue.length == 0) ||
            (stValue.constructor === Object &&
                (function (v) {
                    for (let k in v) return false;
                    return true;
                })(stValue))
        );
    };

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
