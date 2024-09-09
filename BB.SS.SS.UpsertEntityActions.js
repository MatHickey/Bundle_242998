/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/record', 'N/runtime', './BB SS/SS Lib/BB.SS.MD.Entity.Document.Template.Lib'],

function(search, record, runtime, docLib) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
        var projectId = runtime.getCurrentScript().getParameter({
            name: 'custscript_bb_proj_action_project_id'
        });
        try {
            var projectActionArray = docLib.getProjectActionRecords(projectId);
            var entityObj = docLib.getProjectDocumentTemplateRelatedData(projectId);
            var entityActions = docLib.getActionRecords(entityObj.projectAHJ, entityObj.projectUtility, entityObj.projectHOA, entityObj.projectState, entityObj.projectFinancier);
            docLib.upsertProjectActions(entityActions, projectActionArray, projectId);
        } catch (e) {
            log.error('error', e);
        }

    }

    return {
        execute: execute
    };
    
});
