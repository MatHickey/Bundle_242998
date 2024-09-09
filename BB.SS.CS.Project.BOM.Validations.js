/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope public
 * @author Tyler Mann
 * @version 0.1.2
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/record', 'N/search', 'N/format', ],
    function(record, search, format) {
        //set messageValues
        var INACTIVE_MESSAGE = 'The BOM you are trying to update has an inactive item. ' +
            'Please update the item to an active item and try again.';
        var SO_STATUS_MESSAGE = 'This BOM is already on an approved Sales Order. It cannot be changed. ' +
            'If you need additional items, please add a new BOM. If you would like to reduce the quantity of a BOM, please do a return.';

        function pageInit(context) {
            var currRec = context.currentRecord;
            var bomItem = currRec.getValue('custrecord_bb_project_bom_item');
            if (isNotNull(bomItem)) {
                var inactive = inventoryItemIsInactive(bomItem);
                log.debug('saveRecord inactive', inactive);
                if (inactive) {
                    alert(INACTIVE_MESSAGE);
                }
            }

            var salesOrderID = lookupSalesOrderId(currRec);
            if (isNotNull(salesOrderID)) {
                var salesOrder = record.load({
                    type: 'salesorder',
                    id: salesOrderID
                });
                var linePO = isPOGenerated(currRec, salesOrder);
                if (linePO) {
                    alert(SO_STATUS_MESSAGE);
                }
            }

        }

        function saveRecord(context) {
            var currRec = context.currentRecord;
            var bomItem = currRec.getValue('custrecord_bb_project_bom_item');
            if (isNotNull(bomItem)) {
                var inactive = inventoryItemIsInactive(bomItem);
                log.debug('saveRecord inactive', inactive);
                if (inactive) {
                    alert(INACTIVE_MESSAGE);
                    return false;
                }
            }

            var salesOrderID = lookupSalesOrderId(currRec);
            if (isNotNull(salesOrderID)) {
                var salesOrder = record.load({
                    type: 'salesorder',
                    id: salesOrderID
                });
                var linePO = isPOGenerated(currRec, salesOrder);
                if (linePO) {
                    alert(SO_STATUS_MESSAGE);
                    return false;
                }
            }

            return true;
        }



        function isPOGenerated(projectBOM, salesOrder) {
            var bomID = projectBOM.id;
            var soItemCount = salesOrder.getLineCount('item');
            for (var i = 0; i < soItemCount; i++) {
                var soLineBomID = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_bb_adder_bom_id',
                    line: i
                });
                var soLinePoId = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_bb_purchase_order_id',
                    line: i
                });
                if (bomID == soLineBomID && soLinePoId) {
    
                    return isNotNull(soLinePoId);
                }
            }
        }

        function lookupSalesOrderId(record){
            if (record.getValue('custrecord_bb_project_bom_project')) {
                return search.lookupFields({
                    type: 'job',
                    id: record.getValue('custrecord_bb_project_bom_project'),
                    columns: ['custentity_bb_project_so']
                }).custentity_bb_project_so[0].value;
           }
        }

        function inventoryItemIsInactive(itemId){
            if (itemId) {
                return search.lookupFields({
                    type: 'inventoryitem',
                    id: itemId,
                    columns: ['isinactive']
                }).isinactive;
        	}
        }

        function isNotNull(str) {
            return (str !== null && str !== '' && str !== undefined);
        }

        function isNull(str) {
            return (str === null || str === '' || str === undefined);
        }

        return {
            pageInit: pageInit,
            saveRecord: saveRecord
        };
    });