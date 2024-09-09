/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author Matt Lehman
 */
define(['N/record', './BB SS/SS Lib/BB.MD.SnapShotLibrary'],

function(record, snapShot) {
   
    function afterSubmit(scriptContext) {
        var trigger = scriptContext.type;
        var jeRecord = scriptContext.newRecord;
        if (trigger == 'delete') {
            var jeMemo = jeRecord.getValue({
                fieldId: 'memo'
            });
            var memoCheck = jeMemo.indexOf('Commission Payroll for Pay Period');
            log.debug('memo check index of Commission Payroll', memoCheck);
            if (jeMemo.indexOf('Commission Payroll for Pay Period') != -1) {
                var jeLineCount = jeRecord.getLineCount({
                    sublistId: 'line'
                });
                var proj;
                for (var j = 0; j < jeLineCount; j++) {
                    proj = jeRecord.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'entity',
                        line: j
                    });
                }
                log.debug('project id', proj);
                if (proj) {
                    var commPaidAmt = snapShot.getTotalCommissionPaidAmt(proj);
                    log.debug('commission paid amount recalculated', commPaidAmt);
                    record.submitFields({
                        type: record.Type.JOB,
                        id: proj,
                        values: {
                            'custentity_bb_paid_comm_amount': commPaidAmt
                        },
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });
                }
            }
        }
    }

    return {
        afterSubmit: afterSubmit
    };
    
});
