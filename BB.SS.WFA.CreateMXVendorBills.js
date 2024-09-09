/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/runtime', 'N/search', './BB SS/SS Lib/BB.SS.VendorBill.Service'],

    function(record, runtime, search, billService) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(scriptContext) {
            var projectId = scriptContext.newRecord.id;
            var mileStoneDateFieldId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_milestone_date_id'});
            var milestoneId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_milestone_id'});
            log.debug('mileStoneDateFieldId', mileStoneDateFieldId);
            log.debug('milestone', milestoneId);
            try {
                var config = record.load({
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: 1
                });
                log.debug('projectid', projectId);

                var project = scriptContext.newRecord;
                var mxDate = project.getValue({fieldId: mileStoneDateFieldId});
                var milestoneName = convertMilestoneIdtoName(milestoneId);

                log.debug('mxDate', mxDate);
                log.debug('milestoneName', milestoneName);

                var projectObj = search.lookupFields({
                    type: search.Type.JOB,
                    id: projectId,
                    columns: ['custentity_bb_originator_vendor']
                });
                var originatorId = null;
                if (projectObj.custentity_bb_originator_vendor.length > 0) {
                    originatorId = projectObj.custentity_bb_originator_vendor[0].value;
                }

                if (mxDate && originatorId && milestoneName) {
                    log.debug('creating m0');
                    billService.createVendorBillFromProjectAndMilestoneName(project, milestoneName, config, mxDate, originatorId, null);
                }

            } catch (e) {
                log.error('error generating vendor bill', e);
            }
        }

        function convertMilestoneIdtoName(milestoneId) {
            if (milestoneId == 1) return 'm0';
            if (milestoneId == 3) return 'm1';
            if (milestoneId == 4) return 'm2';
            if (milestoneId == 5) return 'm3';
            if (milestoneId == 8) return 'm4';
            if (milestoneId == 9) return 'm5';
            if (milestoneId == 10) return 'm6';
            if (milestoneId == 11) return 'm7';
        }

        return {
            onAction : onAction
        };

    });