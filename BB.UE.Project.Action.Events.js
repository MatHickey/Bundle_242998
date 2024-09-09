/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author Matt Lehman
 * @version 0.1.1
 * @fileOverview This user event script updates the Project dates based on updates from the Project Actions
 * It also updates related project actions to approved if milestone completed
 */
/**
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */
define(['N/record', 'N/search', 'N/runtime', 'N/https', 'N/task', 'N/query', './BB SS/SS Lib/BB_SS_MD_SolarConfig', './BB SS/SS Lib/BB.SS.Invoice.Service', './BB SS/SS Lib/BB.SS.VendorBill.Service', './BB SS/SS Lib/BB.SS.MD.GenerateMilestoneTransactionsLib', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing', './BB SS/SS Lib/BB.SS.DocumentStatus.Service', 'N/ui/serverWidget', './BB SS/SS Lib/BB.SS.MD.ProjectActionCustomLists', './BB SS/SS Lib/BB.MD.AdvPaymentModules'],
	function(record, search, runtime, https, task, query, solarConfig, invoiceService, vendorBillService, milestoneLib, batchProcessor, documentStatusService, serverWidget, projActionLib, advpay) {
		var NOT_INITIATED_STATUS_TYPE = '1'; // status type for Not Initiated status is 1
		var APPROVED_STATUS_TYPE = '4'; //status type for Approved status is 4
		var ACTION_STATUS_TYPE_FIELD = 'custrecord_bb_action_status_type';
		var IS_REQUIRED = 1;
		var ACTION_GROUP_TYPE = 'CUSTRECORD_BB_PACKAGE';
		var EXTEMPT_PROJ_STATUS = ['3', '4', '5', '6', '7', '8'];
		var ACTION_STATUS_FIELD = 'custrecord_bb_document_status';

		function beforeLoad(context) {
			// hide field functionality
			try {
				var actionTemplate = context.newRecord.getValue({fieldId: 'custrecord_bb_project_package_action'});
				if (actionTemplate) {
					var actionTemplateSearch = search.create({
						type: "customrecord_bb_package_task",
						filters:
							[["internalid", "anyof", actionTemplate]],
						columns: ["custrecord_bb_action_template_hide"]
					});
					var result = actionTemplateSearch.run().getRange({start: 0, end: 1});
					if (result[0].getValue({name: 'custrecord_bb_action_template_hide'})) {
						var hideFieldValues = result[0].getValue({name: 'custrecord_bb_action_template_hide'});
						var sql = "SELECT * " +
							" from customfield WHERE internalid NOT IN (" + hideFieldValues + ")";
						var results = query.runSuiteQL({query: sql}).asMappedResults();
						if (results.length > 0) {
							for (var h = 0; h < results.length; h++) {
								var field = context.form.getField({
									id: results[h].scriptid.toLowerCase()
								});
								if (field) {
									field.updateDisplayType({
										displayType: serverWidget.FieldDisplayType.HIDDEN
									});
								}
							}
						}
					}
				}
			} catch (e) {
				log.error('error hiding fields on project actions', e);
			}
			setDocumentManagerFolder(context);
			//var project = getProject(context);
			var configId = searchFirstActiveConfig();
			log.debug('config Id', configId);
			if (!configId) {
				log.error('NO_CONFIG_FOUND', 'Please contact Admin to have at least one active Solar Success Configuration record.');
				return;
			}
			var configLookUp = search.lookupFields({
				type: 'customrecord_bb_solar_success_configurtn',
				id: configId,
				columns: ['custrecord_bb_uses_proj_actn_tran_schdl', 'custrecord_bb_create_project_task', 'custrecord_bb_roles_hide_new_rev']
			});
			//add sublists for project action transaction schedule and predecessor tasks based on certain conditions:
			log.debug('configlookup value', configLookUp);
			var useSchedule = configLookUp.custrecord_bb_uses_proj_actn_tran_schdl;
			var createAction = configLookUp.custrecord_bb_create_project_task;
			var hideRevisionRoles = configLookUp.custrecord_bb_roles_hide_new_rev;
			showNewRevisionButton(context, hideRevisionRoles);

			if (useSchedule) {
				projActionLib.projectActionTractionScheduleSublist(context);
			}
			if (createAction) {
				projActionLib.predecessorSublist(context);
			}
		}

		function showNewRevisionButton(scriptContext, hideRevisionRoles) {
			log.debug('hideRevisionRoles from config', hideRevisionRoles)
			var currentRole = runtime.getCurrentUser().role;
			log.debug('currentRole', currentRole);
			var hideCheckBox = false;
			var projectAction = scriptContext.newRecord;
			var actionTemplateId = projectAction.getValue({fieldId: 'custrecord_bb_project_package_action'});
			if (actionTemplateId) {
				var actionTemplateSearch = search.lookupFields({
					type: 'customrecord_bb_package_task',
					id: actionTemplateId,
					columns: ['custrecord_bb_act_templ_hide_newrevision']
				});
				hideCheckBox = actionTemplateSearch.custrecord_bb_act_templ_hide_newrevision;
			}
			var statusTypeId = projectAction.getValue({fieldId: 'custrecord_bb_action_status_type'});
			var newRevisionAction = projectAction.getValue({fieldId: 'custrecord_bb_new_rev_action'});
			var hideRevisionRolesArray = [];
			if (hideRevisionRoles.length > 0) {
				for (var i = 0; i < hideRevisionRoles.length; i++) {
					hideRevisionRolesArray.push(parseInt(hideRevisionRoles[i].value));
				}
			}
			// if (typeof hideRevisionRoles == 'string' && hideRevisionRoles.indexOf(',') != -1) {
			// 	var hideRevisionRolesArray = hideRevisionRoles.split(',');
			// } else if (typeof hideRevisionRoles == 'string' && hideRevisionRoles.indexOf(',') == -1) {
			// 	var hideRevisionRolesArray = [hideRevisionRoles]
			// } else if (typeof hideRevisionRoles == 'array') {
			// 	var hideRevisionRolesArray = hideRevisionRoles
			// }
			log.audit('hideRevisionRolesArray', hideRevisionRolesArray);

			scriptContext.form.clientScriptModulePath = './BB SS/SS Lib/BB.SS.CS.ProjectActionNewRevision';
			if ((statusTypeId == 4 || statusTypeId == 5) && !hideCheckBox && !newRevisionAction && hideRevisionRolesArray.indexOf(currentRole) == -1) {
				callNewRevisionSuitelet(scriptContext);
			}
		}

		function callNewRevisionSuitelet(scriptContext) {
			scriptContext.form.addButton({
				id: 'custpage_new_revision',
				label: 'New Revision',
				functionName: 'callNewRevision'
			});
		}

		/**
		 * Called by beforeLoad
		 */
		function setDocumentManagerFolder(context) {
			try {
				var iFrameFieldId = 'custrecord_bb_ss_proj_action_s3_folder';
				if (context.type === context.UserEventType.CREATE) {
					var documentManagerField = context.form.getField({
						id: 'custrecord_bb_proj_task_dm_folder_text'
					});
					documentManagerField.updateDisplayType({
						displayType: serverWidget.FieldDisplayType.HIDDEN
					});
					var documentManagerIframe = context.form.getField({
						id: iFrameFieldId
					});
					documentManagerIframe.updateDisplayType({
						displayType: serverWidget.FieldDisplayType.HIDDEN
					});
					return;
				}
				var projectFullName = context.newRecord.getText({
						fieldId: 'custrecord_bb_project'
					}),
					packageFullName = context.newRecord.getText({
						fieldId: 'custrecord_bb_package'
					}),
					packageTaskFullName = context.newRecord.getText({
						fieldId: 'custrecord_bb_project_package_action'
					}),
					revisionNumber = context.newRecord.getValue({
						fieldId: 'custrecord_bb_revision_number'
					}),
					iFrameHtml = context.newRecord.getValue(iFrameFieldId);
				if (isEmpty(projectFullName) || isEmpty(packageFullName) || isEmpty(packageTaskFullName)) {
					return;
				}
				var projectId = projectFullName.split(' ')[0];
				var prefix = ['projects', projectId, packageFullName, [packageTaskFullName, revisionNumber].join('_')].join('/');
				iFrameHtml = iFrameHtml.replace('{prefix}', prefix);
				if (context.type === context.UserEventType.VIEW) {
					iFrameHtml = iFrameHtml.replace('&prefix=', '&hide_drop_area=true&prefix=');
				}
				context.newRecord.setValue({
					fieldId: iFrameFieldId,
					value: iFrameHtml
				});
			} catch(e) {
				log.error('setDocumentManagerFolder ERROR',e);
			}
		}
		/**
		 * Called by beforeLoad
		 */
		function getProject(context) {
			var action = context.newRecord;
			var projectId = action.getValue({
				fieldId: 'custrecord_bb_project'
			});
			if (projectId) {
				var project = record.load({
					type: record.Type.JOB,
					id: projectId,
					isDynamic: true
				});
				return project;
			} else {
				return null;
			}
		}
		/**
		 * Called by beforeLoad
		 */
		function searchFirstActiveConfig() {
			var configSearch = search.create({
				type: "customrecord_bb_solar_success_configurtn",
				filters: [
					["isinactive", "is", "F"]
				]
			});
			var result = configSearch.run().getRange({
				start: 0,
				end: 1
			})[0];
			if (isNotNull(result)) {
				return result.id;
			}
			return null;
		}

		function afterSubmit(scriptContext) {
			var trigger = scriptContext.type;
			//Fix for new Project Action creation logic when adding Preceding Actions.
			var oldRecord = scriptContext.oldRecord;
			var newRecord = scriptContext.newRecord;
			if (oldRecord && newRecord) {
				var oldPrecedings = oldRecord.getValue('custrecord_bb_projact_preced_proj_action');
				var newPrecedings = newRecord.getValue('custrecord_bb_projact_preced_proj_action');
				if ((!oldPrecedings || oldPrecedings == '') && newPrecedings && newPrecedings.length) {
					log.audit('AUDIT', 'Stop Project Action ' + newRecord.id + ' execution, context from Project Action creation logic.');
					return;
				}
			}
			//
			setExternalId(scriptContext);
			switch (trigger) {
				case 'edit':
				case 'xedit':
					var recProjectAction;
					var iProjectID
					var projectActionId = scriptContext.newRecord.id;
					recProjectAction = scriptContext.newRecord;
					iProjectID = recProjectAction.getValue({
						fieldId: 'custrecord_bb_project'
					});
					if (!iProjectID && projectActionId) {
						recProjectAction = record.load({
							type: 'customrecord_bb_project_action',
							id: projectActionId,
							isDynamic: true
						});
						iProjectID = recProjectAction.getValue({
							fieldId: 'custrecord_bb_project'
						});
					}
					if (iProjectID && recProjectAction && scriptContext) {
						var recProject = record.load({
							type: record.Type.JOB,
							id: iProjectID,
							isDynamic: true,
						});
						recProject = updateProjectDates(recProject, recProjectAction, scriptContext);
					}
					break;
			}
		}

		function setExternalId(context) {
			if (context.newRecord) {
				var _extId = context.newRecord.getValue({
					fieldId: 'externalid'
				});
				if (!_extId) {
					try {
						var rec = context.newRecord;
						rec = record.load({
							type: rec.type,
							id: rec.id,
							isDynamic: true
						});
						// one more check in case it's not in context
						_extId = rec.getValue({
							fieldId: 'externalid'
						});
						if (!_extId) {
							rec.setValue({
								fieldId: 'externalid',
								value: create_UUID(),
								ignoreFieldChange: true
							}).save();
						}
					} catch (e) {
						log.error(e.name, e.message);
					}
				}
			}
		}

		function create_UUID() {
			var dt = new Date().getTime();
			var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = (dt + Math.random() * 16) % 16 | 0;
				dt = Math.floor(dt / 16);
				return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
			});
			return uuid;
		}
		/**
		 * Called by afterSubmit
		 */
		function updateProjectDates(project, projectAction, scriptContext) {
			var values = {};
			var projectActionValues = {};
			var projectId = project.id;
			var stLogger = 'updateProjectDates';
			var strCurrentPackage = projectAction.getText('custrecord_bb_package');
			var iCurrentPackage = projectAction.getValue('custrecord_bb_package');
			var currentActionGroupId = projectAction.getValue({
				fieldId: 'custrecord_bb_package'
			});
			var strPackageStatus = projectAction.getText('custrecord_bb_document_status');
			var dtPackageLastModDate = projectAction.getValue('custrecord_bb_document_status_date');
			var packageActionId = projectAction.getValue('custrecord_bb_project_package_action');
			var statusType = projectAction.getValue('custrecord_bb_action_status_type');
			var config = record.load({
				type: 'customrecord_bb_solar_success_configurtn',
				id: project.getValue({
					fieldId: 'custentity_bbss_configuration'
				}) || 1
			});
			// preceeding action update
			var oldProjectAction = null;
			var oldPrecedingPackageAction = null;
			var isProjectTemplate = project.getValue({fieldId: 'custentity_bb_is_project_template'});
			if (scriptContext.type != 'create' && !isProjectTemplate) {
				oldProjectAction = scriptContext.oldRecord;
				oldPrecedingPackageAction = oldProjectAction.getValue({
					fieldId: 'custrecord_bb_projact_preced_pack_action'
				});
				var executeProceedingAction = config.getValue({
					fieldId: 'custrecord_bb_config_use_preceding_actio'
				});
				if (executeProceedingAction) {
					var currentProcedingAction = projectAction.getValue({
						fieldId: 'custrecord_bb_projact_preced_proj_action'
					});
					if (!currentProcedingAction || (oldPrecedingPackageAction != currentProcedingAction && currentProcedingAction && oldPrecedingPackageAction)) {
						var actionId = projectAction.getValue({
							fieldId: 'custrecord_bb_projact_preced_pack_action'
						});

						if (actionId) {
							var proceedingActionId = getProceedingProjectAction(projectId, actionId);
							if (proceedingActionId.length) {
								projectActionValues['custrecord_bb_projact_preced_proj_action'] = proceedingActionId;
							}
						}
					}
				}
			}
			var useMilestoneActions = config.getValue({
				fieldId: 'custrecord_bb_proc_action_from_sch_bool'
			});
			var useAdvPaymentScheudule = config.getValue({
				fieldId: 'custrecord_bb_advpay_use_advpay'
			});
			var useInvoiceActuals = config.getValue({
				fieldId: 'custrecord_bb_invoice_actuals_boolean'
			});
          	var manuallyGenerateMilestoneTrans = config.getValue({
				fieldId: 'custrecord_bb_ss_manual_milestone_trans'
			});
			//if doesn't match any milestone action, then returns -1
			var milestoneNumCompleted = getMilestoneNumCompleted(project, projectAction, config); // default used when action on payment schedule are empty
			var packageCompletion = (milestoneNumCompleted !== -1) || getPackageCompletion(iCurrentPackage, project.id);
			var packageEndDate = setPackageEndDate(dtPackageLastModDate, iCurrentPackage, packageCompletion, milestoneNumCompleted);
			// performs search over schedule actions, if an action match is found, it returns an array value to process in map reduce script.
			var transactionObj = generateTransactionsFromSchedule(project, projectAction, dtPackageLastModDate, values, scriptContext, config.id);
			values = transactionObj.values;
          	//If manuallyGenerateMilestoneTrans is true skip this
          	if (!manuallyGenerateMilestoneTrans){
                if (transactionObj.transactionArr.length > 0 && useMilestoneActions && !useAdvPaymentScheudule && !useInvoiceActuals) {
                    // send data to map reduce script to create milestone invoices and/or vendor bills
                    var taskParameters = {};
                    taskParameters['custscript_bb_ss_transaction_array'] = transactionObj.transactionArr;
                    var scriptId = 'customscript_bb_ss_proj_dt_processor';
                    var deploymentId = 'customdeploy_bb_ss_proj_dt_processor';
                    var taskType = task.TaskType.SCHEDULED_SCRIPT;
                    batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
                } else if (milestoneNumCompleted !== -1 && !useMilestoneActions && !useAdvPaymentScheudule && !useInvoiceActuals) { // default setting to generate milestone transactions
                    values = updateMilestoneDates(projectAction, milestoneNumCompleted, values);
                    sendInvoiceBillCreation(project, milestoneNumCompleted, config, dtPackageLastModDate);
                } else if (!useMilestoneActions && useAdvPaymentScheudule) {
                    // execute advanced payment schedule search and execution
                    if (statusType == 4 && dtPackageLastModDate) {
                        var advArray = advpay.getAdvPaymentScheduleTransactionToProcessFromProjectAction(projectId, packageActionId, dtPackageLastModDate);
                        if (advArray.length > 0) {
                            var advTaskParameters = {};
                            advTaskParameters['custscript_bb_adv_tran_array'] = advArray;
                            var advScriptId = 'customscript_bb_ss_adv_mile_trans';
                            var advDeploymentId = 'customdeploy_bb_ss_adv_mile_trans';
                            var advTaskType = task.TaskType.SCHEDULED_SCRIPT;
                            batchProcessor.addToQueue(advScriptId, advDeploymentId, advTaskParameters, advTaskType);
                        }
                        //execute invoice actuals
                    }
                }
          	}
			if (!isProjectTemplate) {
				approveRelatedProjectActions(projectAction, iCurrentPackage, project.id, milestoneNumCompleted, config);
				setProjectRelatedActionFields(project, scriptContext, projectAction, currentActionGroupId, dtPackageLastModDate, values, config);
				setProjectActionFields(projectAction, projectActionValues);
			}
		}
		/**
		 * Called by updateProjectDates
		 */
		function getProceedingProjectAction(projectId, actionId) {
			var projectActions = [];
      if (!actionId.length || !projectId)
        return [];

			var customrecord_bb_project_actionSearchObj = search.create({
				type: "customrecord_bb_project_action",
				filters: [
					["isinactive", "is", "F"], 
          "AND", 
          ["custrecord_bb_project", "anyof", projectId],
          "AND", 
          ["custrecord_bb_project_package_action", "anyof", actionId],
          "AND",
          ["custrecord_bb_new_rev_action", "anyof", "@NONE@"]
				],
				columns: ["internalid"]
			});
			customrecord_bb_project_actionSearchObj.run().each(function(result) {
				projectActions.push(result.getValue({
					name: 'internalid'
				}));
				return true;
			});
			return projectActions;
		}
		/**
		 * Called by updateProjectDates
		 */
		function getMilestoneNumCompleted(project, projectAction, config) {
			var projectFinancingType = project.getText('custentity_bb_financing_type');
			var packageAction = projectAction.getValue('custrecord_bb_project_package_action');
			var actionStatusText = projectAction.getText('custrecord_bb_document_status');
			var actionStatusValue = projectAction.getValue('custrecord_bb_document_status');
			var statusType = projectAction.getValue('custrecord_bb_action_status_type');
			//if(actionStatusText.indexOf('Approved') === -1) return -1;
			if (statusType != 4)
				return -1;
			if (projectFinancingType == 'Cash') {
				var configs = {
					custrecord_bb_cash_m0_package_action: config.getValue('custrecord_bb_cash_m0_package_action'),
					custrecord_bb_cash_m1_package_action: config.getValue('custrecord_bb_cash_m1_package_action'),
					custrecord_bb_cash_m2_package_action: config.getValue('custrecord_bb_cash_m2_package_action'),
					custrecord_bb_cash_m3_package_action: config.getValue('custrecord_bb_cash_m3_package_action'),
					custrecord_bb_cash_m4_package_action: config.getValue('custrecord_bb_cash_m4_package_action'),
					custrecord_bb_cash_m5_package_action: config.getValue('custrecord_bb_cash_m5_package_action'),
					custrecord_bb_cash_m6_package_action: config.getValue('custrecord_bb_cash_m6_package_action'),
					custrecord_bb_cash_m7_package_action: config.getValue('custrecord_bb_cash_m7_package_action')
				};
				if (packageAction == configs.custrecord_bb_cash_m0_package_action) {
					return 0;
				} else if (packageAction == configs.custrecord_bb_cash_m1_package_action) {
					return 1;
				} else if (packageAction == configs.custrecord_bb_cash_m2_package_action) {
					return 2;
				} else if (packageAction == configs.custrecord_bb_cash_m3_package_action) {
					return 3;
				} else if (packageAction == configs.custrecord_bb_cash_m4_package_action) {
					return 4;
				} else if (packageAction == configs.custrecord_bb_cash_m5_package_action) {
					return 5;
				} else if (packageAction == configs.custrecord_bb_cash_m6_package_action) {
					return 6;
				} else if (packageAction == configs.custrecord_bb_cash_m7_package_action) {
					return 7;
				}
			} else { //loan or TPO
				var configs = {
					custrecord_bb_loan_m0_package_action: config.getValue('custrecord_bb_loan_m0_package_action'),
					custrecord_bb_loan_m1_package_action: config.getValue('custrecord_bb_loan_m1_package_action'),
					custrecord_bb_loan_m2_package_action: config.getValue('custrecord_bb_loan_m2_package_action'),
					custrecord_bb_loan_m3_package_action: config.getValue('custrecord_bb_loan_m3_package_action'),
					custrecord_bb_loan_m4_package_action: config.getValue('custrecord_bb_loan_m4_package_action'),
					custrecord_bb_loan_m5_package_action: config.getValue('custrecord_bb_loan_m5_package_action'),
					custrecord_bb_loan_m6_package_action: config.getValue('custrecord_bb_loan_m6_package_action'),
					custrecord_bb_loan_m7_package_action: config.getValue('custrecord_bb_loan_m7_package_action')
				};
				if (packageAction == configs.custrecord_bb_loan_m0_package_action) {
					return 0;
				} else if (packageAction == configs.custrecord_bb_loan_m1_package_action) {
					return 1;
				} else if (packageAction == configs.custrecord_bb_loan_m2_package_action) {
					return 2;
				} else if (packageAction == configs.custrecord_bb_loan_m3_package_action) {
					return 3;
				} else if (packageAction == configs.custrecord_bb_loan_m4_package_action) {
					return 4;
				} else if (packageAction == configs.custrecord_bb_loan_m5_package_action) {
					return 5;
				} else if (packageAction == configs.custrecord_bb_loan_m6_package_action) {
					return 6;
				} else if (packageAction == configs.custrecord_bb_loan_m7_package_action) {
					return 7;
				}
			}
			return -1;
		}
		/**
		 * Called by updateProjectDates
		 */
		function getPackageCompletion(packageID, projectID) {
			//if all project actions for "this" package that are Required are Approved AND (All Optional are either not started or Approved)
			//tech design - search for all actions that are tied to this package that are required and not approved OR optional and none of (not started, approved)
			//If results.length = 0, then we know we can set the date
			var searchObj = search.load({
				id: 'customsearch_bb_proj_actions_completed'
			});
			searchObj.filters.push(search.createFilter({
				name: 'custrecord_bb_project',
				operator: search.Operator.ANYOF,
				values: [projectID]
			}));
			searchObj.filters.push(search.createFilter({
				name: 'custrecord_bb_package',
				operator: search.Operator.ANYOF,
				values: [packageID]
			}));
			var resultSet = searchObj.run();
			var results = resultSet.getRange({
				start: 0,
				end: 1
			});
			if (results.length > 0) {
				var packageEndDate = results[0].getValue({
					name: 'custrecord_bb_document_status_date',
					summary: 'MAX'
				});
				if (packageEndDate) {
					return String(packageEndDate);
				} else {
					return false;
				}
			} else {
				return false;
			}
		}
		/**
		 * called by updateProjectDates
		 */
		function setPackageEndDate(dtPackageLastModDate, iPackageID, packageCompletion, milestoneNumSet) {
			var dtPackageEndDate = null;
			if (milestoneNumSet !== -1 || packageCompletion) {
				if (packageCompletion && milestoneNumSet !== -1) {
					dtPackageEndDate = new Date(dtPackageLastModDate);
				}
				if ((typeof packageCompletion == 'string') && milestoneNumSet == -1) {
					dtPackageEndDate = new Date(packageCompletion);
				}
			} else {
				dtPackageEndDate = null;
			}
			return dtPackageEndDate;
		}
		// use project action triggers from bb config record on default only when other project actions from schedule are blank
		/**
		 * Called by updateProjectDates
		 */
		function generateTransactionsFromSchedule(project, projectAction, dtPackageLastModDate, values, scriptContext, configId) {
			var trigger = scriptContext.type;
			var transactionArr = [];
			if (trigger != 'create') {
				var oldStatus = scriptContext.oldRecord.getText({
					fieldId: 'custrecord_bb_document_status'
				});
				var projectFinancingType = project.getText('custentity_bb_financing_type');
				var packageAction = projectAction.getValue('custrecord_bb_project_package_action');
				var actionStatusText = projectAction.getText('custrecord_bb_document_status');
				var finScheduleId = project.getValue({
					fieldId: 'custentity_bb_financier_payment_schedule'
				});
				var origScheduleId = project.getValue({
					fieldId: 'custentity_bb_sales_partner_pay_schedule'
				});
				var installScheduleId = project.getValue({
					fieldId: 'custentity_bb_install_part_pay_schedule'
				});
				var actionStatusValue = projectAction.getValue('custrecord_bb_document_status');
				var statusType = projectAction.getValue('custrecord_bb_action_status_type');
				if (statusType == 4) {
					var milestoneActionName = getProjectMilestoneActionNames(project);
					if (finScheduleId && packageAction) {
						var finActionObj = getActionsFromSchedule(project, 'financier');
						transactionObj = findScheduledActions(finActionObj, packageAction, project.id, dtPackageLastModDate, configId, 'financier', transactionArr, values, milestoneActionName);
						if (transactionObj.array.length > 0) {
							transactionArr = transactionObj.array;
							values = transactionObj.values;
						}
					}
					if (origScheduleId && packageAction) {
						var origActionObj = getActionsFromSchedule(project, 'originator');
						transactionObj = findScheduledActions(origActionObj, packageAction, project.id, dtPackageLastModDate, configId, 'originator', transactionArr, values, milestoneActionName);
						if (transactionObj.array.length > 0) {
							transactionArr = transactionObj.array;
							values = transactionObj.values;
						}
					}
					if (installScheduleId && packageAction) {
						var installActionObj = getActionsFromSchedule(project, 'installer');
						transactionObj = findScheduledActions(installActionObj, packageAction, project.id, dtPackageLastModDate, configId, 'installer', transactionArr, values, milestoneActionName);
						if (transactionObj.array.length > 0) {
							transactionArr = transactionObj.array;
							values = transactionObj.values;
						}
					}
				}
				return {
					transactionArr: transactionArr,
					values: values
				}
			}
		}
		/**
		 * Called by generateTransactionsFromSchedule
		 */
		function getActionsFromSchedule(project, type) {
			if (type == 'financier') {
				var m0Action = project.getValue({
					fieldId: 'custentity_bb_m0_finance_action'
				});
				var m1Action = project.getValue({
					fieldId: 'custentity_bb_m1_finance_action'
				});
				var m2Action = project.getValue({
					fieldId: 'custentity_bb_m2_finance_action'
				});
				var m3Action = project.getValue({
					fieldId: 'custentity_bb_m3_finance_action'
				});
				var m4Action = project.getValue({
					fieldId: 'custentity_bb_m4_finance_action'
				});
				var m5Action = project.getValue({
					fieldId: 'custentity_bb_m5_finance_action'
				});
				var m6Action = project.getValue({
					fieldId: 'custentity_bb_m6_finance_action'
				});
				var m7Action = project.getValue({
					fieldId: 'custentity_bb_m7_finance_action'
				});
				return {
					m0Action: m0Action,
					m1Action: m1Action,
					m2Action: m2Action,
					m3Action: m3Action,
					m4Action: m4Action,
					m5Action: m5Action,
					m6Action: m6Action,
					m7Action: m7Action
				}
			}
			if (type == 'originator') {
				var m0Action = project.getValue({
					fieldId: 'custentity_bb_m0_origination_action'
				});
				var m1Action = project.getValue({
					fieldId: 'custentity_bb_m1_origination_action'
				});
				var m2Action = project.getValue({
					fieldId: 'custentity_bb_m2_origination_action'
				});
				var m3Action = project.getValue({
					fieldId: 'custentity_bb_m3_origination_action'
				});
				var m4Action = project.getValue({
					fieldId: 'custentity_bb_m4_origination_action'
				});
				var m5Action = project.getValue({
					fieldId: 'custentity_bb_m5_origination_action'
				});
				var m6Action = project.getValue({
					fieldId: 'custentity_bb_m6_origination_action'
				});
				var m7Action = project.getValue({
					fieldId: 'custentity_bb_m7_origination_action'
				});
				return {
					m0Action: m0Action,
					m1Action: m1Action,
					m2Action: m2Action,
					m3Action: m3Action,
					m4Action: m4Action,
					m5Action: m5Action,
					m6Action: m6Action,
					m7Action: m7Action
				}
			}
			if (type == 'installer') {
				var m0Action = project.getValue({
					fieldId: 'custentity_bb_m0_sub_install_action'
				});
				var m1Action = project.getValue({
					fieldId: 'custentity_bb_m1_sub_install_action'
				});
				var m2Action = project.getValue({
					fieldId: 'custentity_bb_m2_sub_install_action'
				});
				var m3Action = project.getValue({
					fieldId: 'custentity_bb_m3_sub_install_action'
				});
				var m4Action = project.getValue({
					fieldId: 'custentity_bb_m4_sub_install_action'
				});
				var m5Action = project.getValue({
					fieldId: 'custentity_bb_m5_sub_install_action'
				});
				var m6Action = project.getValue({
					fieldId: 'custentity_bb_m6_sub_install_action'
				});
				var m7Action = project.getValue({
					fieldId: 'custentity_bb_m7_sub_install_action'
				});
				return {
					m0Action: m0Action,
					m1Action: m1Action,
					m2Action: m2Action,
					m3Action: m3Action,
					m4Action: m4Action,
					m5Action: m5Action,
					m6Action: m6Action,
					m7Action: m7Action
				}
			}
		}
		/**
		 * Function gets the milestone action names from the project's Milestone payment schedule
		 * @param project
		 * @returns {{}}
		 */
		function getProjectMilestoneActionNames(project){
			var milestonePayment = search.lookupFields({
				type: 'job',
				id: project.id,
				columns: ['custentity_bb_financier_payment_schedule']
			});
			var milestoneActionName={};
			if (milestonePayment.custentity_bb_financier_payment_schedule.length > 0) {
				var customrecord_bb_milestone_pay_scheduleSearchObj = search.create({
					type: "customrecord_bb_milestone_pay_schedule",
					filters:
						[
							["internalid","anyof",milestonePayment.custentity_bb_financier_payment_schedule[0].value]
						],
					columns:
						[
							search.createColumn({name: "custrecord_bb_m0_package_action"}),
							search.createColumn({name: "custrecord_bb_m1_package_action"}),
							search.createColumn({name: "custrecord_bb_m2_package_action"}),
							search.createColumn({name: "custrecord_bb_m3_package_action"}),
							search.createColumn({name: "custrecord_bb_m4_package_action"}),
							search.createColumn({name: "custrecord_bb_m5_package_action"}),
							search.createColumn({name: "custrecord_bb_m6_package_action"}),
							search.createColumn({name: "custrecord_bb_m7_package_action"})
						]
				});

				customrecord_bb_milestone_pay_scheduleSearchObj.run().each(function(result){
					milestoneActionName.m0=result.getText({
						name: "custrecord_bb_m0_package_action"
					});
					milestoneActionName.m1=result.getText({
						name: "custrecord_bb_m1_package_action"
					})
					milestoneActionName.m2=result.getText({
						name: "custrecord_bb_m2_package_action"
					})
					milestoneActionName.m3=result.getText({
						name: "resucustrecord_bb_m3_package_action"
					})
					milestoneActionName.m4=result.getText({
						name: "custrecord_bb_m4_package_action"
					})
					milestoneActionName.m5=result.getText({
						name: "custrecord_bb_m5_package_action"
					})
					milestoneActionName.m6=result.getText({
						name: "custrecord_bb_m6_package_action"
					})
					milestoneActionName.m7=result.getText({
						name: "custrecord_bb_m7_package_action"
					})
					return true;
				});
			}
			return milestoneActionName;
		}
		/**
		 * Called by generateTransactionsFromSchedule
		 */
		function findScheduledActions(actionObj, packageAction, projectId, milestoneDate, configId, type, array, values, milestoneActionName) {
			if (actionObj.m0Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm0', configId, type, milestoneActionName.m0);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m0_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m0_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m0_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m1Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm1', configId, type, milestoneActionName.m1);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m1_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m1_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m1_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m2Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm2', configId, type, milestoneActionName.m2);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m2_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m2_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m2_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m3Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm3', configId, type, milestoneActionName.m3);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m3_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m3_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m3_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m4Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm4', configId, type, milestoneActionName.m4);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m4_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m4_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m4_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m5Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm5', configId, type, milestoneActionName.m5);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m5_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m5_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m5_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m6Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm6', configId, type, milestoneActionName.m6);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m6_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m6_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m6_sub_install_date'] = milestoneDate;
				}
			}
			if (actionObj.m7Action == packageAction) {
				array = milestoneLib.pushValuesToTransactionArray(array, projectId, milestoneDate, 'm7', configId, type, milestoneActionName.m7);
				// set appropriate project values to an object
				if (type == 'financier') {
					values['custentity_bb_m7_date'] = milestoneDate;
				} else if (type == 'originator') {
					values['custentity_bb_m7_origination_date'] = milestoneDate;
				} else {
					values['custentity_bb_m7_sub_install_date'] = milestoneDate;
				}
			}
			return {
				array: array,
				values: values
			}
		}
		/**
		 * Called by updateProjectDates
		 */
		function updateMilestoneDates(projectAction, iMilestoneCompleted, values) {
			var lastModDate = projectAction.getValue('custrecord_bb_document_status_date');
			var milestoneDate = 'custentity_bb_m' + iMilestoneCompleted + '_date';
			values[milestoneDate] = lastModDate
			return values;
		}
		/**
		 * Called by updateProjectDates
		 */
		function sendInvoiceBillCreation(project, milestone, config, milestoneDate) {
			if (isNotNull(milestoneDate)) {
				invoiceService.createInvoiceFromProjectAndMilestoneName(project, 'M' + milestone, config, milestoneDate);
				vendorBillService.createVendorBillFromProjectAndMilestoneName(project, 'M' + milestone, config, milestoneDate);
			}
		}
		/**
		 * Called by updateProjectDates
		 */
		function approveRelatedProjectActions(projectAction, packageID, projectID, milestoneNumCompleted, config) {
			log.debug('in approveRelatedProjectActions ');
			var actionStatusValue = projectAction.getValue('custrecord_bb_document_status');
			log.debug('actionStatusValue', actionStatusValue);
			var actionStatusText = projectAction.getText('custrecord_bb_document_status');
			var lastModDate = projectAction.getValue('custrecord_bb_document_status_date');
			var statusType = projectAction.getValue({
				fieldId: 'custrecord_bb_action_status_type'
			});
			var approveAllActions = config.getValue({
				fieldId: 'custrecord_bb_apprv_related_proj_action'
			});
			if (approveAllActions) {
				//if(actionStatusText.indexOf('Approved') !== -1 && milestoneNumCompleted !== -1){
				if (statusType == 4 && milestoneNumCompleted !== -1) {
					var relatedProjActionsSearchObj = search.create({
						type: "customrecord_bb_project_action",
						filters: [
							["isinactive", "is", "F"], "AND", ["custrecord_bb_project", "anyof", projectID], "AND", ["custrecord_bb_package", "anyof", packageID]
						],
						columns: ["internalid", ]
					});
					var results = relatedProjActionsSearchObj.run().getRange({
						start: 0,
						end: 1000
					});
					for (var i = 0; i < results.length; i++) {
						var result = results[i];
						var internalId = result.getValue('internalid');
						log.debug('update custrecord_bb_document_status');
						record.submitFields({
							type: 'customrecord_bb_project_action',
							id: internalId,
							values: {
								custrecord_bb_document_status: actionStatusValue,
								custrecord_bb_document_status_date: lastModDate,
							},
							options: {
								ignoreMandatoryFields: true
							}
						});
					}
				}
			}
		}
		/**
		 * called by updateProjectDates
		 */
		function setProjectRelatedActionFields(project, scriptContext, projectAction, currentActionGroupId, dtPackageLastModDate, values, config) {
			var projectId = project.id;

			var actionSearchId = config.getValue({
				fieldId: 'custrecord_bb_proj_actgrp_status_search'
			});
			if (!actionSearchId) throw '"Project Action Group Status Search" is not configured in BB Solar Success Configuration record. Please enter a value in this field before proceeding.';
			var oldAction = scriptContext.oldRecord;
			var currentActionGroup = record.load({
				type: 'customrecord_bb_package',
				id: currentActionGroupId
			});
			var startDateFieldId = currentActionGroup.getValue({
				fieldId: 'custrecord_bb_act_group_start_date_id'
			});
			var endDateFieldId = currentActionGroup.getValue({
				fieldId: 'custrecord_bb_act_group_end_date_id'
			});
			var lastModFieldId = currentActionGroup.getValue({
				fieldId: 'custrecord_bb_act_group_last_mod_date_id'
			});
			var statusFieldId = currentActionGroup.getValue({
				fieldId: 'custrecord_bb_act_group_status_id'
			});
			var oldProjectAction = scriptContext.oldRecord;
			var oldStatusType = oldProjectAction.getValue({
				fieldId: ACTION_STATUS_TYPE_FIELD
			});
			var oldStatus = oldProjectAction.getValue({
				fieldId: ACTION_STATUS_FIELD
			});
			var newStatusType = projectAction.getValue({
				fieldId: ACTION_STATUS_TYPE_FIELD
			});
			var newStatus = projectAction.getValue({
				fieldId: ACTION_STATUS_FIELD
			});
			var actionGroupStartDate = getActionGroupStartDate(project, oldStatusType, newStatusType, projectAction, startDateFieldId, endDateFieldId, dtPackageLastModDate);
			var actionGroupEndDate = getActionGroupEndDate(project, endDateFieldId, projectAction, oldAction, oldStatusType, newStatusType, currentActionGroupId);
			var actionGroupStatus = getActionGroupStatus(project, projectAction, currentActionGroupId, actionSearchId, startDateFieldId, statusFieldId, oldStatus, newStatus, actionGroupEndDate);
			if (startDateFieldId && actionGroupStartDate) {
				project.setValue({
					fieldId: startDateFieldId,
					value: new Date(actionGroupStartDate)
				});
			}
			if (endDateFieldId && actionGroupEndDate) {
				project.setValue({
					fieldId: endDateFieldId,
					value: new Date(actionGroupEndDate)
				});
			} else if (endDateFieldId && !actionGroupEndDate) {
				project.setValue({
					fieldId: endDateFieldId,
					value: null
				});
			}
			if (statusFieldId) {
				project.setValue({
					fieldId: statusFieldId,
					value: actionGroupStatus
				});
			}
			var stageInfo = checkProjectStatusForStageInfo(project, config);
			if (lastModFieldId && dtPackageLastModDate) {
				project.setValue({
					fieldId: lastModFieldId,
					value: new Date(dtPackageLastModDate)
				});
			}
			project.setValue({
				fieldId: "custentity_bb_project_stage_text",
				value: stageInfo.stage
			});
			project.setValue({
				fieldId: "custentity_bb_project_sub_stage_text",
				value: stageInfo.substage
			});
			for (var fieldId in values) {
				project.setValue({
					fieldId: fieldId,
					value: values[fieldId]
				});
			}
			if (scriptContext.type != 'create') {
				project.save();
			}
		}
		/**
		 * Called by setProjectRelatedActionFields
		 */
		function getActionGroupStartDate(project, oldStatusType, newStatusType, projectAction, startDateFieldId, endDateFieldId, dtPackageLastModDate) {
			var isRequired = projectAction.getValue({
				fieldId: 'custrecord_bb_proj_doc_required_optional'
			});
			var currentStartDate = project.getValue({
				fieldId: startDateFieldId
			});
			var currentEndDate = project.getValue({
				fieldId: endDateFieldId
			});
			if (isNotNull(currentStartDate)) {
				return currentStartDate;
			}
			// From here, the current Start Date should be Empty or Null, meaning the Action Group hasn't started
			if (newStatusType != NOT_INITIATED_STATUS_TYPE) {
				var startDate = projectAction.getValue({
					fieldId: 'custrecord_bb_document_status_date'
				});
				if (isNotNull(startDate)) {
					return startDate;
				}
			}
		}
		/**
		 * Called by setProjectRelatedActionFields
		 */
		function getActionGroupEndDate(project, endDateFieldId, projectAction, oldAction, oldStatusType, newStatusType, currentActionGroupId) {
			var isRequired = projectAction.getValue({
				fieldId: 'custrecord_bb_proj_doc_required_optional'
			});
			var oldRequired = oldAction.getValue({
				fieldId: 'custrecord_bb_proj_doc_required_optional'
			});
			var currentEndDate = project.getValue({
				fieldId: endDateFieldId
			});
			if (isRequired == IS_REQUIRED && newStatusType == APPROVED_STATUS_TYPE) {
				log.emergency('required and new status = approved status type')
				var allApproved = searchForRequiredActionsInGroup(project, currentActionGroupId);
				log.emergency('all approved', allApproved)
				if (allApproved) {
					var endDate = searchMaximumCompletionDate(project.id, currentActionGroupId);
					return endDate;
				}
			} else if (isRequired == IS_REQUIRED && newStatusType != APPROVED_STATUS_TYPE) {
				log.emergency('required and new status != approved status type')
				var allApproved = searchForRequiredActionsInGroup(project, currentActionGroupId);
				log.emergency('all approved', allApproved)
				if (allApproved) {
					var endDate = searchMaximumCompletionDate(project.id, currentActionGroupId);
					return endDate;
				} else {
					return null;
				}
			} else if (isRequired != IS_REQUIRED && oldStatusType != newStatusType && isNotNull(currentEndDate)) {
				log.emergency('not required and old status != new status and end date is not null')
				return null;
			} else {
				return currentEndDate;
			}
		}

		/**
		 * Called by getActionGroupEndDate
		 */
		function searchMaximumCompletionDate(projectId, currentActionGroupId) {
			var maximumDateSearch = search.create({
				type : 'customrecord_bb_project_action',
				filters : [['custrecord_bb_package', 'anyof', currentActionGroupId], 'AND', ['custrecord_bb_project', 'anyof', projectId]],
				columns : [search.createColumn({
					name : 'custrecord_bb_document_status_date',
					summary : 'MAX'
				})]
			});
			var result = maximumDateSearch.run().getRange({
				start : 0,
				end : 1
			})[0];
			if (result) {
				var endDate = result.getValue({
					name : 'custrecord_bb_document_status_date',
					summary : 'MAX'
				});
				return endDate;
			}
		}
		/**
		 * Called by getActionGroupEndDate
		 */
		function searchForRequiredActionsInGroup(project, currentActionGroupId) {
			var projectActionSearch = search.create({
				type: 'customrecord_bb_project_action',
				filters: [
					['custrecord_bb_package', 'anyof', currentActionGroupId], 'AND', 														['custrecord_bb_proj_doc_required_optional', 'anyof', IS_REQUIRED], 'AND', 
                  	['custrecord_bb_project', 'anyof', project.id] , 'AND', 
                    ['custrecord_bb_new_rev_action','anyof','@NONE@']
				],
				columns: [search.createColumn({
					name: 'custrecord_bb_action_status_type'
				})]
			});
			var totalActions = 0;
			var approvedActions = 0;
			projectActionSearch.run().each(function(result) {
				var statusType = result.getValue({
					name: 'custrecord_bb_action_status_type'
				});
				if (statusType == APPROVED_STATUS_TYPE) {
					approvedActions++;
				}
				totalActions++;
				return true;
			});
			if (totalActions == approvedActions) {
				return true;
			}
			return false;
		}
		/**
		 * Called by setProjectRelatedActionFields
		 */
		function getActionGroupStatus(project, projectAction, currentActionGroupId, actionSearchId, startDateFieldId, statusFieldId, oldStatus, newStatus, actionGroupEndDate) {
			var startDate = project.getValue({
				fieldId: startDateFieldId
			});
			var status = project.getValue({
				fieldId: statusFieldId
			});
			if (oldStatus == newStatus) { // current action doesn't change status
				// if (isNotNull(status)) {
				// 	return status;
				// } else { // no status, need to load search to find the status
				var actionSearch = updateFiltersInSearch(actionSearchId, project, currentActionGroupId);
				var end = 0;
				if (isNotNull(startDate)) { // when the action group already started, we search for the most maximum active action status
					log.audit('The Action Group has already started, but no status value on the project yet. We will fix it now.', project.getValue({fieldId: 'id'}));
					end = 1;
				} else { // no action started yet, meaning there is no Action Status Date, we look for the minimum
					end = actionSearch.runPaged().count;
				}
				var result = actionSearch.run().getRange({
					start: 0,
					end: end
				})[end - 1];
				log.debug('actionGroupEndDate', actionGroupEndDate)
				if (actionGroupEndDate) {
					var actionGroupName = projectAction.getText({
						fieldId: 'custrecord_bb_package'
					});

					status = actionGroupName + ' Group Complete'
				} else {
					if (result) {
						status = result.getValue(result.columns[0]);
					}
				}
				// }
			} else { // status change, update the Action Group Status
				var actionName = projectAction.getText({
					fieldId: 'custrecord_bb_project_package_action'
				});
				var actionStatus = projectAction.getText({
					fieldId: 'custrecord_bb_document_status'
				});
				var statusDate = projectAction.getText({
					fieldId: 'custrecord_bb_document_status_date'
				});
				var sequenceNumber = projectAction.getText({
					fieldId: 'custrecord_bb_package_step_number'
				});
				// set the action status name and status here per the action group section fields
				status = sequenceNumber + ' ' + actionName + ': ' + actionStatus; // include step number here
			}
			return status;
		}
		/**
		 * Called by getActionGroupStatus
		 */
		function updateFiltersInSearch(actionSearchId, project, currentActionGroupId) {
			var actionSearch = search.load({
				id: actionSearchId
			});
			var filters = actionSearch.filterExpression;
			var flag = 0;
			for (var f = 0; f < filters.length; f++) {
				if (filters[f][0] == 'custrecord_bb_project') {
					filters[f] = ['custrecord_bb_project', 'anyof', project.id];
					flag++;
				} else if (filters[f][0] == 'custrecord_bb_package') {
					filters[f] = ['custrecord_bb_package', 'anyof', currentActionGroupId];
					flag += 2;
				}
			}
			switch (flag) {
				case 0:
					filters.push('AND', ['custrecord_bb_project', 'anyof', project.id]);
					filters.push('AND', ['custrecord_bb_package', 'anyof', currentActionGroupId]);
					break;
				case 1:
					filters.push('AND', ['custrecord_bb_package', 'anyof', currentActionGroupId]);
					break;
				case 2:
					filters.push('AND', ['custrecord_bb_project', 'anyof', project.id]);
					break;
				case 3:
					break;
			}
			actionSearch.filterExpression = filters;
			return actionSearch;
		}
		/**
		 * Called by setProjectRelatedActionFields
		 */
		function checkProjectStatusForStageInfo(project, config) {
			if (!config.getValue({fieldId: 'custrecord_bb_proj_stage_sub_svd_search'})) {
				var projStatus = project.getValue({
					fieldId: 'custentity_bb_project_status'
				});
				if (EXTEMPT_PROJ_STATUS.indexOf(projStatus) != -1) {
					var stage = project.getText({
						fieldId: 'custentity_bb_project_status'
					});
					var stageInfo = {};
					stageInfo = {
						stage: stage,
						substage: 'NULL'
					};
					return stageInfo;
				} else {
					return getStageSubstage(project);
				}
			} else {
				return getStageSubStageSearchResultValues(project, config);
			}
		}
		/**
		 * Called by checkProjectStatus
		 */
		function getStageSubstage(project) {
			var searchResults = searchMaximumActionGroupDates(project);
			var stage = '';
			var substage = '';
			var noStageYet = true;
			var noSubstageYet = true;
			var mostMatured = '';
			var noMatured = true;
			for (var i = 0; i < searchResults.length; i++) {
				var result = searchResults[i];
				var actionGroup = result.getValue({
					name: 'name',
					join: ACTION_GROUP_TYPE,
					summary: 'GROUP'
				});
				var endDateId = result.getValue({
					name: 'custrecord_bb_act_group_end_date_id',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				});
				var startDateId = result.getValue({
					name: 'custrecord_bb_act_group_start_date_id',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				});
				var sequenceNum = result.getValue({
					name: 'custrecord_bb_package_sequence_num',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				});
				var endDate = '';
				var startDate = '';
				try { // put try here because we cannot be sure those field Ids are all populated into the Action Groups
					endDate = project.getValue({
						fieldId: endDateId
					});
					startDate = project.getValue({
						fieldId: startDateId
					});
					var statusId = result.getValue({
						name: 'custrecord_bb_act_group_status_id',
						join: ACTION_GROUP_TYPE,
						summary: 'MAX'
					});
					var projectStatus = project.getValue({
						fieldId: statusId
					});
					if (noStageYet && noMatured && isNotNull(endDate)) {
						stage = sequenceNum + ' ' + actionGroup + ' Completed';
						noStageYet = false;
					}
					if (noMatured && isNull(endDate) && isNotNull(startDate)) {
						mostMatured = sequenceNum + ' ' + actionGroup;
						noMatured = false;
					}
					if (noSubstageYet && isNull(endDate) && isNotNull(startDate)) {
						substage = projectStatus;
						noSubstageYet = false;
					}
					if (!noStageYet && !noSubstageYet && !noMatured) {
						break;
					}
				} catch (e) {}
			}
			var stageInfo = {};
			stageInfo = {
				stage: isNotNull(stage) ? stage : mostMatured + ' In Progress',
				substage: isNotNull(substage) ? substage : sequenceNum + ' Working'
			};
			return stageInfo;
		}
		/**
		 * Called by getStageSubstage
		 */
		function searchMaximumActionGroupDates(project) {
			var projectActionSearch = search.create({
				type: 'customrecord_bb_project_action',
				filters: [
					['custrecord_bb_project', 'anyof', project.id]
				],
				columns: [search.createColumn({
					name: 'internalid',
					join: ACTION_GROUP_TYPE,
					summary: 'GROUP'
				}), search.createColumn({
					name: 'name',
					join: ACTION_GROUP_TYPE,
					summary: 'GROUP'
				}), search.createColumn({
					name: 'custrecord_bb_package_sequence_num',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX',
					sort: search.Sort.DESC
				}), search.createColumn({
					name: 'custrecord_bb_act_group_start_date_id',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				}), search.createColumn({
					name: 'custrecord_bb_act_group_end_date_id',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				}), search.createColumn({
					name: 'custrecord_bb_package_sequence_num',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				}), search.createColumn({
					name: 'custrecord_bb_act_group_status_id',
					join: ACTION_GROUP_TYPE,
					summary: 'MAX'
				})]
			});
			var resultCount = projectActionSearch.runPaged().count;
			var searchResults = projectActionSearch.run().getRange({
				start: 0,
				end: resultCount
			});
			return searchResults;
		}


		function getStageSubStageSearchResultValues(project, config) {
			var stageInfo;
			log.audit('substage search id', config.getValue({fieldId: 'custrecord_bb_proj_stage_sub_svd_search'}))
			var stageSearch = search.load({
				id: config.getValue({fieldId: 'custrecord_bb_proj_stage_sub_svd_search'})
			});
			var additionalFilters = ["AND", ['custrecord_bb_project', 'anyof', project.id]] //, "AND",
			// ["sum(formulanumeric: SUM(CASE WHEN ({custrecord_bb_proj_doc_required_optional.id} = 1) OR ({custrecord_bb_action_status_type.id} in (2,5,4,3) AND {custrecord_bb_proj_doc_required_optional.id} = 2) THEN 1 END) + SUM(CASE WHEN ({custrecord_bb_action_status_type.id} = 4 AND {custrecord_bb_proj_doc_required_optional.id} = 1) OR ({custrecord_bb_action_status_type.id} = 4 AND {custrecord_bb_proj_doc_required_optional.id} = 2) THEN -1 END))","isempty",""],
			// "OR",
			// ["sum(formulanumeric: SUM(CASE WHEN ({custrecord_bb_proj_doc_required_optional.id} = 1) OR ({custrecord_bb_action_status_type.id} in (2,5,4,3) AND {custrecord_bb_proj_doc_required_optional.id} = 2) THEN 1 END) + SUM(CASE WHEN ({custrecord_bb_action_status_type.id} = 4 AND {custrecord_bb_proj_doc_required_optional.id} = 1) OR ({custrecord_bb_action_status_type.id} = 4 AND {custrecord_bb_proj_doc_required_optional.id} = 2) THEN -1 END))","equalto","0"]];
			var newFilterExpression = stageSearch.filterExpression.concat(additionalFilters);
			stageSearch.filterExpression = newFilterExpression;

			log.audit('stage and substage filter expression', stageSearch.filterExpression)
			var endCount = stageSearch.runPaged().count;
			log.audit('result count ', endCount)
			stageSearch.run().each(function(result) {
				stageInfo = {
					stage: result.getValue(stageSearch.columns[0]),
					substage: result.getValue(stageSearch.columns[1])
				}
			})
			return stageInfo;
		}

		/**
		 * Called by updateProjectDates
		 */
		function setProjectActionFields(projectAction, projectActionValues) {
			if (projectAction && Object.keys(projectActionValues).length > 0) {
				record.submitFields({
					type: 'customrecord_bb_project_action',
					id: projectAction.id,
					values: projectActionValues,
					options: {
						ignoreMandatoryFields: true
					}
				});
			}
		}
		// before load functions
		function isEmpty(element) {
			return typeof element === 'undefined' || element == '';
		}

		function isNotNull(str) {
			return (str !== null && str !== '' && str !== undefined);
		}

		function isNull(str) {
			return (str === null || str === '' || str === undefined);
		}
		return {
			beforeLoad: beforeLoad,
			//beforeSubmit: setExternalId,
			afterSubmit: afterSubmit
		};
	});