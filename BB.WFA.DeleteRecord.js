/**
 *@NApiVersion 2.x
 *@NScriptType WorkflowActionScript
 */
define(['N/record', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'], function (record, batchProcessor) {

    function onAction(scriptContext) {
        log.debug('context', scriptContext)
        // var salesOrder = record.load({
        //     type: record.Type.SALES_ORDER,
        //     id: scriptContext.newRecord.id,
        //     isDynamic: true
        // });
        var taskParameters = {};
        taskParameters['custscript_savedsearch_id'] = transactionObj.transactionArr;
        var scriptId = 'customscript_savedsearch_delete_records';
        var deploymentId = 'customdeploy_savedsearch_delete_records';
        var taskType = task.TaskType.SCHEDULED_SCRIPT;
        //batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
    }

    return {
        onAction: onAction
    }
});
