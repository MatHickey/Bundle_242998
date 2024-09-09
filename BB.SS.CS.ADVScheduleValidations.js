/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define([],

    function() {

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

        }


        function saveRecord(scriptContext) {
            var finPercentTotal = parseFloat(0);
            var advPercentTotal = parseFloat(0);
            var advTotal = parseFloat(0);

            var currRecord = scriptContext.currentRecord;
            var advHeaderAmount = currRecord.getValue({fieldId: 'custrecord_bbss_advpay_amount'}) || 0;
            var financierSublistCount = currRecord.getLineCount({
                sublistId: 'recmachcustrecord_bb_fams_fin_advpay_schedule'
            });
            var advSublistCount = currRecord.getLineCount({
                sublistId: 'recmachcustrecord_bbss_adv_subpay_schedule'
            });
            console.log('financierSublistCount', financierSublistCount);
            console.log('advSublistCount', advSublistCount);
            if (financierSublistCount > 0) {
                for (var f = 0; f < financierSublistCount; f++) {
                    var percent = currRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_bb_fams_fin_advpay_schedule',
                        fieldId: 'custrecord_bb_fams_amount_percent',
                        line: f
                    });
                    if (percent) {
                        finPercentTotal = parseFloat(percent) + finPercentTotal;
                    }
                }// end of loop
                if (finPercentTotal != 100) {
                    alert('The total percentage on all lines does not equal 100%');
                    return false;
                } else {
                    return true
                }
            }

            if (advSublistCount > 0) {
                for (var a = 0; a < advSublistCount; a++) {
                    var advPercent = currRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_bbss_adv_subpay_schedule',
                        fieldId: 'custrecord_bbss_adv_subpay_amount_pct',
                        line: a
                    });
                    var advAmount = currRecord.getSublistValue({
                        sublistId: 'recmachcustrecord_bbss_adv_subpay_schedule',
                        fieldId: 'custrecord_bbss_adv_subpay_amount',
                        line: a
                    });
                    if (advPercent) {
                        advPercentTotal = parseFloat(advPercent) + advPercentTotal;
                    }
                    if (advAmount) {
                        advTotal = parseFloat(advAmount) + advTotal;
                    }
                }// end of loop
                if (advPercentTotal != 100) {
                    alert('The total percentage on all lines does not equal 100%');
                    return false;
                } else if (advTotal != advHeaderAmount) {
                    alert('The total amount of lines does not equal the Amount field, please adjust the line totals.');
                    return false;
                } else {
                    return true;
                }
            } else {
                return true;
            }
        }

        return {
            pageInit: pageInit,
            saveRecord: saveRecord
        };

    });
