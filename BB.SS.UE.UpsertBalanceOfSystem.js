/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime'], function(record, search, runtime) {

    function afterSubmit(scriptContext){
        try {
            var trigger = scriptContext.type;
            switch (trigger) {
                case 'create':
                case 'edit':
                    var bosLineArray = [];
                    var itemFulfillment = record.load({type: record.Type.ITEM_FULFILLMENT, id: scriptContext.newRecord.id, isDynamic: true});
                    var oldItemFulfillment = scriptContext.oldRecord;
                    var bosRec = itemFulfillment.getValue({fieldId: 'custbody_bb_balance_of_system'});
                    var projectId = itemFulfillment.getValue({fieldId: 'custbody_bb_project'});
                    var lineCount = itemFulfillment.getLineCount('item');
                    if (lineCount > 0) {
                        for (var i = 0; i < lineCount; i++) {
                            var obj = {};
                            obj.item = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                            obj.lineAmount = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'itemunitprice', line: i})*
                                itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i});
                            obj.itemCOGAcct = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'custcol_bb_cogs_account_sourced', line: i});
                            obj.bosExpenseAcct = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'custcol_bb_bos_expense_accnt_line', line: i});
                            obj.lineUUID = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'custcol_bb_bos_item_fulfil_line_id', line: i});

                            obj.includeInBOS = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'custcol_bb_include_in_bos_bool', line: i});
                            obj.bosLineId = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'custcol_bb_bos_line_id', line: i});
                            obj.bosAmount = itemFulfillment.getSublistValue({sublistId: 'item', fieldId: 'custcol_bb_bos_line_amount', line: i});

                            obj.processType = (obj.bosLineId) ? 'update': 'add';
                            obj.projectId = projectId;

                            if (obj.includeInBOS && obj.lineAmount != obj.bosAmount) {
                                bosLineArray.push(obj);
                            }
                        }
                        log.debug('bos line array',  bosLineArray);
                        //process bos record
                        upsertBalanceOfSystem(itemFulfillment, oldItemFulfillment, bosRec, bosLineArray)
                    }
                break;
            }
        } catch (e) {
            log.error('error processing balance of system record', e);
        }
    }

    function upsertBalanceOfSystem(itemFulfillment, oldItemFulfillment, bosRec, bosLineArray) {
        var balanceOfSystem;
        log.debug('bosRec', bosRec);
        log.debug('bosLineArray.length', bosLineArray.length);
        if (bosLineArray.length > 0) {
            if (!bosRec) {
                balanceOfSystem = record.create({
                    type: 'customtransaction_bb_balance_of_system',
                    isDynamic: true
                })
                balanceOfSystem.setValue({fieldId: 'trandate', value: new Date()});
                balanceOfSystem.setValue({fieldId: 'subsidiary', value: itemFulfillment.getValue({fieldId: 'subsidiary'})});
                balanceOfSystem.setValue({
                    fieldId: 'custbody_bbss_configuration',
                    value: (itemFulfillment.getValue({fieldId: 'custbody_bbss_configuration'})) ? itemFulfillment.getValue({fieldId: 'custbody_bbss_configuration'}) : 1
                })
                for (var x = 0; x < bosLineArray.length; x++) {
                    addBOSLine(balanceOfSystem, bosLineArray[x], true)
                    addBOSLine(balanceOfSystem, bosLineArray[x], false);
                    var itemFullmentLineId = bosLineArray[x].lineUUID;
                    var ifLineIndex = itemFulfillment.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'custcol_bb_bos_item_fulfil_line_id',
                        value: itemFullmentLineId
                    })
                    if (ifLineIndex != -1) {
                        upsertItemFulfillmentLine(itemFulfillment, bosLineArray[x], ifLineIndex)
                    }
                }
                var id = balanceOfSystem.save({ignoreMandatoryFields: true});

                itemFulfillment.setValue({fieldId: 'custbody_bb_balance_of_system', value: id});
                itemFulfillment.save({ignoreMandatoryFields: true})
            } else {
                balanceOfSystem = record.load({
                    type: 'customtransaction_bb_balance_of_system',
                    id: bosRec,
                    isDynamic: true
                })
                balanceOfSystem.setValue({
                    fieldId: 'custbody_bbss_configuration',
                    value: (itemFulfillment.getValue({fieldId: 'custbody_bbss_configuration'})) ? itemFulfillment.getValue({fieldId: 'custbody_bbss_configuration'}) : 1
                })
                var oldItemFulfillmentLineCount = oldItemFulfillment.getLineCount('item');
                var newItemFulfillmentLineCount = itemFulfillment.getLineCount('item');
                var bosLineCount = balanceOfSystem.getLineCount('line');
                // update all existing lines
                if (oldItemFulfillmentLineCount == newItemFulfillmentLineCount) {
                    for (var x = 0; x < bosLineArray.length; x++) {
                        var itemFullmentLineId = bosLineArray[t].lineUUID;
                        var lineIndex = balanceOfSystem.findSublistLineWithValue({
                            sublistId: 'line',
                            fieldId: 'custcol_bb_bos_item_fulfil_line_id',
                            value: itemFullmentLineId
                        })
                        if (lineIndex != -1) {
                            upsertBOSLine(balanceOfSystem, bosLineArray[x], true, lineIndex)
                            upsertBOSLine(balanceOfSystem, bosLineArray[x], false, lineIndex + 1);
                        }
                    }

                } else if (oldItemFulfillmentLineCount != newItemFulfillmentLineCount) {// add or remove line
                    for (var t = 0; t < bosLineArray.length; t++) {
                        var itemFullmentLineId = bosLineArray[t].lineUUID;
                        var lineIndex = balanceOfSystem.findSublistLineWithValue({
                            sublistId: 'line',
                            fieldId: 'custcol_bb_bos_item_fulfil_line_id',
                            value: itemFullmentLineId
                        })
                        var ifLineIndex = itemFulfillment.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_bos_item_fulfil_line_id',
                            value: itemFullmentLineId
                        })
                        log.debug('line number', lineIndex);
                        if (lineIndex != -1) {
                            upsertBOSLine(balanceOfSystem, bosLineArray[t], true, lineIndex)
                            upsertBOSLine(balanceOfSystem, bosLineArray[t], false, lineIndex + 1)
                        } else {
                            addBOSLine(balanceOfSystem, bosLineArray[t], true)
                            addBOSLine(balanceOfSystem, bosLineArray[t], false)
                        }
                        if (ifLineIndex != -1) {
                            upsertItemFulfillmentLine(itemFulfillment, bosLineArray[t], lineIndex)
                        }
                    }
                }
                balanceOfSystem.save({ignoreMandatoryFields: true});

                itemFulfillment.save({ignoreMandatoryFields: true})

            }
        }
    }

    function addBOSLine(balanceOfSystem, bosObj, isDebit) {
        balanceOfSystem.selectNewLine('line');
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: bosObj.itemCOGAcct});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_bb_bos_item_fulfil_line_id', value: (isDebit) ? bosObj.lineUUID : null});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: (isDebit) ? bosObj.projectId : null});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: (isDebit) ? 'debit' : 'credit', value: bosObj.lineAmount});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_bb_bos_line_id', value: create_UUID()});
        bosObj.bosLineId = balanceOfSystem.getCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_bb_bos_line_id'});
        balanceOfSystem.commitLine('line')
    }

    function upsertBOSLine(balanceOfSystem, bosObj, isDebit, lineIndex) {
        balanceOfSystem.selectLine({sublistId: 'line', line: lineIndex})
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: bosObj.itemCOGAcct});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_bb_bos_item_fulfil_line_id', value: (isDebit) ? bosObj.lineUUID : null});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: 'customer', value: (isDebit) ? bosObj.projectId : null});
        balanceOfSystem.setCurrentSublistValue({sublistId: 'line', fieldId: (isDebit) ? 'debit' : 'credit', value: bosObj.lineAmount});;
        balanceOfSystem.commitLine('line')
    }

    function upsertItemFulfillmentLine(itemFulfillment, bosObj, lineIndex) {
        itemFulfillment.selectLine({sublistId: 'item', line: lineIndex})
        itemFulfillment.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_bos_line_amount', value: bosObj.lineAmount});
        itemFulfillment.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_bb_bos_line_id', value: bosObj.bosLineId});
        itemFulfillment.commitLine('item')
    }

    function create_UUID(){
        var dt = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (dt + Math.random()*16)%16 | 0;
            dt = Math.floor(dt/16);
            return (c=='x' ? r :(r&0x3|0x8)).toString(16);
        });
        return uuid;
    }


    return {
        afterSubmit: afterSubmit
    };

});
