/**
 * @NApiVersion 2.0
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @author Graham O'Daniel
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define([ 'N/runtime'], function(runtime) {
	function onAction(context) {
		log.debug('onAction', context.type);
		var script = runtime.getCurrentScript();
		var leadId = script.getParameter('custscript_bb_ss_leadid');
		if (!leadId) return;
		log.debug('leadId', leadId);

		var transformer = transform.Transformer.getTransformer('lead', 'customer');
		var customer = transformer.transform(leadId);
		return customer.internalId;
	}

	return {
		onAction: onAction
	};
});