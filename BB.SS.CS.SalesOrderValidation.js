/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope public
 * @author Matt Lehman
 */
define(['N/record', 'N/search'], function(record, search) {
    

    /**
     * Validation function to be executed when record is deleted.
     *
     * @param {Object} context
     * @param {Record} context.currentRecord - Current form record
     * @param {string} context.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateDelete(context) {
        var salesOrder = context.currentRecord;
        var poId = salesOrder.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_bb_purchase_order_id'
        });
        var poName = salesOrder.getCurrentSublistText({
            sublistId: 'item',
            fieldId: 'custcol_bb_purchase_order_id'
        });
        if (poId) {
            alert('The line you are attempting to remove is associated to ' + poName +  
                ' . This line cannot be removed. You must remove the line from the Purchase Order and related transactions before you can delete this line.');
            return false;
        } else {
            return true;
        }
    }


    return {
        validateDelete: validateDelete
    };
    
});
