/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @Author Matt Lehman
 * @overview - client side script for custom bom suitelet entry list form - highlight rows that are missing price
 */

/**
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/runtime'],

    function(runtime) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */


        function pageInit(scriptContext) {
            var lineCount = scriptContext.currentRecord.getLineCount({
                sublistId: 'item'
            });
            if (lineCount != -1) {
                var counter = 0;
                for (var h = 0; h < lineCount; h++) {
                    counter = counter + 1;
                    var qty = scriptContext.currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: h
                    });
                    var bosLineId = scriptContext.currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_bb_bos_line_id',
                        line: h
                    });

                    if (bosLineId) { // && runtime.getCurrentUser().role != 3
                        console.log('executing parent highlighting');
                        var trDom = document.getElementById('itemrow'+h);
                        trDomChild = trDom.children;
                        for (var t=0; t < (trDomChild.length-1); t+=1) {
                            document.getElementById('quantity' + counter + '_formattedValue').disabled = true;
                            document.getElementById('itemreceive' + counter).disabled=true;
                            document.getElementById('custcol_bb_bos_line_id' + counter).disabled=true;
                            document.getElementById('custcol_bb_bos_line_amount' + counter + '_formattedValue').disabled=true;
                            document.getElementById('custcol_bb_include_in_bos_bool' + counter).disabled=true;
                        }
                    }
                }// end of line loop
            }// end of line count check
            return true;
        }

        return {
            pageInit: pageInit
        };

    });