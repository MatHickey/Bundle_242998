/**
 * @NApiVersion 2.0
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @version 17.2.0
 * @author Matt Lehman
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

define(['N/runtime', 'N/record', 'N/search', 'N/https', 'N/format', './BB SS/SS Lib/moment.min', './BB SS/SS Lib/BB.SS.OAuth1.0Module', 'N/encode'], function(runtime, record, search, https, format, moment, oauth, encode) {
    function onAction(scriptContext) {

        var newRecord = scriptContext.newRecord;
        var lineCount = newRecord.getLineCount({
            sublistId: 'item'
        });
        var items = [];
        for (var i = 0; i < lineCount; i++) {
            
            var item = newRecord.getSublistText({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            
            var itemID = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            var qty = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i
            });

            var lineID = newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'line',
                line: i
            });
            var itemType = search.lookupFields({
                type: search.Type.ITEM,
                id:itemID,
                columns:['type']
            });
            
            var type = itemType.type;
            var typeName = type[0].value;
            // log.debug('Item Type', typeName);
            
            if(typeName == 'InvtPart'){               
                items.push({
                    item:item,
                    qty:qty,
                    lineID:lineID                   
                });
            }
        }
        
        var shipdate = newRecord.getText({
            fieldId:'shipdate'
        });
        
        var shipzip = newRecord.getValue({
            fieldId:'shipzip'
        });

        log.debug('ship date', shipdate);
        log.debug('ship zip', shipzip);
        log.debug('Items to be sent in request', JSON.stringify(items));        
       
        var json = {
                    "shipdate":shipdate,
                    "shipzip":shipzip,
                    "items":items
            };
        log.debug('Request Body', json);
        var finalMsg = '';
        try{   
            //var response = baywa.getItemAvailability(json); 

            var ssConfig = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: 1
            });
            if (scriptContext.newRecord.type == 'salesorder') {
                var env = ssConfig.getText({
                    fieldId: 'custrecord_bb_bay_so_item_avail_enviro'
                });
            }
            if (scriptContext.newRecord.type == 'purchaseorder') {
                var env = ssConfig.getText({
                    fieldId: 'custrecord_bb_bay_po_item_avail_enviro'
                });   
            }

            var response = oauth.callEndpoint(env, 'BayWa', 'POST', 'script=529&deploy=1', json);
              
            log.debug('RESPONSE', response);
            var rspArr = JSON.parse(response);
            //var rspArr = response.body;  
            if (rspArr.status == 'failed') {
                finalMsg = rspArr.message;
                var htmlErr = rspArr.htmlBase64;
                var html = encode.convert({
                    string: htmlErr,
                    inputEncoding: encode.Encoding.BASE_64,
                    outputEncoding: encode.Encoding.UTF_8
                });
            } else {
                for(i in rspArr){
                    if (rspArr[i].htmlBase64) {
                        var htmlString = rspArr[i].htmlBase64;
                        var html = encode.convert({
                            string: htmlString,
                            inputEncoding: encode.Encoding.BASE_64,
                            outputEncoding: encode.Encoding.UTF_8
                        });
                    }
                } // end of loop
            }
            
        }catch(e){
            log.debug('ERROR :', e);
        }
        
        record.submitFields({
            type: newRecord.type,
            id: newRecord.id,
            values: {
                'custbody_bb_bw_availability_html': html
            },
            options: {
                ignoreMandatoryFields: true
            }
        });
    }

    return {
        onAction: onAction
    };
});