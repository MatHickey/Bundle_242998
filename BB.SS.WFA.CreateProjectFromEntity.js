/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 */
define(['N/runtime', './BB SS/SS Lib/BB.SS.MD.LeadToProject'],

function(runtime, leadToProject) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @Since 2016.1
     */
    function onAction(scriptContext) {
        var entity = scriptContext.newRecord;
        var recordType = scriptContext.newRecord.type;
        var entityId = entity.id;

        var id = leadToProject.transformEntityToProject(entityId);
        leadToProject.addCustomerProjectAddersToProject(entityId, id);
        
        return id;
    }  


    return {
        onAction : onAction
    };
    
});
