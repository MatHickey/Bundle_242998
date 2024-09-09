/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 */
define(['N/runtime', 'N/record'],

function(runtime, record) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @Since 2016.1
     */
    function onAction(scriptContext) {
        try {
            var projectAction = scriptContext.newRecord;
            var projectId = scriptContext.newRecord.getValue({fieldId: 'custrecord_bb_project'});
            log.debug('projectId', projectId);

            var dateFieldId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_date_fieldid_param'});
            var dateFieldValue =runtime.getCurrentScript().getParameter({name: 'custscript_bb_date_value_param'});

            log.debug('dateFieldId', dateFieldId);
            log.debug('dateFieldValue', dateFieldValue);

            if (dateFieldId && dateFieldValue && projectId) {
                // record.submitFields({
                //     type: record.Type.JOB,
                //     id: projectId,
                //     values: {
                //         dateFieldId: dateFieldValue
                //     },
                //     options: {
                //         ignoreMandatoryFields: true,
                //         disableTriggers: true
                //     }
                // });
                var project = record.load({
                    type: record.Type.JOB,
                    id: projectId,
                    isDynamic: true
                })

                project.setValue({
                    fieldId: dateFieldId,
                    value: dateFieldValue
                });

                project.save({
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });
                return scriptContext.newRecord.id;
            }
        } catch (e) {
            log.error('error updating project from project action', e);
        }
    }

    return {
        onAction : onAction
    };
    
});