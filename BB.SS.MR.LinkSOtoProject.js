/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = () => {
            return search.create({
                type: "salesorder",
                filters:
                    [
                        ["custbody_bb_project","noneof","@NONE@"],
                        "AND",
                        ["custbody_bb_project.custentity_bb_project_so","anyof","@NONE@"],
                        "AND",
                        ["mainline","is","T"],
                        "AND",
                        ["type","anyof","SalesOrd"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            sort: search.Sort.ASC,
                            label: "Internal ID"
                        }),
                        search.createColumn({name: "custbody_bb_project", label: "Project"})
                    ]
            });
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            const searchResult = JSON.parse(mapContext.value);
            const salesOrderId = searchResult.id;
            const projectId = searchResult.values.custbody_bb_project.value;

            let values = {};
            values['custentity_bb_project_so'] = salesOrderId;

            record.submitFields({
                type: record.Type.JOB,
                id: projectId,
                values: values,
                options: {
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                }
            });
        }


        return {getInputData, map}

    });
