/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/query'],

function(record, search, runtime, query) {
	var DATE_TYPE = 'DATE';
	var INTEGER_TYPE = 'INTEGER';
	var LONG_TEXT_TYPE = 'CLOBTEXT';
	var TEXT_TYPE = 'TEXT';

	/**
	 * Definition of the Workflow Action script trigger point.
	 * This function will add all the supporting elements to Project and an independent saved search
	 *
	 * @param {Object} scriptContext
	 * @param {Record} scriptContext.newRecord - New record
	 * @Since 2016.1
	 */
	function onAction_AddActionGroupElementsToProject(scriptContext) {
		var actionGroup = scriptContext.newRecord;
		var actionGroupId = actionGroup.id;
		var name = actionGroup.getValue({
			fieldId : 'name'
		});
		var thisScript = runtime.getCurrentScript();
		var parentTab = thisScript.getParameter({
			name : 'custscript_bb_parent_tab'
		});
		var savedSearchId = thisScript.getParameter({
			name : 'custscript_bb_saved_search_to_copy'
		});
		try {
			var newTabId = createNewSubTab(name, parentTab, actionGroup);
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'status', 'Status', TEXT_TYPE, true, 'custrecord_bb_act_group_status_id');
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'start_date', 'Start Date', DATE_TYPE, true, 'custrecord_bb_act_group_start_date_id');
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'end_date', 'End Date', DATE_TYPE, true, 'custrecord_bb_act_group_end_date_id');
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'last_mod_date', 'Last Modified Date', DATE_TYPE, true, 'custrecord_bb_act_group_last_mod_date_id');
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'duration', 'Duration', INTEGER_TYPE, true, 'custrecord_bb_act_group_duration_id');
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'comments', 'Comments', LONG_TEXT_TYPE, false);
			createEntityFields(actionGroup, name, actionGroupId, newTabId, 'comment_history', 'Comment History', LONG_TEXT_TYPE, false);
			actionGroup.setValue({
				fieldId : 'custrecord_bb_all_elements_created',
				value : true
			});
		}
		catch (e) {
			log.error('error', e);
		}
	}

	/**
	 * Create the Subtab based on the Action Group Name where the user clicks on the button
	 * @param{String} name: the name of the Action Group
	 * @param{String} parentTab: the parentTab internal Id specified by the user in the workflow
	 * @return {String} the ID of the Action Group Subtab
	 */
	function createNewSubTab(name, parentTab, actionGroup) {
		var newSubTab = record.create({
			type : 'subtab'
		});
		newSubTab.setValue({
			fieldId : 'tabtype',
			value : 'ENTITY'
		});
		newSubTab.setValue({
			fieldId : 'title',
			value : name
		});
		newSubTab.setValue({
			fieldId : 'parent',
			value : parentTab
		});
		var subtabId = newSubTab.save();
		actionGroup.setValue({
			fieldId: 'custrecord_bb_act_group_subtab_id',
			value: subtabId
		});
		return subtabId;
	}

	/**
	 * Create the Entity Fields for the newly created Action Group Subtab
	 * @param{String} actionGroup: the Action Group record
	 * @param{String} name: the name of the Action Group
	 * @param{String} newTabId: the new subtab internal Id
	 * @param{String} fieldId: the fieldId for the Entity Field
	 * @param{String} fieldName: the name of the Entity Field
	 * @param{String} fieldType: the type of the Entity Field
	 * @param{Boolean} toUpdate: an indicator to show whether to update the Action Group fields with the newly created field IDs on Project
	 * @param{String} actionGroupField: the field Id on Action Group to be updated with the value of field Id on Project
	 * @return{String} the newly created field ID
	 */
	function createEntityFields(actionGroup, name, actionGroupId, newTabId, fieldId, fieldName, fieldType, toUpdate, actionGroupField) {
		var newEntityField = record.create({
			type : 'entitycustomfield'
		});

		newEntityField.setValue({
			fieldId : 'label',
			value : name + ' ' + fieldName
		});

		var newFieldId = '_actgrp_' + actionGroupId + '_' + fieldId;
		newEntityField.setValue({
			fieldId : 'scriptid',
			value : newFieldId
		});

		newEntityField.setValue({
			fieldId : 'appliestoproject',
			value : true
		});

		newEntityField.setValue({
			fieldId : 'fieldtype',
			value : fieldType
		});
		if(fieldId == 'comments'){
			newEntityField.setValue({
				fieldId : 'displaytype',
				value : 'NORMAL'
			});
		}
		else{
			newEntityField.setValue({
				fieldId : 'displaytype',
				value : 'STATICTEXT'
			});
		}
		newEntityField.setValue({
			fieldId : 'subtab',
			value : newTabId
		});
		var newField = newEntityField.save();
		if(toUpdate){
			actionGroup.setValue({
				fieldId : actionGroupField,
				value : 'custentity'+newFieldId
			});
		}
		return newField;
	}

	return {
		onAction : onAction_AddActionGroupElementsToProject
	};

});
