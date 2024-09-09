/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/runtime', 'N/record'], function (search, runtime, record) {

    /**
     * Function calls the search which has records to be loaded.
     * @returns {[]}
     */
    function getInputData() {
        var currentScript = runtime.getCurrentScript();
        var searchToLoad = currentScript.getParameter('custscript_bb_ss_search_to_load');
        if(searchToLoad){
            var searchObj = search.load(searchToLoad);
            return searchObj;
        }else{
            return [];
        }

    }


    /**
     * Functions gets the record type and loads and save the records.
     * @param context
     */
    function map(context) {
        log.debug('context',context);
        var recordsToLoad = JSON.parse(context.value);
        context.recType=recordsToLoad.recordType
        context.write({
            key: recordsToLoad.id,
            value: recordsToLoad.recordType,
        });
    }

    /**
     * Functions gets the record type and loads and save the records.
     * @param context
     */
    function reduce(context) {
        log.debug('context',context);
        var recordObj = record.load({
            type: context.values[0],
            id: context.key,
            isDynamic: true,
        });
        recordObj.save();
    }


    /**
     * Function logs if any error happened in Map phase
     * @param context
     */
    function summarize(context) {

        context.mapSummary.errors.iterator().each(
            function (key, error) {
                log.error({
                    title: 'Map error for key: ' + key,
                    details: error
                });
                return true;
            }
        );
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce:reduce,
        summarize: summarize
    };
});