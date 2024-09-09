/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/runtime'],

function(record, search, runtime) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @Since 2016.1
     */
    function onAction(scriptContext) {
        var fieldPath = runtime.getCurrentScript().getParameter({name: 'custscript_bb_field_path'});
        var setToField = runtime.getCurrentScript().getParameter({name: 'custscript_bb_set_to_field'});
        var recordTypeLookup = runtime.getCurrentScript().getParameter({name: 'custscript_bb_record_type'});
        var projectAction = scriptContext.newRecord;
        var projectId = projectAction.getValue({fieldId: 'custrecord_bb_project'});
        var lookupValue1;
        var lookupValue2;
        try {
            if (fieldPath && projectId) {
                if (fieldPath.indexOf('.') != -1) {
                    var fieldPathArray = fieldPath.split('.');
                    var lookupFieldId1 = String(fieldPathArray[0]);
                    var lookupFieldId2 = String(fieldPathArray[1]);

                    var projectLookup = search.lookupFields({
                        type: search.Type.JOB,
                        id: projectId,
                        columns: [lookupFieldId1]
                    });
                    log.debug('does value contain and array', projectLookup[lookupFieldId1] instanceof Array);
                    if (projectLookup[lookupFieldId1].length > 0) { //custentity_bb_auth_having_jurisdiction
                        lookupValue1 = projectLookup[lookupFieldId1][0].value;
                        log.debug('lookupValue1', lookupValue1);

                        if (lookupValue1) {
                            var recordTypeLookup = search.lookupFields({
                                type: recordTypeLookup,
                                id: lookupValue1,
                                columns: [lookupFieldId2]
                            });
                            log.debug('recordTypeLookup', recordTypeLookup);
                            if (recordTypeLookup[lookupFieldId2].length > 0) {
                                lookupValue2 = recordTypeLookup[lookupFieldId2][0].value;

                                projectAction.setValue({
                                    fieldId: setToField,
                                    value: lookupValue2
                                });
                            }
                        }
                    }

                } else {
                    // field does not contain a multi join field
                }
                

            }
        } catch (e) {
            log.error('error submitting fields', e);
        }
    }


    return {
        onAction : onAction
    };
    
});
