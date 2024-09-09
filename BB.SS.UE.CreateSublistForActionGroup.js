/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search) {
	var SAVED_SEARCH_ID_FIELD = 'custrecord_bb_act_group_search_id';
	/**
	 * Create Custom sublist with the saved search Internal ID updated on the Action Group
	 *
	 * @param {Object} scriptContext
	 * @param {Record} scriptContext.newRecord - New record
	 * @param {Record} scriptContext.oldRecord - Old record
	 * @param {string} scriptContext.type - Trigger type
	 * @governace - 20 units
	 * @Since 2015.2
	 */
	function afterSubmit_CreateSublistForActionGroup(scriptContext) {
		var actionGroup = scriptContext.newRecord;
		var oldRecord = scriptContext.oldRecord;
		var subtabId = actionGroup.getValue({
			fieldId : 'custrecord_bb_act_group_subtab_id'
		});
		var name = actionGroup.getValue({
			fieldId : 'name'
		});
		var newSearchId = actionGroup.getValue({
			fieldId : SAVED_SEARCH_ID_FIELD
		});
		var oldSearchId;
		if(oldRecord){
			oldSearchId = oldRecord.getValue({
				fieldId : SAVED_SEARCH_ID_FIELD
			});
		}
		if (newSearchId && newSearchId != oldSearchId) {
			createSublistRecord(newSearchId, subtabId, name); // 
		}
	}

	/**
	 * Create custom sublist record with specific search and tab
	 * @param{String} newSearchId
	 * @param{String} subtabId
	 * @param{String} name
	 * @governance - 20 units
	 */
	function createSublistRecord(newSearchId, subtabId, name) {
		var sublist = record.create({ // 10 units
			type : 'sublist'
		});
		sublist.setValue({
			fieldId : 'tab',
			value : subtabId
		});
		sublist.setValue({
			fieldId : 'sublisttype',
			value : 'ENTITY'
		});
		sublist.setValue({
			fieldId : 'savedsearch',
			value : newSearchId
		});
		sublist.setValue({
			fieldId : 'label',
			value : name
		});
		sublist.setValue({
			fieldId : 'job',
			value : true
		});
		try {
			sublist.save(); // 10 units
		}
		catch (e) {
			log.error('INVALID_SEARCH_INTERNAL_ID', 'FAIL TO CREATE SUBLIST.\nPlease very Saved Search Internal ID on Action Group ' + name);
		}

	}

	return {
		afterSubmit : afterSubmit_CreateSublistForActionGroup
	};

});
