/**
 * @NApiVersion 2.0
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @version 17.2.0
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

define(['./BB SS/SS Lib/BB_SS_MD_SolarConfig', 'N/runtime'], function(config, runtime) {
	function onAction(scriptContext) {
		var scriptObj = runtime.getCurrentScript();
		
		var fieldId = scriptObj.getParameter({
			name: 'custscript_bb_ss_wf_configfieldid'
		});
		
		var fieldValue = config.getConfiguration(fieldId);
		log.debug('GetSolarConfig WF Action FieldValue', fieldValue);
		log.debug('GetSolarConfig WF Action eval', fieldValue.value || util.isBoolean(fieldValue.value) || util.isNumber(fieldValue.value) ? fieldValue.value : fieldValue.text);

		return fieldValue.text || util.isBoolean(fieldValue.value) || util.isNumber(fieldValue.value) ? fieldValue.value : '';
//		return fieldValue.value || util.isBoolean(fieldValue.value) || util.isNumber(fieldValue.value) ? fieldValue.toString() : '';
	}
	
	return {
		onAction: onAction
	}
});