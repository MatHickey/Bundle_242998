/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 * @Overview - associate new checklist record to related project action
 */
define(['N/runtime', 'N/search', 'N/record'],

    function(runtime, search, record) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext) {
            try {
                var arrayValues = runtime.getCurrentScript().getParameter({name: 'custscript_bb_ss_checklist_values'});
                var parsedArray = JSON.parse(arrayValues)
                if (parsedArray.length > 0) {
                    for (var i = 0; i < parsedArray.length; i++) {
                        var projectActionId = findProjectAction(parsedArray[i].projectId, parsedArray[i].actionGroup, parsedArray[i].actionTemplate);
                        if (projectActionId) {
                            record.submitFields({
                                type: 'customrecord_bb_project_action_checklist',
                                id: parsedArray[i].checklistId,
                                values: {
                                    'custrecord_bb_pachklist_project_action': projectActionId,
                                    'custrecord_bb_pachklist_project': parsedArray[i].projectId
                                },
                                options: {
                                    ignoreMandatoryFields: true
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                log.error('error processing project action checklist record', e);
            }
        }

        function findProjectAction(projectId, actionGroup, actionTemplate) {
            var projectActionId = null;
            if (projectId && actionGroup && actionTemplate) {
                var customrecord_bb_project_actionSearchObj = search.create({
                    type: "customrecord_bb_project_action",
                    filters:
                        [
                            ["custrecord_bb_project", "anyof", projectId],
                            "AND",
                            ["custrecord_bb_package", "anyof", actionGroup],
                            "AND",
                            ["custrecord_bb_project_package_action", "is", actionTemplate],
                            "AND",
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "Internal ID"}),
                        ]
                });
                var searchResultCount = customrecord_bb_project_actionSearchObj.runPaged().count;
                log.debug("Project Action result count", searchResultCount);
                var result = customrecord_bb_project_actionSearchObj.run().getRange({start: 0, end:1});
                if (result.length > 0) {
                    projectActionId = result[0].getValue({name: 'internalid'})
                }
            }
            return projectActionId;
        }


        return {
            execute: execute
        };

    });
