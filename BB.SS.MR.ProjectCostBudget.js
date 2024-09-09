/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @author Richard Tuttle
 * @overview - Map Reduce script to process cost budget updates
 */
define(['N/runtime', 'N/record', 'N/search', './BB SS/SS Lib/BB.SS.MD.ProjectCost'],

function(runtime, record, search, projectCost) {
   

    function getInputData() {
        var projectId = runtime.getCurrentScript().getParameter({
            name: 'custscript_bb_project_id'
        });
        var expenseType = runtime.getCurrentScript().getParameter({
            name: 'custscript_bb_expense_type'
        });
        log.debug('projectId',projectId);
        log.debug('expenseType',expenseType);


        return [{
            projectId: projectId,
            expenseType: expenseType
        }];
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        var obj = JSON.parse(context.value);
        log.debug('context object in map', obj);
        projectCost.processCostBudget(obj.projectId, obj.expenseType);
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {

    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {

    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});