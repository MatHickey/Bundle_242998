/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *
 * Deployed to Intercompany CC Payment (custom transaction)
 */

define(['N/record', 'N/search'],
    function (record, search) {

        /**
          * Function creates ICC through other ICC records
          * 
          * @governance 0 Units
          * @param {Object} context - context of the request
          * @param {Object} newRecord - new project record
          */
        function afterSubmit(scriptContext) {
            var payment = scriptContext.newRecord;
            var iccc = null;

            var subsidiaryEnabled = search.lookupFields({
                type: 'customrecord_bb_solar_success_configurtn',
                id: '1',
                columns: ['custrecord_bb_ss_has_subsidiaries']
            });

            if (subsidiaryEnabled.custrecord_bb_ss_has_subsidiaries) {
                // check if the IC-CC is already created
                var icccId = payment.getValue({ fieldId: 'custbody_bb_related_transaction' });
                if (icccId) {
                    try {
                        iccc = record.load({
                            type: 'customtransaction_bb_ic_cc',
                            id: icccId,
                            isDynamic: true,
                        });//5 units

                        removeLinesFromICCRec(iccc);

                    } catch (e) {
                        log.error('Related transaction', ' ');
                        throw 'Bill Payment is related to this IC record, hence no processing will be done';
                        return;
                    }

                } else {
                    iccc = record.create({
                        type: 'customtransaction_bb_ic_cc',
                        isDynamic: true
                    });//10 units
                }

                var cashAccount = payment.getValue({ fieldId: 'custbody_bb_ic_cc_account' });

                // find the IC-CC account from the lines
                var accountId, relatedAccountId, total;
                var lineCount = payment.getLineCount({ sublistId: 'line' });
                for (var l = 0; l < lineCount; l++) {
                    if (!relatedAccountId) {
                        relatedAccountId = payment.getSublistValue({
                            sublistId: 'line',
                            fieldId: 'custcol_related_iccc_account',
                            line: l
                        });
                        if (relatedAccountId) {
                            // found the line we want for the CC account
                            accountId = payment.getSublistValue({
                                sublistId: 'line',
                                fieldId: 'account',
                                line: l
                            });
                            total = payment.getSublistValue({
                                sublistId: 'line',
                                fieldId: 'debit',
                                line: l
                            });
                        }
                    }
                }
                log.debug('Payment Info', {
                    account: accountId,
                    relatedAccount: relatedAccountId,
                    cashAccount: cashAccount,
                    total: total
                });
                if (!accountId || !relatedAccountId || !cashAccount) {
                    // Something not quite right with this
                    // TODO: error??
                    log.debug('NO ACCOUNT OR RELATED ACCOUNT', {
                        account: accountId,
                        relatedAccount: relatedAccountId,
                        cashAccount: cashAccount,
                        total: total
                    });
                    return;
                }

                // Now we need to know the subsidiary for the related account
                var relatedAccountInfo = search.lookupFields({
                    type: search.Type.ACCOUNT,
                    id: relatedAccountId,
                    columns: ['custrecord_bb_ic_cc_account', 'subsidiary']
                });
                log.debug('Loan Account Info', relatedAccountInfo);

                var icccId = setICCValues(iccc, relatedAccountInfo, payment, relatedAccountId, total, cashAccount);

                // update the payment with the related transaction
                record.submitFields({
                    type: payment.type,
                    id: payment.id,
                    values: {
                        custbody_bb_related_transaction: icccId
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                log.debug('Transactions complete');
            }

        }


        /**
          * Function removes al the lines of already existing ICC record
          * 
          * @governance 0 Units
          * @param {Object} iccc - ICC record
          */
        function removeLinesFromICCRec(iccc) {
            var linesInICC = iccc.getLineCount({
                sublistId: 'line'
            });
            log.debug('linesInICC before', linesInICC);
            for (var line = linesInICC; line > 0; line--) {
                iccc.removeLine({
                    sublistId: 'line',
                    line: line - 1,
                    ignoreRecalc: true
                });
            }

        }

        /**
          * Function sets the value in the ICC record before saving it.
          * 
          * @governance 10 Units
          * @param {Object} iccc - ICC record
          * @param {Object} relatedAccountInfo - relatedAccountInfo
          * @param {Object} payment - payment record
          * @param {String} relatedAccountId - relatedAccountId
          * @param {String} total - total amount
          * @param {String} cashAccount - cashAccount 
          * 
          * @param {String} iccc - ICC id 
          */
        function setICCValues(iccc, relatedAccountInfo, payment, relatedAccountId, total, cashAccount) {
            // subsidiary is the "loan account holder"
            iccc.setValue({ fieldId: "subsidiary", value: relatedAccountInfo.subsidiary[0].value });
            iccc.setValue({ fieldId: "custbody_bb_related_transaction", value: payment.id });
            iccc.setValue({ fieldId: "custbody_bb_ic_cc_subsidiary", value: payment.getValue({ fieldId: "subsidiary" }) });
            iccc.setValue({ fieldId: "trandate", value: payment.getValue({ fieldId: "trandate" }) });

            // set the journal lines
            iccc.selectNewLine({ sublistId: 'line' });
            log.debug('relatedAccountId set', relatedAccountId);
            iccc.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                value: relatedAccountId,
                ignoreFieldChange: false
            });
            iccc.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'credit',
                value: total,
                ignoreFieldChange: false
            });
            iccc.commitLine({ sublistId: 'line' });

            iccc.selectNewLine({ sublistId: 'line' });
            log.debug('cashAccount set', cashAccount);
            iccc.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'account',
                value: cashAccount, // this field should be verified by client script
                ignoreFieldChange: false
            });
            iccc.setCurrentSublistValue({
                sublistId: 'line',
                fieldId: 'debit',
                value: total,
                ignoreFieldChange: false
            });
            iccc.commitLine({ sublistId: 'line' });

            var icccId = iccc.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.audit('IC-CC Created', 'customtransaction_bb_ic_cc:' + icccId);
            return icccId;
        }

        return {
            afterSubmit: afterSubmit
        };
    });