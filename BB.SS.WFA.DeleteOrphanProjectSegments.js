/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Project Segment - Delete Orphaned project segment
 */
define(['N/record'],

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
            var projectSegment = scriptContext.newRecord;
            log.debug('segment id to delete', projectSegment.id)
            record.delete({
                type: projectSegment.type,
                id: projectSegment.id,
            })
            log.debug('segment successfully delete')
        }


        return {
            onAction : onAction
        };

    });
