/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @author Andres Molina
 */

define(['N/search', 'N/record', 'N/runtime'], function(search, record, runtime) {


    /**
     *
     * Marks the beginning of the script’s execution. The purpose of the input stage is to generate the input data.
     * Executes when the getInputData entry point is triggered. This entry point is required.
     *
     * @param inputContext = { isRestarted: boolean, ObjectRef: { id: [string | number], type: string} }
     * @returns {Array | Object | search.Search | inputContext.ObjectRef | file.File Object}
     */
    function getInputData(inputContext) {
        var stMethodName = 'getInputData';
        try {
            log.debug(stMethodName, '* * * START * * *');
            var scriptObj = runtime.getCurrentScript();
            var customSavedSearchId = scriptObj.getParameter('custscript_bb_summary_param_search');
            var customSavedSearch = search.load({ id: customSavedSearchId });
            var resultArray = [];
            
            var arrSearchColumns = customSavedSearch.columns;
            customSavedSearch.run().each(function(result) {
                var helpObj = {
                    id: result.getValue(result.columns[0]),
                    recordType: result.getValue(result.columns[1]),
                    fields: []
                }
                for (var i = 2; i < arrSearchColumns.length; i++) {
                    var value = result.getValue(result.columns[i]);
                    helpObj.fields.push({fieldId: result.columns[i].label, value: result.getValue(result.columns[i])})
                }
                
                if(helpObj.recordType && helpObj.id) {
                    resultArray.push(helpObj);
                }
                return true;
            });
            return resultArray;
        } catch (error) {
            log.error(stMethodName, 'error: ' + error);
        } finally {
			log.debug(stMethodName, '* * * END * * *');
		}
    }


    /**
     *
     * Executes when the map entry point is triggered.
     * The logic in your map function is applied to each key/value pair that is provided by the getInputData stage.
     * One key/value pair is processed per function invocation, then the function is invoked again for the next pair.
     * The output of the map stage is another set of key/value pairs. During the shuffle stage that always follows,
     * these pairs are automatically grouped by key.
     *
     * @param mapContext = { isRestarted: boolean, executionNo: property, errors: iterator, key: string, value: string }
     */
    function map(mapContext) {
        var stMethodName = 'map';
        try {
            log.debug(stMethodName, '* * * START * * *');

            var searchResult = JSON.parse(mapContext.value);
            var submitValues = {};
            for (var i = 0; i < searchResult.fields.length; i++) {
                submitValues[searchResult.fields[i].fieldId] = parseFloat(searchResult.fields[i].value)
                
            }
   
            var updatedRecordId = record.submitFields({
                type: searchResult.recordType,
                id: searchResult.id,
                values: submitValues
            });
            log.debug('record updated:', updatedRecordId);
            // mapContext.write({
            //     key: stCustomerId,
            //     value: stInternalId
            // })
        } catch (error) {
            log.error(stMethodName, 'error: ' + error);
        } finally {
			log.debug(stMethodName, '* * * END * * *');
		}
    }


    /**
     *
     * Executes when the reduce entry point is triggered.
     * The logic in your reduce function is applied to each key, and its corresponding list of value.
     * Only one key, with its corresponding values, is processed per function invocation.
     * The function is invoked again for the next key and corresponding set of values.
     * Data is provided to the reduce stage by one of the following:
     *  - The getInputData stage — if your script has no map function.
     *  - The shuffle stage — if your script uses a map function. The shuffle stage follows the map stage.
     *    Its purpose is to sort data from the map stage by key.
     *
     * @param reduceContext = { isRestarted: boolean, executionNo: property, errors: iterator, key: string, value: string }
     */
    function reduce(reduceContext) {

        reduceContext.write({})
    }


    /**
     *
     * Executes when the summarize entry point is triggered.
     * When you add custom logic to this entry point function, that logic is applied to the result set.
     *
     * @param summarizeContext = { isRestarted: read-only boolean, concurrency: number, dateCreated: Date, seconds: number, usage: number,
     *                           yields: number, inputSummary: object, mapSummary: object, reduceSummary: object, output: iterator }
     */
    function summarize(summarizeContext) {

    }

    return {
        getInputData: getInputData,
        map: map,
        // reduce: reduce,
        // summarize: summarize
    }
});