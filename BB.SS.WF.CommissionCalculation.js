/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 * @NModuleScope public
 * @author Suhail Akhtar
 */
define(['N/record', 'N/runtime', 'N/plugin'], function (record, runtime, plugin) {

    function onAction(scriptContext) {
        var commissionAmt = runtime.getCurrentScript().getParameter({
            name: 'custscript_bbss_commission_formula'
        });
        log.debug('commissionAmt', commissionAmt)
        if (commissionAmt) {
            record.submitFields({
                type: 'job',
                id: scriptContext.newRecord.id,
                values: {
                    'custentity_bbss_tot_comm_amt': commissionAmt
                }
            })
        } else {
            var impls = plugin.findImplementations({
                type: 'customscript_bbss_plg_commissioncal',
                includeDefault:false
            });

            log.debug('implsss',impls)
            log.debug('impls[0]',impls[0])
            if (impls.length > 0) {
                var commPlugImpl = plugin.loadImplementation({
                    type:"customscript_bbss_plg_commissioncal",
                    implementation:impls[0]
                });
                commPlugImpl.calculateCommissions(scriptContext)
            }
        }
    }

    return {
        onAction: onAction
    };

});