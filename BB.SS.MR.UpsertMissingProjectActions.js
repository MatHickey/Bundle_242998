/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/record', 'N/runtime' ,'N/search', './BB SS/SS Lib/BB.SS.MD.LeadToProject'], function(record, runtime, search, leadToProjectLib) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() { 
        var searchId = runtime.getCurrentScript().getParameter({
            name: 'custscript_bb_missing_act_srch_id'
        });
        var projectsArr = [];
        if (searchId) {
            var projectData = search.load({
                id: searchId
            });
            var page = projectData.runPaged();
            page.pageRanges.forEach(function(pageRange) {

                var pageResults = page.fetch(pageRange);
                pageResults.data.forEach(function(result) {

                    var project = result.getValue({name: 'internalid', summary: 'GROUP'});
                    var templateId = result.getValue({name: 'custentity_bb_started_from_proj_template', summary: 'GROUP'});
                    var entityId = result.getValue({name: 'custentity_bb_homeowner_customer', summary: 'GROUP'});

                    projectsArr.push({
                        projectId: project,
                        templateId: templateId,
                        entityId: entityId,
                        proposal: null
                    });

                });
                
            });
        }
        log.debug('Enterning Map Stage', 'Enterning Map Stage');
        log.debug('Projects Missing Actions Array', projectsArr);
        return projectsArr;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        var projects = JSON.parse(context.value);
        log.debug('project object array in map stage', projects);

        var projectId = projects.projectId;
        var templateId = projects.templateId;
        var entityId = projects.entityId;
        var proposal = projects.proposal;

        log.debug('project id', projectId);
        log.debug('project Template', templateId);
        log.debug('entity id', entityId);
        log.debug('proposal id', proposal);
        var project = {
            internalId: projectId
        };
        if (templateId) {
            var tasks = leadToProjectLib.getTemplateRelatedProjectActions(templateId);
            log.debug('project action tasks', tasks);
            log.debug('project action tasks count', tasks.length);
            var existingActions = leadToProjectLib.getTemplateRelatedProjectActions(projectId);

            leadToProjectLib.createMissingProjectActions(tasks, existingActions, projectId, null, null);
        }


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