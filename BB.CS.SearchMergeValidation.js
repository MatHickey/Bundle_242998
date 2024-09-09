/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(['N/currentRecord', 'N/url', 'N/runtime'],

    function(currentRecord, NSurl, runtime) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {

        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            var currRecord = currentRecord.get();
            console.log('current record', currRecord);

            var periodLookup = location.search;
            var searchParam = new URLSearchParams(periodLookup);
            var currentPeriod = searchParam.get('currentAccountingPeriod');

            var period = currRecord.getValue({
                fieldId: 'custpage_as_of_period'
            });

            var projectStatus = currRecord.getValue({
                fieldId: 'custpage_project_status'
            });

            var field = scriptContext.fieldId;
            console.log('field Id', field);

            var scriptId = currRecord.getValue({
                fieldId: 'custpage_script_internalid'
            });
            var deploymentId = currRecord.getValue({
                fieldId: 'custpage_script_deploymentid'
            });

            if (field == 'custpage_as_of_period'&& scriptId && deploymentId) {
                if (currentPeriod != period) {
                    var suiteletlink = NSurl.resolveScript({
                        scriptId: scriptId,
                        deploymentId: deploymentId,
                        params: {
                            'currentAccountingPeriod': period,
                            'projectStatus': projectStatus
                        }
                    });
                    window.open(suiteletlink , '_self', false);
                    return true;
                }
            }

            return true;
        }


        function viewProjectStatus() {
            var currRecord = currentRecord.get();
            console.log('current record', currRecord);
            var period = currRecord.getValue({
                fieldId: 'custpage_as_of_period'
            });
            var projectStatus = currRecord.getValue({
                fieldId: 'custpage_project_status'
            });
            var scriptId = currRecord.getValue({
                fieldId: 'custpage_script_internalid'
            });
            var deploymentId = currRecord.getValue({
                fieldId: 'custpage_script_deploymentid'
            });
            console.log('project status', projectStatus);
            var urlSafeStatuses = projectStatus.toString();

            var suiteletlink = NSurl.resolveScript({
                scriptId: scriptId,
                deploymentId: deploymentId,
                params: {
                    'currentAccountingPeriod': period,
                    'projectStatus': urlSafeStatuses
                }
            });
            window.open(suiteletlink , '_self', false);



        }



        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            viewProjectStatus: viewProjectStatus
        };

    });
