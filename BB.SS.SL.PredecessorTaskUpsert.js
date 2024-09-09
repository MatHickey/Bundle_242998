/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record', 'N/search'],

function(record, search) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
        log.debug('request data parameters', context.request.parameters);
        if (context.request.method == 'POST') {
            if (context.request.parameters.action == 'upsertpredecessor') {
                try {
                    if (context.request.parameters.parentTaskId) {
                        var predecessor = record.load({
                            type: 'projecttask',
                            id: context.request.parameters.parentTaskId,
                            isDynamic: true
                        });
                    } 
                    // load sublist values for predecessor
                    var lineIndex = predecessor.findSublistLineWithValue({
                        sublistId: 'predecessor',
                        fieldId: 'task',
                        value: context.request.parameters.taskId
                    });
                    if (lineIndex != -1) {
                        predecessor.selectLine({
                            sublistId: 'predecessor',
                            line: lineIndex
                        });
                    } else {
                        predecessor.selectNewLine({
                            sublistId: 'predecessor'
                        });
                        predecessor.setCurrentSublistValue({
                            sublistId: 'predecessor',
                            fieldId: 'task',
                            value: context.request.parameters.taskId
                        });
                    }
                    if (context.request.parameters.startDate) {
                        predecessor.setCurrentSublistValue({
                            sublistId: 'predecessor',
                            fieldId: 'startdate',
                            value: new Date(context.request.parameters.startDate)
                        });
                    }
                    if (context.request.parameters.endDate) {
                        predecessor.setCurrentSublistValue({
                            sublistId: 'predecessor',
                            fieldId: 'enddate',
                            value: new Date(context.request.parameters.endDate)
                        });
                    }
                    if (context.request.parameters.type) {
                        predecessor.setCurrentSublistValue({
                            sublistId: 'predecessor',
                            fieldId: 'type',
                            value: context.request.parameters.type
                        });
                    }
                    if (context.request.parameters.lagDays) {
                        predecessor.setCurrentSublistValue({
                            sublistId: 'predecessor',
                            fieldId: 'lagdays',
                            value: context.request.parameters.lagDays
                        });
                    }
                    predecessor.commitLine({
                        sublistId: 'predecessor'
                    });
                    var saveId = predecessor.save({
                        ignoreMandatoryFields: true
                    });
                    log.debug('successful creation of transaction schedule to project action');
                    context.response.write(String(saveId));
                    return;
                } catch (e) {
                    log.debug('error update to project action', e);
                    context.response.write('failure');
                    return;
                }
            }

            if (context.request.parameters.action == 'predecessordelete') {
                try {
                    if (context.request.parameters.parentTaskId) {
                        var predecessor = record.load({
                            type: 'projecttask',
                            id: context.request.parameters.parentTaskId,
                            isDynamic: true
                        });
                        // load sublist values for predecessor
                        var lineIndex = predecessor.findSublistLineWithValue({
                            sublistId: 'predecessor',
                            fieldId: 'task',
                            value: parseInt(context.request.parameters.id)
                        });
                        log.debug('remove line index number', lineIndex);
                        if (lineIndex != -1) {
                            predecessor.removeLine({
                                sublistId: 'predecessor',
                                line: lineIndex
                            });
                        }
                        var saveId = predecessor.save({
                            ignoreMandatoryFields: true
                        });
                        log.debug('successful line removal');
                        context.response.write(String(saveId));
                        return;
                    } 
                } catch (e) {
                    log.debug('error update to project action', e);
                    context.response.write('failure');
                    return;
                }
            }// end of predecessor delete param check
        } // end of post check
    }// end of function

    return {
        onRequest: onRequest
    };
    
});