/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search'],

function(record, search) {
   
    function beforeSubmit(scriptContext){
    	try {
	    	var transaction = scriptContext.newRecord;
	    	var transType = scriptContext.newRecord.type;
	    	log.debug('transaction type', transType);
	    	var id = transaction.id;
	    	var milestoneId = transaction.getValue({fieldId: 'custbody_bb_milestone'});
	    	var projectId = transaction.getValue({fieldId: 'custbody_bb_project'});
	    	var accountingMethod = transaction.getValue({fieldId: 'custbody_bb_project_acctg_method'});
	    	var parentId = transaction.getValue({fieldId: 'custbody_bbss_adv_payschedlist'});
			var advScheduleCount = getProjectADVScheduleCount(projectId);
            log.debug('milestone', milestoneId);
          	log.debug('projectId', projectId);
          	log.debug('accountingMethod', accountingMethod);
	    	if (accountingMethod == 5 && milestoneId && projectId && transType == 'invoice') {
				var includeDownPayment = shouldIncludeDownPayment(parentId, milestoneId);
	    		var deferralJe = canDeferInvMilestoneRecognition(projectId, milestoneId, id, parentId, advScheduleCount, includeDownPayment);
	    		if (deferralJe) {
	    			transaction.setValue({
	    				fieldId: 'custbody_bb_adv_pay_recognition_je',
	    				value: deferralJe
	    			});
	    		}
	    	}
	    	if (accountingMethod == 5 && milestoneId && projectId && transType != 'invoice') {
				var otherDeferralJe = checkOtherTransactionForDeferral(projectId, milestoneId);
				if (otherDeferralJe) {
					transaction.setValue({
						fieldId: 'custbody_bb_adv_pay_recognition_je',
						value: otherDeferralJe
					});
				}
			}
		} catch (e) {
			log.error('error checking milestone recognition deferral', e);
		}	
    }

    function canDeferInvMilestoneRecognition(projectId, milestoneId, transactionId, parentId, advScheduleCount, includeDownPayment) {
		var recognitionJe = null;
		var invRecognizedLines = [];
		var unRecognizedLines = [];
    	var filters = [["custrecord_bbss_adv_subpay_schedule.custrecord_bbss_advpay_project_list","anyof", projectId]];

    	filters.push("AND", ["custrecord_bbss_adv_subpay_milestone","anyof", milestoneId])

		if (advScheduleCount > 1 && parentId) {
			log.debug('pushing parent id');
			filters.push("AND", ["custrecord_bbss_adv_subpay_schedule","anyof", parentId])
		}
    	var customrecord_bbss_adv_sub_pay_scheduleSearchObj = search.create({
		   	type: "customrecord_bbss_adv_sub_pay_schedule",
		   	filters: filters,
		   	columns:
		   	[
		      	search.createColumn({name: "internalid", label: "Internal ID"}),
		      	search.createColumn({name: "custrecord_bbss_adv_subpay_milestone", label: "Milestone"}),
		      	search.createColumn({
		        	name: "custrecord_bbss_adv_subpay_trans_type",
		         	sort: search.Sort.DESC,
		         	label: "Transaction Type"
		      	}),
		      	search.createColumn({name: "custrecord_bbss_adv_subpay_schedule", label: "Payment Schedule"}),
		      	search.createColumn({name: "custrecord_bbss_adv_subpay_recog_je_type", label: "Recognition JE Type"}),
		      	search.createColumn({name: "custrecord_bbss_adv_subpay_transaction", label: "Transaction"}),
		      	search.createColumn({name: "custrecord_bbss_adv_subpay_recog_je", label: "Recognition JE"}),
		      	search.createColumn({name: "custrecord_bbss_adv_subpay_project", label: "Project"}),
				search.createColumn({name: "custrecord_bbss_adv_subpay_amount", label: "Amount"}),
				search.createColumn({name: "custrecord_bbss_adv_subpay_trans_total", label: "Transaction Total"})
		   	]
		});
		var searchResultCount = customrecord_bbss_adv_sub_pay_scheduleSearchObj.runPaged().count;
		log.debug("customrecord_bbss_adv_sub_pay_scheduleSearchObj result count",searchResultCount);
		customrecord_bbss_adv_sub_pay_scheduleSearchObj.run().each(function(result){
		   	if (result.getValue({name: 'custrecord_bbss_adv_subpay_recog_je'})) {
				recognitionJe = result.getValue({name: 'custrecord_bbss_adv_subpay_recog_je'});
			}
		   	var recJe = result.getValue({name: 'custrecord_bbss_adv_subpay_recog_je'});
		   	var tranId = parseInt(result.getValue({name: 'custrecord_bbss_adv_subpay_transaction'}));
		   	var transType = result.getValue({name: 'custrecord_bbss_adv_subpay_trans_type'});
		   	log.debug('recJe', recJe);
			log.debug('tranId', tranId);
			log.debug('transType', transType);
		   	if (tranId && recJe && transType == 7 && transactionId == tranId) {
				invRecognizedLines.push(tranId);
			} else if (tranId && !recJe && transType == 7 && transactionId == tranId) {
		   		unRecognizedLines.push(tranId)
			}
		   	return true;
		});
		log.debug('invRecognizedLines', invRecognizedLines);
		log.debug('unRecognizedLines', unRecognizedLines);

		var recogIndex = invRecognizedLines.indexOf(parseInt(transactionId));
		var unrecogIndex = unRecognizedLines.indexOf(parseInt(transactionId));
		log.debug('recogIndex', recogIndex);
		log.debug('unrecogIndex', unrecogIndex);
		log.debug('recognitionJe', recognitionJe);
		if (recognitionJe && unrecogIndex != -1 && recogIndex == -1) {
			return recognitionJe;
		}

    }


	function getProjectADVScheduleCount(projectId) {
		var resultCount = 0;
		if (projectId) {
			var customrecord_bbss_adv_payment_scheduleSearchObj = search.create({
				type: "customrecord_bbss_adv_payment_schedule",
				filters:
					[
						["custrecord_bbss_advpay_project_list", "anyof", projectId]
					],
				columns:
					[
						search.createColumn({name: "internalid", label: "Internal ID"})
					]
			});
			resultCount = customrecord_bbss_adv_payment_scheduleSearchObj.runPaged().count;
			log.debug("advanced payment schedule record count by project", resultCount);
		}
		return resultCount;
	}


	function checkOtherTransactionForDeferral(projectId, milestoneId) {
    	var recogntionJe = null;
    	if (projectId && milestoneId) {
			var customrecord_bbss_adv_sub_pay_scheduleSearchObj = search.create({
				type: "customrecord_bbss_adv_sub_pay_schedule",
				filters:
					[
						["custrecord_bbss_adv_subpay_project","anyof",projectId],
						"AND",
						["custrecord_bbss_adv_subpay_milestone","anyof",milestoneId],
						"AND",
						["custrecord_bbss_adv_subpay_recog_je","noneof","@NONE@"]
					],
				columns:
					[
						search.createColumn({name: "internalid", label: "Internal ID"}),
						search.createColumn({name: "custrecord_bbss_adv_subpay_transaction", label: "Transaction"}),
						search.createColumn({name: "custrecord_bbss_adv_subpay_recog_je", label: "Recognition JE"}),
						search.createColumn({name: "custrecord_bbss_adv_subpay_recog_je_type", label: "Recognition JE Type"})
					]
			});
			var searchResultCount = customrecord_bbss_adv_sub_pay_scheduleSearchObj.runPaged().count;
			log.debug("customrecord_bbss_adv_sub_pay_scheduleSearchObj result count",searchResultCount);
			customrecord_bbss_adv_sub_pay_scheduleSearchObj.run().each(function(result){
				recogntionJe = result.getValue({name: 'custrecord_bbss_adv_subpay_recog_je'});
				return true;
			});
		}
    	return recogntionJe;
	}


	function shouldIncludeDownPayment(paymentScheduleId, milestoneId) {
		log.debug('paymentScheduleId', paymentScheduleId);
		log.debug('milestoneId', milestoneId);
		var includeDownPayment = false;
		var downPaymentRecognized = false;
		var customrecord_bbss_adv_sub_pay_scheduleSearchObj = search.create({
			type: "customrecord_bbss_adv_sub_pay_schedule",
			filters:
				[
					["custrecord_bbss_adv_subpay_schedule","anyof", paymentScheduleId]
				],
			columns:
				[
					search.createColumn({
						name: "custrecord_bbss_adv_subpay_milestone",
						summary: "GROUP",
						sort: search.Sort.ASC,
						label: "Milestone"
					}),
					search.createColumn({
						name: "formulanumeric",
						summary: "GROUP",
						formula: "{custrecord_bbss_adv_subpay_recog_je.id}"
					})
				]
		});
		customrecord_bbss_adv_sub_pay_scheduleSearchObj.run().each(function(result){
			var milestone = result.getValue({name: 'custrecord_bbss_adv_subpay_milestone', summary: 'GROUP'});
			var recognitionJe = result.getValue({name: 'formulanumeric', summary: 'GROUP', formula: '{custrecord_bbss_adv_subpay_recog_je.id}'});
			log.debug('recognitionJe type of', typeof recognitionJe);
			log.debug('recognitionJe', recognitionJe);
			if (milestone == 12 && isNotNull(recognitionJe)) {
				downPaymentRecognized = true;
			} else if (milestone == milestoneId && milestone != 12 && !downPaymentRecognized) {
				includeDownPayment = true;
			}
			return true;
		});
		log.debug('downPaymentRecognized', downPaymentRecognized);
		log.debug('includeDownPayment', includeDownPayment);
		if (!downPaymentRecognized && includeDownPayment) {
			return true;
		} else {
			return false;
		}
	}

	function isNotNull(param) {
		return param != null && param != '' && param != undefined;
	}

    return {
        beforeSubmit: beforeSubmit
    };
    
});