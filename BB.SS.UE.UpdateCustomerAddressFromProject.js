/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],

function(record, search) {
	var ADDRESS_1 = 'custentity_bb_install_address_1_text';
	var ADDRESS_2 = 'custentity_bb_install_address_2_text';
	var CITY = 'custentity_bb_install_city_text';
	var STATE = 'custentity_bb_install_state';
	var ZIP = 'custentity_bb_install_zip_code_text';
	var HOME_OWNER = 'custentity_bb_home_owner_name_text';
	var PHONE = 'custentity_bb_home_owner_phone';
	var EMAIL = 'custentity_bb_home_owner_primary_email';
	var SPOUSE = 'custentity_bb_spouse_name';

	/**
	 * Function definition to be triggered before record is loaded.
	 *
	 * @param {Object} scriptContext
	 * @param {Record} scriptContext.newRecord - New record
	 * @param {Record} scriptContext.oldRecord - Old record
	 * @param {string} scriptContext.type - Trigger type
	 * @Since 2015.2
	 */
	function afterSubmit_UpateCustomerAddress(scriptContext) {
		if (scriptContext.type == 'edit') {
			var project = scriptContext.newRecord;
			var oldProject = scriptContext.oldRecord;
			var oldProjObj = gatherOldProjectInfo(oldProject);
			log.debug('oldProjObj', oldProjObj);
			var values = getNewValues(project);
			log.debug('values', values);
			var valuesToUpdate = updateFlag(oldProjObj, values);
			log.debug('valuesToUpdate', valuesToUpdate);
			if(valuesToUpdate.updateAddress || valuesToUpdate.updatePhone || valuesToUpdate.updateEmail || valuesToUpdate.updateSpouse){
				var parentCustomerId = project.getValue({
					fieldId : 'custentity_bb_homeowner_customer'
				});
				setNewValuesOnCustomer(parentCustomerId, values, valuesToUpdate); // 20 units
				setChildCustomerValues(searchChildCustomer(parentCustomerId), values, valuesToUpdate); // 20 units per child
			}
		}
	}

	/**
	 * Function that gathers the old record's field values
	 *
	 * @param{Record} oldProject: the Old Record from the scriptContext
	 * @return{Object} oldProjObj: the triggering field values in an Objects
	 */
	function gatherOldProjectInfo(oldProject) {
		var oldProjObj = {};
		oldProjObj = {
			address1 : oldProject.getValue({
				fieldId : ADDRESS_1
			}),
			address2 : oldProject.getValue({
				fieldId : ADDRESS_2
			}),
			city : oldProject.getValue({
				fieldId : CITY
			}),
			state : oldProject.getValue({
				fieldId : STATE
			}),
			zip : oldProject.getValue({
				fieldId : ZIP
			}),
			homeOnwerName: oldProject.getValue({
				fieldId: HOME_OWNER
			}),
			phone: oldProject.getValue({
				fieldId: PHONE
			}),
			email: oldProject.getValue({
				fieldId: EMAIL
			}),
			spouse: oldProject.getValue({
				fieldId: SPOUSE
			}),
		};
		return oldProjObj;
	}

	/**
	 * Verify if the following fields are being updated by comparing the old and new record fields
	 * If updated, trigger the next functionality
	 * Else, do nothing
	 *
	 * @param{Object} oldProjObj: the field values from old record
	 * @param{Object} newValues: the field values from new record
	 * @return{Object}
	 */
	function updateFlag(oldProjObj, newValues){
		var updateValues = {};
		updateValues.updateAddress = false;
		updateValues.updateEmail = false;
		updateValues.updatePhone = false;
		updateValues.updateSpouse = false;
		if(oldProjObj.address1 != newValues.address1 ||
	       oldProjObj.address2 != newValues.address2 ||
	       oldProjObj.city != newValues.city ||
	       oldProjObj.state != newValues.state ||
	       oldProjObj.zip != newValues.zip ||
	       oldProjObj.homeOnwerName != newValues.homeOnwerName){
					 updateValues.updateAddress = true;
		}
		if (oldProjObj.phone != newValues.phone){
			updateValues.updatePhone = true;
		}
		if (oldProjObj.email != newValues.email){
			updateValues.updateEmail = true;
		}
		if (oldProjObj.spouse != newValues.spouse){
			updateValues.updateSpouse = true;
		}
		return updateValues;
	}


	/**
	 * Get the newly updated address from project
	 */
	function getNewValues(project) {
		var values = {};
		values = {
			address1 : project.getValue({
				fieldId : ADDRESS_1
			}),
			address2 : project.getValue({
				fieldId : ADDRESS_2
			}),
			city : project.getValue({
				fieldId : CITY
			}),
			state : project.getValue({
				fieldId : STATE
			}),
			zip : project.getValue({
				fieldId : ZIP
			}),
			homeOnwerName: project.getValue({
				fieldId: HOME_OWNER
			}),
			phone:  project.getValue({
				fieldId: PHONE
			}),
			email: project.getValue({
			 fieldId: EMAIL
		 }),
		  spouse: project.getValue({
			fieldId: SPOUSE
		})
		};
		return values;
	}

	/**
	 * Set address on Customer record
	 */
	function setNewValuesOnCustomer(customerId, values, valuesToUpdate) {
		var customer = record.load({
			type : record.Type.CUSTOMER,
			id : customerId
		});

		if (valuesToUpdate.updateAddress){
			customer.setValue({
				fieldId : ADDRESS_1,
				value : values.address1
			});
			customer.setValue({
				fieldId : ADDRESS_2,
				value : values.address2
			});
			customer.setValue({
				fieldId : CITY,
				value : values.city
			});
			customer.setValue({
				fieldId : STATE,
				value : values.state
			});
			customer.setValue({
				fieldId : ZIP,
				value : values.zip
			});
			customer.setValue({
				fieldId: HOME_OWNER,
				value: values.homeOnwerName
			});
			var hasParent = customer.getValue({
				fieldId : 'hasparent'
			});
			if (hasParent) {
				customer.setValue({
					fieldId : 'companyname',
					value : concateAddress(values)
				});
			}
		}
		if (valuesToUpdate.updatePhone){
			customer.setValue({
				fieldId : PHONE,
				value : values.phone
			});
		}
		if (valuesToUpdate.updateEmail){
			customer.setValue({
				fieldId : EMAIL,
				value : values.email
			});
		}
		if (valuesToUpdate.updateSpouse){
			customer.setValue({
				fieldId : SPOUSE,
				value : values.spouse
			});
		}
		try {
			customer.save();
		}
		catch (e) {
			log.error(e);
		}
	}

	/**
	 * Form the company name for child customer based on new address
	 */
	function concateAddress(address) {
		var companyName = '';
		var stateName = search.lookupFields({
			type : 'customrecord_bb_state',
			id : address.state,
			columns : ['custrecord_bb_state_full_name_text']
		}).custrecord_bb_state_full_name_text;
		companyName = address.address1 + ' ' + address.address2 + ' ' + address.city + ' ' + stateName + ' ' + address.zip;
		return companyName;
	}

	/**
	 * Search for all the child customers belong to the parent customer
	 */
	function searchChildCustomer(parentCustomerId) {
		var childCustomers = [];
		var customerSearchObj = search.create({
			type : 'customer',
			filters : [['parentcustomer.internalid', 'anyof', parentCustomerId]],
			columns : [search.createColumn({
				name : 'internalid'
			})]
		});
		customerSearchObj.run().each(function(result) {
			childCustomers.push(result.id);
			return true;
		});
		return childCustomers;
	}

	/**
	 * Set child customers' address
	 */
	function setChildCustomerValues(childCustomers, values, valuesToUpdate) {
		for (var i = 0; i < childCustomers.length; i++) {
			var customerId = childCustomers[i];
			setNewValuesOnCustomer(customerId, values, valuesToUpdate);
		}
	}

	return {
		afterSubmit : afterSubmit_UpateCustomerAddress
	};

});
