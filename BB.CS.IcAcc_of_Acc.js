/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope public
 * @author Suhail Akhtar
 * @version 0.1.0
 * @overview - The script sets the value of IC account in Vendor payment based on Account selected 
*/
define(["N/search"], function (search) {

    var subsidiaryEnabled;
    /**
     * Function call the copy suitelet
     * 
     * @governance 0 Units
     * @param {Object} context - context of the request
     */
    function fieldChanged(context) {

        if (subsidiaryEnabled.custrecord_bb_ss_has_subsidiaries) {
            var currentRecord = context.currentRecord;

            var FieldName = context.fieldId;

            if (FieldName === 'account') {
                var newAcc = currentRecord.getValue({
                    fieldId: 'account'
                })

                if (newAcc) {
                    var relatedAccountInfo = search.lookupFields({
                        type: search.Type.ACCOUNT,
                        id: newAcc,
                        columns: ['custrecord_bb_ic_cc_account']
                    });// 1 units


                    log.debug('relatedAccountInfo', relatedAccountInfo)
                    if (relatedAccountInfo.custrecord_bb_ic_cc_account.length > 0) {
                        currentRecord.setValue({
                            fieldId: 'custbody_bb_ic_cc_account',
                            value: relatedAccountInfo.custrecord_bb_ic_cc_account[0].value
                        });
                    } else {
                        currentRecord.setValue({
                            fieldId: 'custbody_bb_ic_cc_account',
                            value: ''
                        });
                    }
                }
            }
        }


    }

    /**
     * Function call the copy suitelet
     * 
     * @governance 0 Units
     * @param {Object} context - context of the request
     */
    function pageInit(context) {
      
         subsidiaryEnabled = search.lookupFields({
            type: 'customrecord_bb_solar_success_configurtn',
            id: '1',
            columns: ['custrecord_bb_ss_has_subsidiaries']
        });

        if (subsidiaryEnabled.custrecord_bb_ss_has_subsidiaries) {
            var currentRecord = context.currentRecord;

            var newAcc = currentRecord.getValue({
                fieldId: 'account'
            })

            if (newAcc) {
                var relatedAccountInfo = search.lookupFields({
                    type: search.Type.ACCOUNT,
                    id: newAcc,
                    columns: ['custrecord_bb_ic_cc_account']
                });// 1 units



                if (relatedAccountInfo.custrecord_bb_ic_cc_account.length > 0) {
                    currentRecord.setValue({
                        fieldId: 'custbody_bb_ic_cc_account',
                        value: relatedAccountInfo.custrecord_bb_ic_cc_account[0].value
                    });
                } else {
                    currentRecord.setValue({
                        fieldId: 'custbody_bb_ic_cc_account',
                        value: ''
                    });
                }
            }
        }

    }


    return {
        fieldChanged: fieldChanged,
        pageInit: pageInit
    }

});