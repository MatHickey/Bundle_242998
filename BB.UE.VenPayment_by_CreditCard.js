/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *
 * Deployed to Vendor Payment
 */

define(['N/record', 'N/search'],
	function (record, search) {

		/**
		  * Function creates ICC through Vendor Bill Payment
		  * 
		  * @governance 0 Units
		  * @param {Object} context - context of the request
		  * @param {Object} newRecord - new project record
		  */
		function afterSubmit(scriptContext) {
			var subsidiaryEnabled = search.lookupFields({
				type: 'customrecord_bb_solar_success_configurtn',
				id: '1',
				columns: ['custrecord_bb_ss_has_subsidiaries']
			});

			
			if (scriptContext.type != 'create' && scriptContext.type != 'edit') return;
			if(!subsidiaryEnabled.custrecord_bb_ss_has_subsidiaries) return;
			var payment = scriptContext.newRecord;

			// check if the IC-CC is already created
			var icccId = payment.getValue({ fieldId: 'custbody_bb_related_transaction' });
			var iccc = null;
			if (icccId) {
				log.debug('in icccid')
				var newAcc = scriptContext.newRecord.getValue({
					fieldId: 'account'
				})
				var oldAcc = scriptContext.oldRecord.getValue({
					fieldId: 'account'
				})

				if (newAcc != oldAcc) {
					log.debug('in diff acc')
					var newRelatedAccountICAccSub = search.lookupFields({
						type: search.Type.ACCOUNT,
						id: newAcc,
						columns: ['custrecord_bb_ic_cc_account.subsidiary']
					});//get subsidiary of the relatd ic account of this acc. //1 unit

					var oldRelatedAccountICAccSub = search.lookupFields({
						type: search.Type.ACCOUNT,
						id: oldAcc,
						columns: ['custrecord_bb_ic_cc_account.subsidiary']
					});//get subsidiary of the relatd ic account of this acc. //1 unit
					log.debug('newRelatedAccountICAccSub', newRelatedAccountICAccSub['custrecord_bb_ic_cc_account.subsidiary'][0].value);

					log.debug('oldRelatedAccountICAccSub', oldRelatedAccountICAccSub['custrecord_bb_ic_cc_account.subsidiary'][0].value);

					if (newRelatedAccountICAccSub['custrecord_bb_ic_cc_account.subsidiary'][0].value != oldRelatedAccountICAccSub['custrecord_bb_ic_cc_account.subsidiary'][0].value) {
						record.delete({
							type: 'customtransaction_bb_ic_cc',
							id: icccId,
						});// 10 units

						iccc = record.create({
							type: 'customtransaction_bb_ic_cc',
							isDynamic: true
						});//5 units
					} else {
						log.debug('in same sub');
						iccc = record.load({
							type: 'customtransaction_bb_ic_cc',
							id: icccId,
							isDynamic: true,
						});// 5 units

						removeLinesFromICCRec(iccc);

					}


				}

			} else {
				log.debug('ic empty')
				iccc = record.create({
					type: 'customtransaction_bb_ic_cc',
					isDynamic: true
				});//5 units
			}

			var accountId = payment.getValue({ fieldId: 'account' });
			var accountInfo = search.lookupFields({
				type: search.Type.ACCOUNT,
				id: accountId,
				columns: ['custrecord_bb_ic_cc_account', 'subsidiary']
			});// 1 units
			log.debug('Payment Account Info', accountInfo);
			// look if the account has a related account
			var relatedAccount = accountInfo.custrecord_bb_ic_cc_account[0];
			if (!relatedAccount) {
				log.debug('NO RELATED ACCT', 'Exit script - no related account listed for IC-CC');

				return;
			}

			// Now we need to know the subsidiary for the related account
			var relatedAccountInfo = search.lookupFields({
				type: search.Type.ACCOUNT,
				id: relatedAccount.value,
				columns: ['custrecord_bb_ic_cc_account', 'subsidiary']
			});// 1 units
			log.debug('Loan Account Info', relatedAccountInfo);

			// set the IC-CC values(customtransaction_bb_ic_cc)
			log.debug('creating IC-CC record');
			var icccId = setICCValues(iccc, relatedAccountInfo, payment)

			// update the payment with the related transaction
			record.submitFields({
				type: record.Type.VENDOR_PAYMENT,
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
		  * 
		  * @param {String} iccc - ICC id 
		  */
		function setICCValues(iccc, relatedAccountInfo, payment) {
			var linesInICC = iccc.getLineCount({
				sublistId: 'line'
			});
			log.debug('linesInICC before setting values', linesInICC);
			// subsidiary is the "loan account holder"
			iccc.setValue({ fieldId: "subsidiary", value: relatedAccountInfo.subsidiary[0].value });
			iccc.setValue({ fieldId: "custbody_bb_related_transaction", value: payment.id });
			iccc.setValue({ fieldId: "custbody_bb_ic_cc_subsidiary", value: payment.getValue({ fieldId: "subsidiary" }) });
			iccc.setValue({ fieldId: "trandate", value: payment.getValue({ fieldId: "trandate" }) });

			var total = payment.getValue({ fieldId: "total" });

			// set the journal lines
			iccc.selectNewLine({ sublistId: 'line' });
			iccc.setCurrentSublistValue({
				sublistId: 'line',
				fieldId: 'account',
				value: relatedAccountInfo.custrecord_bb_ic_cc_account[0].value,
				ignoreFieldChange: false
			});
			iccc.setCurrentSublistValue({
				sublistId: 'line',
				fieldId: 'debit',
				value: total,
				ignoreFieldChange: false
			});
			iccc.commitLine({ sublistId: 'line' });

			iccc.selectNewLine({ sublistId: 'line' });
			iccc.setCurrentSublistValue({
				sublistId: 'line',
				fieldId: 'account',
				value: payment.getValue({ fieldId: "custbody_bb_ic_cc_account" }), // this field should be verified by client script
				ignoreFieldChange: false
			});
			iccc.setCurrentSublistValue({
				sublistId: 'line',
				fieldId: 'credit',
				value: total,
				ignoreFieldChange: false
			});
			iccc.commitLine({ sublistId: 'line' });

			var icccId = iccc.save({
				enableSourcing: true,
				ignoreMandatoryFields: true
			});// 10 units

			log.audit('IC-CC Created', 'customtransaction_bb_ic_cc:' + icccId);

			return icccId;
		}

		return {
			afterSubmit: afterSubmit
		};
	});