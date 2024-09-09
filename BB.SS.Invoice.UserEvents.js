/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @overview Invoice User Event Script to apply deposits to invoices on approval
 */
define(['N/record', './BB SS/SS Lib/BB_SS_MD_SolarConfig', './BB SS/SS Lib/BB.SS.ApplyCustomerDeposits'], function(record, solarConfig, customerDeposit) {
   
    function afterSubmit(scriptContext) {
        var invoice = scriptContext.newRecord;
        var id = scriptContext.newRecord.id;
        var trigger = scriptContext.type;
        var projectId = invoice.getValue({
            fieldId: 'custbody_bb_project'
        });
        switch (trigger) {
            case 'edit':
            case 'xedit':
                if (projectId) {
                    var project = record.load({
                        type: record.Type.JOB,
                        id: projectId,
                        isDynamic: true
                    });
                    var financingType = project.getText({
                        fieldId: 'custentity_bb_financing_type'
                    });
                    var oldApprovalStatus = scriptContext.oldRecord.getText({
                        fieldId: 'approvalstatus'
                    });
                    var newApprovalStatus = scriptContext.newRecord.getText({
                        fieldId: 'approvalstatus'
                    });
                    // testing getting customer depost records
                    var deposits = customerDeposit.getDepositRecord(projectId);

                    if (oldApprovalStatus == 'Pending Approval' && newApprovalStatus == 'Approved') {
                        var config = solarConfig.getConfigurations(['custrecord_bb_ss_m0_cash_trans_type', 'custrecord_bb_ss_m0_finance_tran_type']);
                        //var depositTransType;
                        if (financingType == 'Cash') {
                            var depositTransType = config['custrecord_bb_ss_m0_cash_trans_type'].text;
                            if (depositTransType == 'Customer Deposit') {
                                //find deposit record and auto apply to milestone invoice
                                customerDeposit.applyDepositToInvoices(projectId, scriptContext, newApprovalStatus);
                            }
                        } else {
                            var depositTransType = config['custrecord_bb_ss_m0_finance_tran_type'].text;
                            if (depositTransType == 'Customer Deposit') {
                                //find deposit record and auto apply to milestone invoice
                                customerDeposit.applyDepositToInvoices(projectId, scriptContext, newApprovalStatus);
                            }
                        }
                    }
                }
            break;
        } // end of switch statement

    }


    return {
        afterSubmit: afterSubmit
    };
    
});
