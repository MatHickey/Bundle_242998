/**
 * @NApiVersion 2.x
 * @NScriptType plugintypeimpl
 * @NModuleScope Public
 */
define(['N/search','N/record'], function(search,record) {
    return {
        setCustomBodyFields: function(transaction) {
            return transaction;
        },
        setCurrentLineCustomFields: function(transaction) {
            return transaction;
        }
    }
});