/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/query'], function (record, search, runtime, query) {

    function getInputData() {
        var me = runtime.getCurrentScript();
        var savedsearch = me.getParameter({ name: 'custscript_bbss_advpay_search_criteria' });
        return search.load({
            id: savedsearch
        });
    }

    function map(context) {
        log.debug('context', context);
        var result = JSON.parse(context.value);
        log.debug('result', result);
        var id = result.values['GROUP(internalid.CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT)'].value;
        log.debug('id', id);
        context.write(context.key, id);
        return;
        var prjid = result.id;
        var id = result.values["internalid.CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT"].value;
        log.debug('result', result);
        var schedule = result.values["custrecord_bbss_adv_subpay_schedule.CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT"].value;
        var milestone = result.values["custrecord_bbss_adv_subpay_milestone.CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT"].text;
        context.write(schedule + '-' + milestone, result);







    }

    function reduce(context) {
        try {

            log.debug('reduce context', context); var key = context.key;
            var values = context.values.map(JSON.parse);
            log.debug(key + ' values', values);
           // return;
            var result = values[0];
            var subsched = values[0];
           
            var sql = `SELECT PS.id, 
            PS.custrecord_bbss_adv_subpay_schedule AS schedule, 
            PS.custrecord_bbss_adv_subpay_trans_type AS transtype, 
            PS.custrecord_bbss_adv_subpay_dealer_amount AS msdealeramount, 
            PS.custrecord_bbss_adv_subpay_dealer_item AS dealeritem, 
            PS.custrecord_bbss_adv_subpay_item_list AS msitem, 
            PS.custrecord_bbss_adv_subpay_project AS project,  
            PS.custrecord_bbss_adv_subpay_amount AS msamount, 
            PS.custrecord_bbss_adv_subpay_milestone AS milestone, 
            PS.custrecord_bbss_adv_subpay_amount AS msamount,
            PROJ.custentity_bb_project_location AS projlocation, 
            MS.name AS milestonename, 
            PS.custrecord_bbss_adv_subpay_item_list AS item 
            FROM 
            customrecord_bbss_adv_sub_pay_schedule PS 
            LEFT JOIN 
            customlist_bb_milestone MS ON MS.id = PS.custrecord_bbss_adv_subpay_milestone 
            LEFT JOIN 
            job PROJ ON PROJ.id = PS.custrecord_bbss_adv_subpay_project
            WHERE 
            PS.id like ?`;
            var results = query.runSuiteQL({ query: sql, params: [result] });
            results = results.asMappedResults()
            log.debug('reduce results', results);
            var paymentsched = results[0].schedule;
            var id = results[0].project;
            var prjid = results[0].project;
            log.debug('reduce result', result);
            var milestone = results[0].milestonename;
            var milestonevalue = results[0].milestone;
            var msamount = results[0].msamount;
            var msdealeramount = results[0].msdealeramount;
            var location = results[0].projlocation;
            //var msschedule = result.values["internalid.CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT"];
            var msitem = results[0].item;
            var type = results[0].transtype;
            log.debug('type', type);
            //TODO MOVE TO LIBRARY SCRIPT
            var transactiontrans =
            {
                "1": "JOURNAL_ENTRY",
                "2": "INVENTORY_TRANSFER",
                "3": "CHECK",
                "4": "DEPOSIT",
                "5": "CASH_SALE",
                "6": "ESTIMATE",
                "7": "INVOICE",
                "8": "",
                "9": "CUSTOMER_PAYMENT",
                "10": "CREDIT_MEMO",
                "11": "INVENTORY_ADJUSTMENT",
                "12": "INVENTORY_TRANSFER",
                "13": "",
                "14": "",
                "15": "PURCHASE_ORDER",
                "16": "ITEM_RECEIPT",
                "17": "VENDOR_BILL",
                "18": "VENDOR_PAYMENT",
                "20": "VENDOR_CREDIT",
                "21": "CREDIT_CARD_CHARGE",
                "22": "CREDIT_CARD_REFUND",
                "23": "",
                "28": "EXPENSE_REPORT",
                "29": "CASH_REFUND",
                "30": "CUSTOMER_REFUND",
                "31": "SALES_ORDER",
                "32": "ITEM_FULFILLMENT",
                "33": "RETURN_AUTHORIZATION",
                "36": "",
                "37": "OPPORTUNITY",
                "38": "PARTNER_COMMISSION_PLAN",
                "40": "CUSTOMER_DEPOSIT",
                "41": "DEPOSIT_APPLICATION",
                "42": "BIN_WORKSHEET",
                "43": "VENDOR_RETURN_AUTHORIZATION",
                "45": "BIN_TRANSFER",
                "48": "TRANSFER_ORDER",
                "49": "",
                "50": "",
                "51": "INVENTORY_COST_REVALUATION",
                "52": "",
                "57": "INVENTORY_COUNT",
                "65": "",
                "66": "",
                "74": "",
                "100": ""
            }
            var rectype = transactiontrans[type];
            log.debug('rectype', rectype);
            log.debug('136 paymenth sched', paymentsched);
            //var paymentsched = result;
            //getting payment schedule record results
            var sql = `SELECT PS.custrecord_bbss_advpay_financier_list AS financier,
            PS.custrecord_bbss_advpay_dealer_fee_item AS dealeritem,
            PS.custrecord_bbss_advpay_dealer_fee_perc AS dealerpct,
            PS.custrecord_bbss_advpay_dealer_method AS dealermethodid,
            AM.name AS dealermethod,
            DepMethod.name AS depomethod,
            PS.custrecord_bbss_advpay_dealer_fee_total AS dealerfeetotal,
            PS.custrecord_bbss_advpay_deposit_appmethod AS dealerdeposit,
            PS.custrecord_bbss_advpay_direct_pay_amt AS downamount,
            DirectMethod.name AS directmethod
            FROM
            customrecord_bbss_adv_payment_schedule PS
            LEFT JOIN
            customlist_bb_adv_application_method AM ON AM.id = PS.custrecord_bbss_advpay_dealer_method
            LEFT JOIN
            customlist_bb_adv_application_method DepMethod ON DepMethod.id = PS.custrecord_bbss_advpay_deposit_appmethod
            LEFT JOIN customlist_bb_adv_application_method DirectMethod ON DirectMethod.id = PS.custrecord_bbss_advpay_directpay_method
            WHERE
            PS.id like ?`;

            // DirectMethod.name AS directmethod,
            //JOIN customlist_bb_adv_application_method DirectMethod ON DirectMethod.id = PS.custrecord_bbss_advpay_directpay_method 
            var results = query.runSuiteQL({ query: sql, params: [paymentsched] });
            log.debug('sql results', results);
            log.debug('152 sql as results', results.asMappedResults());
            results = results.asMappedResults();
            var entity = results[0].financier;
            var dealerfeeitem = results[0].dealeritem;
            var dealerfeepct = results[0].dealerpct;
            var dealermilestone = results[0].dealermethod;
            var dealerfeeamount = results[0].dealerfeetotal;
            var downamount = results[0].downamount;
            var depositmethod = results[0].depomethod;
            var directmethod = results[0].directmethod;
            var directmethod = results[0].directmethod;
            //return;
            // var fieldLookUp = search.lookupFields({
            //     type: 'customrecord_bbss_adv_payment_schedule',
            //     id: paymentsched,
            //     columns: ['custrecord_bbss_advpay_financier_list', 'custrecord_bbss_advpay_dealer_fee_item', 'custrecord_bbss_advpay_dealer_fee_perc', 'custrecord_bbss_advpay_dealer_method', 'custrecord_bbss_advpay_dealer_fee_total']
            // });
            // var entity = fieldLookUp.custrecord_bbss_advpay_financier_list[0].value;
            // var dealerfeeitem = fieldLookUp.custrecord_bbss_advpay_dealer_fee_item[0].value;
            // var dealerfeepct = fieldLookUp.custrecord_bbss_advpay_dealer_fee_perc;
            // dealerfeepct = dealerfeepct.slice(0, -1);
            // var dealerfeeamount = fieldLookUp.custrecord_bbss_advpay_dealer_fee_total;
            // var dealermilestone = fieldLookUp.custrecord_bbss_advpay_dealer_method[0].text;
            //TODO get from parent milestone schedule
            //var entity = result.values["custrecord_bbss_advpay_financier_list.CUSTRECORD_BBSS_ADV_SUBPAY_SCHEDULE"].value;
            var downpaymentamount = 0;
            var directmethodamount = 0;
            if (milestone == directmethod) {
                var totalsearch = search.load({
                    id: 'customsearch_bbss_advpay_direct_pay_so',
                });
                var filters = totalsearch.filterExpression;
                // log.debug('174 filters', filters + ' rec id ' + recid);
                // this code block is just in case the UI already has a filtered vendor
                var hasVenFilter = false;
                for (var f = 0; f < filters.length; f++) {
                    if (filters[f][0] == 'custbody_bb_project') {
                        filters[f] = ["custbody_bb_project", "anyof", prjid];
                        hasVenFilter = true;
                    }
                }
                if (!hasVenFilter)
                    filters.push("AND", ["custbody_bb_project", "anyof", prjid]);
                log.audit('duplicate filters', filters);
                totalsearch.filterExpression = filters;
                var searchResultCount = totalsearch.runPaged().count;
                log.debug("197 transactionSearchObj result count", searchResultCount);
                totalsearch.run().each(function (result) {
                    log.debug('result', result);
                    amount = result.getValue({
                        name: "amount",
                        summary: "SUM"
                    })
                    directmethodamount = amount;
                    log.debug('amount', amount);
                    // .run().each has a limit of 4,000 results
                    return true;
                });
            };


            //GET DOWN PAYMENT Amount
            if (milestone == depositmethod) {

                try {
                    // var sql = "SELECT id, custrecord_bbss_adv_subpay_transaction AS transaction, custrecord_bbss_adv_subpay_amount AS amount FROM customrecord_bbss_adv_sub_pay_schedule WHERE custrecord_bbss_adv_subpay_trans_type like ? AND custrecord_bbss_adv_subpay_schedule like ? AND custrecord_bbss_adv_subpay_transaction IS NOT NULL";
                    var sql = `SELECT PS.id, 
                    PS.custrecord_bbss_adv_subpay_amount AS transaction, 
                    PS.custrecord_bbss_adv_subpay_amount AS amount, 
                    MS.name AS milestone, 
                    PS.custrecord_bbss_adv_subpay_item_list AS item 
                    FROM 
                    customrecord_bbss_adv_sub_pay_schedule PS 
                    JOIN customlist_bb_milestone MS ON MS.id = PS.custrecord_bbss_adv_subpay_milestone 
                    WHERE MS.name like ? 
                    AND 
                    custrecord_bbss_adv_subpay_schedule like ?`;
                    var downpaymentms = 'Down Payment';
                    var results = query.runSuiteQL({ query: sql, params: [downpaymentms, paymentsched] });
                    log.debug('sql results', results);
                    log.debug('sql as results', results.asMappedResults());
                    results = results.asMappedResults();
                    log.debug('228 deposit amount', results);
                    if (results.length >0) downpaymentamount = results[0].amount;

                    // if (results[0]) {
                    //     rec.selectNewLine({
                    //         sublistId: 'item'
                    //     });
                    //     rec.setCurrentSublistValue({
                    //         sublistId: 'item',
                    //         fieldId: 'item',
                    //         value: results[0].item //,
                    //         // ignoreFieldChange: boolean true | false
                    //     });
                    //     rec.setCurrentSublistValue({
                    //         sublistId: 'item',
                    //         fieldId: 'quantity',
                    //         value: 1 //,
                    //         // ignoreFieldChange: boolean true | false
                    //     });
                    //     rec.setCurrentSublistValue({
                    //         sublistId: 'item',
                    //         fieldId: 'price',
                    //         value: -1 //,
                    //         // ignoreFieldChange: boolean true | false
                    //     });
                    //     rec.setCurrentSublistValue({
                    //         sublistId: 'item',
                    //         fieldId: 'itemrate',
                    //         value: results[0].amount//,
                    //         // ignoreFieldChange: boolean true | false
                    //     });
                    //     rec.setCurrentSublistValue({
                    //         sublistId: 'item',
                    //         fieldId: 'amount',
                    //         value: results[0].amount//,
                    //         // ignoreFieldChange: boolean true | false
                    //     });
                    //     rec.commitLine({
                    //         sublistId: 'item'
                    //     });
                    // }
                    // var milestoneid = results[0].id;
                    // var depositamount = results[0].amount;
                    // var deposittrans = results[0].transaction;
                    // if (deposittrans) {
                    //     var recDepApp = record.transform({
                    //         fromType: record.Type.CUSTOMER_DEPOSIT,
                    //         fromId: deposittrans,
                    //         toType: record.Type.DEPOSIT_APPLICATION,
                    //         isDynamic: true
                    //     });
                    //     recDepApp.setValue({ fieldId: 'trandate', value: new Date() });
                    //     var lines = recDepApp.getLineCount({ sublistId: 'apply' });
                    //     for (var ix = 0; ix < lines; ix++) {
                    //         var sublistInvoiceId = recDepApp.getSublistValue({ sublistId: 'apply', fieldId: 'internalid', line: ix });
                    //         if (sublistInvoiceId == save) {
                    //             var SublistDue = recDepApp.getSublistValue({ sublistId: 'apply', fieldId: 'due', line: ix });
                    //             recDepApp.selectLine({ sublistId: 'apply', line: ix });
                    //             recDepApp.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: depositamount, ignoreFieldChange: false });
                    //             recDepApp.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true, ignoreFieldChange: false });
                    //         }
                    //     }
                    //     var depsave = recDepApp.save();
                    //     log.debug('dep save', depsave);
                    //}
                } catch (e) {
                    log.debug('deposit application error', e);
                }

            }

            //END Down payment




           // var location = result.values.custentity_bb_project_location.value;
            var project = result.id;
            var rec = record.create({
                type: record.Type[rectype],
                isDynamic: true
            });
            if (rectype == "INVOICE") rec.setValue({ fieldId: 'approvalstatus', value: 2 });
            log.debug('328 before prj set', prjid);
           
            rec.setValue({ fieldId: 'custbody_bbss_adv_pay_subschedlink', value: subsched });
            rec.setValue({ fieldId: 'custbody_bbss_adv_payschedlist', value: paymentsched });
            try {
                if (type == 40) {
                    rec.setValue('payment', msamount);
                    rec.setValue({ fieldId: 'customer', value: entity });
                } else {
                    rec.setValue({ fieldId: 'entity', value: entity });
                    log.debug('216 entity set', '---');
                    rec.selectNewLine({
                        sublistId: 'item'
                    });
                    log.debug('setting item', msitem);
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: msitem //,
                        // ignoreFieldChange: boolean true | false
                    });
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: 1 //,
                        // ignoreFieldChange: boolean true | false
                    });
                    log.debug('setting amount', msamount - downpaymentamount - directmethodamount);
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemrate',
                        value: parseFloat(msamount - downpaymentamount - directmethodamount)//,
                        // ignoreFieldChange: boolean true | false
                    });
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: parseFloat(msamount - downpaymentamount - directmethodamount) //,
                        // ignoreFieldChange: boolean true | false
                    });
                    var commit = rec.commitLine({
                        sublistId: 'item'
                    });
                    log.debug('commit line', commit);
                }
                rec.setValue({ fieldId: 'custbody_bb_project', value: parseInt(prjid) });
                rec.setValue({ fieldId: 'custbody_bb_milestone', value: milestonevalue});
                if (msdealeramount) {
                    rec.selectNewLine({
                        sublistId: 'item'
                    });
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: dealerfeeitem //,
                        // ignoreFieldChange: boolean true | false
                    });
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: 1 //,
                        // ignoreFieldChange: boolean true | false
                    });
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'price',
                        value: -1 //,
                        // ignoreFieldChange: boolean true | false
                    });
                    var amtcalc = 0;
                    if (dealerfeepct) {
                        amtcalc = msamount * parseFloat(dealerfeepct)
                    };
                    if (dealerfeeamount) {
                        amtcalc = dealerfeeamount
                    }
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemrate',
                        value: msdealeramount//,
                        // ignoreFieldChange: boolean true | false
                    });
                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: msdealeramount //,
                        // ignoreFieldChange: boolean true | false
                    });
                    rec.commitLine({
                        sublistId: 'item'
                    });
                }
            }
            catch (e) {
                log.debug('setting line error', e);
            }

            try {
                rec.setValue({ fieldId: 'location', value: location });
            } catch (e) {
                log.debug('location issue', e);
            }






            //CHECK IF DEPOSIT SHOULD BE APPLIED
            log.debug('milestone ' + milestone, 'deposit method ' + depositmethod);

            var save = rec.save();
            log.debug('save', save);







            var amount = 0;
            var totalsearch = search.load({
                id: 'customsearch_bbss_advpay_transactionamt',
            });
            var filters = totalsearch.filterExpression;
            // log.debug('174 filters', filters + ' rec id ' + recid);
            // this code block is just in case the UI already has a filtered vendor
            var hasVenFilter = false;
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == 'custbody_bbss_adv_payschedlist') {
                    filters[f] = ["custbody_bbss_adv_payschedlist", "anyof", paymentsched];
                    hasVenFilter = true;
                }
            }
            if (!hasVenFilter)
                filters.push("AND", ["custbody_bbss_adv_payschedlist", "anyof", paymentsched]);
            log.audit('duplicate filters', filters);
            totalsearch.filterExpression = filters;
            var searchResultCount = totalsearch.runPaged().count;
            log.debug("transactionSearchObj result count", searchResultCount);
            totalsearch.run().each(function (result) {
                log.debug('result', result);
                amount = result.getValue({
                    name: "amount",
                    summary: "SUM"
                })
                log.debug('amount', amount);
                // .run().each has a limit of 4,000 results
                return true;
            });


            var submit = record.submitFields({
                type: 'customrecord_bbss_adv_sub_pay_schedule',
                id: subsched,
                values: {
                    custrecord_bbss_adv_subpay_transaction: save
                }
            });
            var submitparent = record.submitFields({
                type: 'customrecord_bbss_adv_payment_schedule',
                id: paymentsched,
                values: {
                    custrecord_bbss_advpay_already_amount: parseFloat(amount),
                    custrecord_bbss_advpay_direct_pay_amt: parseFloat(directmethodamount)
                }
            });
            log.debug('submit fields', submit);
        } catch (e) {
            log.debug('catch', e);
        }

    }

    function summarize(summary) {

    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    }
});
