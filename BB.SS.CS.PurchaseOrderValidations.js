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
        var purchaseOrder = context.currentRecord;
        var orderStatus = purchaseOrder.getValue({
            fieldId: 'status'
        });
        var bomId = purchaseOrder.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_bb_adder_bom_id'
        });

        if (bomId) {
            // var bomId = 1711; // for testing purposes
            var soDocNumber = salesOrderLookup(bomId);
            if (soDocNumber) {
                alert('The line you are attempting to remove is associated to Sales Order # ' + soDocNumber + ' .This line cannot be removed.');
                return false;
            } else {
                return true;
            }
            return false; // return false so the add/bom id can be blanked out/removed and then the line can be removed
        } else {
            return true; // allows the line to be removed once the adder/bom id field is blanked out
        }
    }

    function salesOrderLookup(bomId) {
        var salesorderSearchObj = search.create({
            type: "salesorder",
            filters:
            [
                ["type","anyof","SalesOrd"], 
                "AND", 
                ["custcol_bb_adder_bom_id","equalto",bomId]
            ],
            columns:
            [
                "tranid"
            ]
        }).run().getRange({
            start: 0,
            end: 1
        });
        if (salesorderSearchObj.length > 0) {
            return salesorderSearchObj[0].getValue({
                name: 'tranid'
            });
        }
    }

    return {
        validateDelete: validateDelete,
    };
    
});
