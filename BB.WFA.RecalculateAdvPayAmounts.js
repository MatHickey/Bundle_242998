/**
 *@NApiVersion 2.x
 *@NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (search, record, runtime) {

    function onAction(scriptContext) {
        log.emergency('script context', scriptContext);
        var type = scriptContext.newRecord.type;
        log.emergency('rec type', type);

        var advancedSchedule = scriptContext.newRecord;
        var paymentid = advancedSchedule.id;
        var totalAmount = advancedSchedule.getValue('custrecord_bbss_advpay_amount');
        var secondaryItemAppMethhod = advancedSchedule.getText({ fieldId: 'custrecord_bbss_advpay_directpay_method' });
        log.debug('amount', totalAmount);

        var milestonesearch = search.load({
            id: 'customsearch_advpay_recalculate_mileston'
        });

        var filters = milestonesearch.filterExpression;
        filters.push("AND", ["custrecord_bbss_adv_subpay_schedule", "is", paymentid]);
        milestonesearch.filterExpression = filters;

        var searchResultCount = milestonesearch.runPaged().count;
        log.debug("milestone search result count", searchResultCount);

        var downPaymentAmount = 0;
        milestonesearch.run().each(function (result) {

            log.debug('result', result);
            var id = result.id;

            var pct = result.getValue('custrecord_bbss_adv_subpay_amount_pct');
            var searchLineAmount = result.getValue('custrecord_bbss_adv_subpay_amount')

            var dealerapp = result.getText({
                name: "custrecord_bbss_advpay_dealer_method",
                join: "CUSTRECORD_BBSS_ADV_SUBPAY_SCHEDULE"
            });
            var directpayapp = result.getText({
                name: "custrecord_bbss_advpay_directpay_method",
                join: "CUSTRECORD_BBSS_ADV_SUBPAY_SCHEDULE"
            });
            var depositapp = result.getText({
                name: "custrecord_bbss_advpay_deposit_appmethod",
                join: "CUSTRECORD_BBSS_ADV_SUBPAY_SCHEDULE"
            });
            var downPaymentMehthod = result.getValue({
                name: "custrecord_bbss_advpay_deposit_appmethod",
                join: "CUSTRECORD_BBSS_ADV_SUBPAY_SCHEDULE"
            });
            var lineTransType = result.getValue({name: 'custrecord_bbss_adv_subpay_trans_type'});
            log.debug('lineTransType', lineTransType);
            log.debug('dealer app', dealerapp);


            var dealerfee = advancedSchedule.getValue('custrecord_bbss_advpay_dealer_fee_total');
            var secondaryItemTotal = advancedSchedule.getValue('custrecord_bbss_advpay_sec_item_amount');
            log.debug('dealer fee', dealerfee);
            log.debug('secondaryItemTotal', secondaryItemTotal);

            var milestone = result.getValue('custrecord_bbss_adv_subpay_milestone');
            log.debug('milestone', milestone);
            if (milestone == 12) {
                downPaymentAmount = searchLineAmount;
            }

            var lineAmount = 0;
            if (dealerapp == 'Apply Evenly' || depositapp == 'Apply Evenly' || directpayapp == 'Apply Evenly' || secondaryItemAppMethhod == 'Apply Evenly') {
                var milestonecount = search.load({
                    id: 'customsearch_bbss_advpay_milestonecount'
                });
                var filters = milestonecount.filterExpression;
                filters.push("AND", ["custrecord_bbss_adv_subpay_schedule", "is", paymentid]);
                milestonecount.filterExpression = filters;
                var searchResultCount = milestonecount.runPaged().count;
                log.debug("milestonecount result count", searchResultCount);

                var appMethodMapping = mapApplicationMethodToMilestoneId(downPaymentMehthod);
                log.debug('down payment mapping ', appMethodMapping);
                log.debug('down payment amount ', downPaymentAmount);

                if (pct) {
                    if (appMethodMapping == -1) { // apply down payment method evenly
                        lineAmount = (!downPaymentAmount) ? (parseFloat(pct) / 100) * totalAmount :
                            (parseFloat(pct) / 100) * (totalAmount - downPaymentAmount);
                    } else {
                        if (appMethodMapping == milestone) {
                            lineAmount = ((parseFloat(pct) / 100) * totalAmount) - downPaymentAmount;
                        } else {
                            lineAmount = (parseFloat(pct) / 100) * totalAmount;
                        }
                    }

                } else if (downPaymentAmount > 0) {// usually down payment amount
                    lineAmount = downPaymentAmount
                }
                log.debug('lineAmount', lineAmount)
                dealerfee = dealerfee / searchResultCount;
                secondaryItemTotal =  secondaryItemTotal / searchResultCount;

            }

            var milestone = record.load({
                type: result.recordType,
                id: id,
                isDynamic: true
            });


            if (lineTransType == 7 && secondaryItemAppMethhod == 'Apply Evenly') {
                milestone.setValue({fieldId: 'custrecord_bbss_adv_subpay_sec_item_amt', value: secondaryItemTotal})
            }

            milestone.setValue({ fieldId: 'custrecord_bbss_adv_subpay_amount', value: lineAmount });


            var save = milestone.save();
            log.debug('save', save);
            return true;
        });

    }


    function mapApplicationMethodToMilestoneId(applicationMethod) {
        if (applicationMethod == 1) {
            return -1;
        } else if (applicationMethod == 2) {
            return 1; // M0
        } else if (applicationMethod == 3) {
            return 3; // M1
        } else if (applicationMethod == 4) {
            return 4; // M2
        } else if (applicationMethod == 5) {
            return 5; // M3
        } else if (applicationMethod == 6) {
            return 8; // M4
        } else if (applicationMethod == 7) {
            return 9; // M5
        } else if (applicationMethod == 8) {
            return 10; // M6
        } else if (applicationMethod == 9) {
            return 11; // M7
        } else {
            return null
        }
    }


    return {
        onAction: onAction
    }
});
