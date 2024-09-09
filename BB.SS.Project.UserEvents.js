/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 * @author Matt Lehman
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

define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/url', 'N/runtime', 'N/task', './BB SS/SS Lib/BB.SS.MD.UpsertSalesOrder', './BB SS/SS Lib/BB.SS.Project.AccountingFields',
        './BB SS/SS Lib/BB.SS.Project.Service', './BB SS/SS Lib/BB.SS.SalesOrder.Service', './BB SS/SS Lib/BB.SS.MD.Project.BOM.Adders.InlineEditor',
        './BB SS/SS Lib/BB.SS.MD.CommissionValueHistory', './BB DS/scripts/BB.DS.Envelope.Service', './BB SS/SS Lib/BB.SS.MD.GenerateMilestoneTransactionsLib',
        './BB SS/SS Lib/BB.SS.MD.Entity.Document.Template.Lib', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing', './BB SS/SS Lib/BB.MD.AdvPaymentModules'],
    function (record, searchModule, serverWidget, url, runtime, task, upsertSalesOrder, accountingFields, projectService, salesOrderService, inlineEditor, commHistory,
              envelopeService, milestoneTransctions, docLib, batchProcessor, advMod) {
        var EXPECTED_RESPONSE_CALC_METHOD_GANTT = 3;
        var HOMEOWNER = '1';
        /**
         * Trigger function
         */
        function beforeLoad(scriptContext) { // 40 units of execution when sublist is executed
            var _record = scriptContext.newRecord;
            var configId = _record.getValue({ fieldId: 'custentity_bbss_configuration' }) || 1;
            var config = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: configId
            });
            scriptContext.form.removeButton("createtemplate");
            var altName = scriptContext.form.getField({
                id: 'altname'
            });
            if (altName) {
                altName.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
            }
            var _form = scriptContext.form;
            var _trigger = scriptContext.type;
            if (_trigger === 'view') {
                var _isFilledIn = function (fieldValue) {
                    return fieldValue instanceof Date || (typeof fieldValue === 'string' && fieldValue.trim().length > 0);
                };
                var _valueContractPackStartDate = _record.getValue({ fieldId: 'custentity_bb_contract_pack_start_date' });
                var _valueContractPackEndDate = _record.getValue({ fieldId: 'custentity_bb_contract_pack_end_date' });
                var _valueActualEquipmentShipDate = _record.getValue({ fieldId: 'custentity_bb_actual_equipment_ship_date' });
                var _valueCancellationDate = _record.getValue({ fieldId: 'custentity_bb_cancellation_date' });
                var _valueM0Date = _record.getValue({ fieldId: 'custentity_bb_m0_date' });
                var _valueM1Date = _record.getValue({ fieldId: 'custentity_bb_m1_date' });
                var _valueM2Date = _record.getValue({ fieldId: 'custentity_bb_m2_date' });
                var _valueM3Date = _record.getValue({ fieldId: 'custentity_bb_m3_date' });
                var _isVisible = _isFilledIn(_valueContractPackStartDate) && !_isFilledIn(_valueContractPackEndDate) && !_isFilledIn(_valueActualEquipmentShipDate)
                    && !_isFilledIn(_valueCancellationDate) && !_isFilledIn(_valueM0Date) && !_isFilledIn(_valueM1Date) && !_isFilledIn(_valueM2Date) && !_isFilledIn(_valueM3Date);
                if (!_isVisible) {
                    var _buttonId = getSendContractForSignatureButtonId();
                    if (_buttonId) {
                        var _docuSignButton = _form.getButton({ id: _buttonId });
                        if (_docuSignButton) {
                            _form.removeButton({ id: _buttonId });
                        }
                    }
                }
            }
            if (['edit', 'view'].indexOf(_trigger) && _record && _record.id) {
                var _shouldAddScript = false;
                envelopeService.envelopeButtonsConfig.forEach(function (config) {
                    if (envelopeService.canProcessCounterParty(_record, config.nameField, config.emailField, config.counterPartyId)) {
                        _shouldAddScript = true;
                        var _button = _form.addButton({
                            id: ['custpage_send_envelope', _record.id, config.counterPartyId].join('_'),
                            label: ['Send to', config.sendToText].join(' '),
                            functionName: ['sendEnvelope(', _record.id, ', ', config.counterPartyId, ')'].join('')
                        });
                    }
                });
                if (_shouldAddScript) {
                    _form.clientScriptModulePath = './BB DS/scripts/BB.DS.CS.Project.js';
                }
            }
            var category = _record.getValue({
                fieldId: 'custentity_bb_customer_category'
            });
            //   var parent = _record.getValue({
            //       fieldId: 'parent'
            //   });
            // var category;
            // if (parent) {
            //       var categoryObj = searchModule.lookupFields({
            //           type: searchModule.Type.CUSTOMER,
            //           id: parent,
            //           columns: ['category']
            //       });
            //       if (categoryObj.category && categoryObj.category[0]) {
            //           category = categoryObj.category[0].value;
            //       }
            //   }
            addSuiteletButtons(config, scriptContext, category);
            addCopyProjectButton(scriptContext, _record);
            addGetSiteDevicesButton(_form, _record);
        }

        /**
         * beforeLoad
         */
        function getSendContractForSignatureButtonId() {
            var _templateName = 'custpage_button_docusign_custom';
            try {
                var _search = searchModule.create({
                    type: 'customrecord_docusign_custom_button',
                    filters: ['name', searchModule.Operator.IS, 'Send Contract for Signature']
                });
                var _result = _search.run().getRange({ start: 0, end: 1 });
                if (_result.length === 1) {
                    return [_templateName, _result[0].id].join('');
                }
            } catch (ex) { }
            return undefined;
        }

        /**
         * beforeLoad
         */
        function addSuiteletButtons(config, scriptContext, category) {
            // BOM/Adder inline editor list
            var trigger = scriptContext.type;
            var showBomAdderSublist = config.getValue({ fieldId: 'custrecord_bb_show_bom_adder_sublist' });
            // change of scope
            var cosAccessRoles = config.getValue({ fieldId: 'custrecord_bb_ss_cos_access_roles' });
            var currentUser = runtime.getCurrentUser();
            // adder/expense sublist/button config
            var _showBom = config.getValue({ fieldId: 'custrecord_bb_ss_show_bom' });
            var _showAdder = config.getValue({ fieldId: 'custrecord_bb_ss_show_adder' });
            var _showExpense = config.getValue({ fieldId: 'custrecord_bb_ss_show_expense' });
            _showAdder = typeof _showAdder === 'boolean' ? _showAdder : (typeof _showAdder === 'string' && _showAdder === 'T');
            _showExpense = typeof _showExpense === 'boolean' ? _showExpense : (typeof _showExpense === 'string' && _showExpense === 'T');
            // hide the buttons if they don't have access to the custom record type
            var recordAccess = getRecordAccess(['customrecord_bb_project_bom', 'customrecord_bb_project_adder', 'customrecord_bb_proj_exp_budget']);
            _showBom = _showBom && recordAccess['customrecord_bb_project_bom'].hasPermission;
            _showAdder = _showAdder && recordAccess['customrecord_bb_project_adder'].hasPermission;
            _showExpense = _showExpense && recordAccess['customrecord_bb_proj_exp_budget'].hasPermission;
            switch (trigger) {
                case 'view':
                case 'edit':
                case 'xedit':
                    if (showBomAdderSublist) {
                        if (_showBom) {
                            inlineEditor.createBOMSublist(scriptContext);
                            addGenerateBomReportButton(scriptContext);
                        }
                        if (_showAdder) {
                            inlineEditor.createAdderSublist(scriptContext, config);
                        }
                        if (_showExpense) {
                            inlineEditor.createExpenseSublist(scriptContext, config);
                        }
                    } else {
                        //add suitelet button here on form for boms and adders
                        scriptContext.form.clientScriptModulePath = './BB SS/SS Lib/BB.CLI.SL.ValidationsAndButtons';
                        if (_showBom) {
                            callBomSuitelet(scriptContext);
                            addGenerateBomReportButton(scriptContext);
                        }
                        //addGenerateBomReportButton(scriptContext);
                        if (_showAdder && category == HOMEOWNER) {
                            callAdderSuitelet(scriptContext);
                        }
                        if (_showExpense && category != HOMEOWNER) {
                            callExpenseSuitelet(scriptContext);
                        }
                        if (cosAccessRoles.indexOf(currentUser.role.toString()) > -1) {
                            callChangeOfScopeSuitelet(scriptContext);
                        }
                    }
                    addPauseProjectButton(scriptContext, config);
                    callAiaSuitelet(scriptContext, config);
                    break;
            }
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function getRecordAccess(customRecordsToAccess) {
            /*
             * Check permission levels for these custom records and for the transactions before we put up the buttons
             */
            var userObj = runtime.getCurrentUser();
            /***************  Custom Object Permissions *****************************/
            var records = {};
            for (var i in customRecordsToAccess) {
                var customRecordName = customRecordsToAccess[i];
                records[customRecordName] = {
                    hasPermission: false
                };
            }
            var permissionLevels = ['NONE', 'VIEW', 'CREATE', 'EDIT', 'FULL'];
            // var customRecordPermission = permissionLevels[userObj.getPermission('LIST_CUSTRECORDENTRY')];
            var customRecordPermission = permissionLevels[userObj.getPermission('ADMI_CUSTRECORD')];
            // if the user doesn't have the permission above, no need to continue
            // however, this is already a custom record so they are already past that permission
            for (var r in records) {
                // Check the permission level for each custom record
                try { // just in case the user doesn't have permission to custom records
                    records[r].id = getRecordId(r);
                    if (!records[r].id) {
                        log.error('getRecordAccess record not found', records[r]);
                        continue;
                    }
                    var custRec = record.load({
                        type: 'customrecordtype',
                        id: records[r].id
                    }).toJSON();
                    // USEPERMISSIONLIST  |  NONENEEDED  |  CUSTRECORDENTRYPERM
                    if (custRec.fields.accesstype == 'NONENEEDED') {
                        records[r].hasPermission = true;
                    } else if (custRec.fields.accesstype == 'CUSTRECORDENTRYPERM') {
                        records[r].hasPermission = customRecordPermission == 'FULL';
                    } else {
                        // USEPERMISSIONLIST - search the lines to get the permission level
                        for (var key in custRec.sublists.permissions) {
                            if (key.indexOf('line') == 0) {
                                // Check the permission level set on the custom record to see if the user's role matches
                                var recPerm = custRec.sublists.permissions[key];
                                if (userObj.role === 3 || (userObj.role == recPerm.permittedrole && (permissionLevels[recPerm.permittedlevel] == 'FULL' || permissionLevels[recPerm.permittedlevel] == 'EDIT'))) {
                                    records[r].hasPermission = true;
                                }
                            }
                        }
                    }
                } catch (e) {
                    log.error(e.name, e.message);
                }
            }
            return records;
        }

        /**
         * beforeLoad > addSuiteletButtons > getRecordAccess
         */
        function getRecordId(scriptId) {
            var id;
            if (scriptId.indexOf('customlist') == 0)
                searchModule.create({ type: 'customlist', filters: [['scriptid', 'is', scriptId]] }).run().each(function (r) { id = r.id });
            else if (scriptId.indexOf('customrecord') == 0)
                searchModule.create({ type: 'customrecordtype', filters: [['scriptid', 'is', scriptId]] }).run().each(function (r) { id = r.id });
            else if (scriptId.indexOf('customdeploy') == 0)
                searchModule.create({ type: 'scriptdeployment', filters: [['scriptid', 'is', scriptId]] }).run().each(function (r) { id = r.id });
            return id;
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function addGenerateBomReportButton(scriptContext) {
            if (scriptContext.type != scriptContext.UserEventType.VIEW) {
                return;
            }
            scriptContext.form.addButton({
                id: 'custpage_generatebomrep',
                label: 'Print BOM',
                functionName: 'callBOMReport'
            });
        }
        /**
         * beforeLoad > addSuiteletButtons
         */
        function callBomSuitelet(scriptContext) {
            scriptContext.form.addButton({
                id: 'custpage_add_bom_records',
                label: 'Manage BOM',
                functionName: 'callBomSuitelet'
            });
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function callAdderSuitelet(scriptContext) {
            scriptContext.form.addButton({
                id: 'custpage_adder_records',
                label: 'Manage Adders',
                functionName: 'callAdderSuitelet'
            });
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function callExpenseSuitelet(scriptContext) {
            scriptContext.form.addButton({
                id: 'custpage_expense_records',
                label: 'Manage Budget',
                functionName: 'callExpenseSuitelet'
            });
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function callChangeOfScopeSuitelet(scriptContext) {
            scriptContext.form.addButton({
                id: 'custpage_change_of_scope',
                label: 'Change of Scope',
                functionName: 'callChangeOfScopeSuitelet'
            });
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function addPauseProjectButton(scriptContext, config) {
            if (config.getValue({ fieldId: 'custrecord_bb_exp_resp_calc_method' }) == EXPECTED_RESPONSE_CALC_METHOD_GANTT)
                scriptContext.form.addButton({
                    id: 'custpage_pause_project',
                    label: 'Pause Project',
                    functionName: 'callPauseProject'
                });
        }

        /**
         * beforeLoad > addSuiteletButtons
         */
        function callAiaSuitelet(scriptContext, config) {
            if (config.getValue({ fieldId: 'custrecord_bb_ss_show_pay_app' })) {
                scriptContext.form.addButton({
                    id: 'custpage_add_payment_application',
                    label: 'Payment Application',
                    functionName: 'callAiaSuitelet'
                });
            }
        }



        /**
         * Function shows the copy project button to admins
         * beforeLoad
         * @governance 0 Units
         * @param {Object} context - context of the request
         * @param {Object} newRecord - new project record
         */
        function addCopyProjectButton(context, newRecord) {
            if (context.type == context.UserEventType.VIEW) {
                var copyProjectBtnSetting = searchModule.lookupFields({
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: 1,
                    columns: ['custrecord_bb_shw_cp_prj_btn']
                });
                //                log.debug('copyProjectBtnSetting', copyProjectBtnSetting);
                if (copyProjectBtnSetting.custrecord_bb_shw_cp_prj_btn) {
                    var copyTo = newRecord.getValue({ fieldId: "custentity_bb_copy_to" });
                    var roleId = runtime.getCurrentUser().role;
                    var suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_bb_sl_copyproject',
                        deploymentId: 'customdeploy_bb_sl_copyproject',
                        params: {
                            recordId: context.newRecord.id
                        }
                    });
                    var fullURL = "https://" + url.resolveDomain({ hostType: url.HostType.APPLICATION }) + suiteletUrl;
                    context.form.addButton({
                        id: 'custpage_copyproject',
                        label: 'Copy Project',
                        functionName: "callCopyProjectSuitelet"
                    });
                    if (copyTo && roleId != 3) {
                        context.form.removeButton({ id: "edit" })
                    }
                }
            }
        }

        /**
         * beforeLoad
         */
        function addGetSiteDevicesButton(form, rec) {
            if (rec.id) {
                var sublist = form.getSublist({
                    id: 'recmachcustrecord_bb_ss_device_proj'
                });// subtab internal ID on where you would like the button to show
                if (sublist) {
                    sublist.addButton({
                        id: 'custpage_buttonid',
                        label: 'Load Devices',
                        functionName: "callLoadDevices"
                    });
                }
            }
        }

        /**
         * Trigger function
         */
        function beforeSubmit(scriptContext) {
            if (scriptContext.type == scriptContext.UserEventType.CREATE ||
                (scriptContext.newRecord.getFields().indexOf('custentity_bb_ob_project_uuid') >= 0 && !scriptContext.newRecord.getValue({ fieldId: 'custentity_bb_ob_project_uuid' }))) {
                // set the UUID for this project
                scriptContext.newRecord.setValue({ fieldId: 'custentity_bb_ob_project_uuid', value: create_UUID() });
            }
            if (scriptContext.type !== scriptContext.UserEventType.EDIT)
                return;
            try {
                var values = {};
                var project = scriptContext.newRecord;
                accountingFields.setAccountingFields(project, false, values); //180 Units of execution ????
                //set commission value history turned off 12/31/2020 ML not currently being used/executed
            }
            catch (e) {
                log.error("accounting Fields", e);
            }
        }

        /**
         * beforeSubmit
         */
        function create_UUID() {
            var dt = new Date().getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (dt + Math.random() * 16) % 16 | 0;
                dt = Math.floor(dt / 16);
                return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            return uuid;
        }


        /**
         * Trigger function
         */
        function afterSubmit(scriptContext) {
            try {

                var trigger = scriptContext.type;
                //var project = scriptContext.newRecord;
                var _changedFields = {};
                var oldRecord = scriptContext.oldRecord;
                var newRecord;
                //                log.debug('execution context', runtime.executionContext);
                switch (trigger) {
                    case 'create':
                    case 'edit':
                    case 'xedit':
                        log.debug('runtime user context', runtime.executionContext)
                        if (trigger == 'xedit') {
                            var project = record.load({
                                type: record.Type.JOB,
                                id: scriptContext.newRecord.id,
                                isDynamic: true
                            })
                            newRecord = project
                        } else {
                            var project = scriptContext.newRecord;
                            newRecord = scriptContext.newRecord
                        }
                        //loading projec to allow for bom sublist submission using recmach method
                        //update here to run search on config record
                        var config = record.load({
                            type: 'customrecord_bb_solar_success_configurtn',
                            id: (newRecord.getValue({ fieldId: 'custentity_bbss_configuration' })) ? newRecord.getValue({ fieldId: 'custentity_bbss_configuration' }) : 1
                        });
                        var tcv = project.getValue({ fieldId: 'custentity_bb_total_contract_value_amt' });
                        log.audit('Project total contract value', tcv);
                        // update project action doc templates
                        if (runtime.executionContext == 'USERINTERFACE' || runtime.executionContext == 'USEREVENT' || runtime.executionContext == runtime.ContextType.CSV_IMPORT) {
                            docLib.updateEntityDocumentTemplateData(scriptContext, newRecord, oldRecord); // update project action doc templates
                        }
                        //add bom records
                        addModInverterBomItems(scriptContext, newRecord, oldRecord, config);
                        var solarSalesItems = upsertSalesOrder.getSolarConfigSalesItems();
                        // checks for milestone dates entered - compares old record to new record
                        _changedFields = milestoneTransctions.generateMilestoneTransactions(scriptContext, config, _changedFields)
                        var projectType = project.getValue({
                            fieldId: 'jobtype'
                        });
                        if (projectType == 1) { // 1 = EPC Project Type
                            var epcRole = project.getValue({
                                fieldId: 'custentity_bb_epc_role'
                            });
                        }
                        if (epcRole != 2) { // 2 = Originator
                            var salesOrderId;
                            // process sublist with new check box feature else process is complete with suitelet
                            var processSublist = config.getValue({ fieldId: 'custrecord_bb_show_bom_adder_sublist' });
                            if (processSublist) {
                                //                                log.debug('running sublist on project form')
                                salesOrderId = inlineEditor.upsertBomItemLines(project, scriptContext, _changedFields, solarSalesItems); // 99 units with 2 items + 6-8 units per each item
                                inlineEditor.upsertAdderItems(project, scriptContext, solarSalesItems, salesOrderId, _changedFields); // 70 units with no items + 2-4 units per each adder item
                            }
                        }
                        // create adv schedule
                        try {
                            var finTemplate = project.getValue({ fieldId: 'custentity_bb_financier_adv_pmt_schedule' });
                            if (finTemplate && project.id) {
                                advMod.createMilestoneFromProjectAutomation(finTemplate, project);
                            }
                            var advTotal = parseFloat(advMod.getAdvPaymentScheduleTotal(project.id));
                            var contractAmt = parseFloat(project.getValue({ fieldId: 'custentity_bb_fin_prelim_purch_price_amt' }));
                            if (advTotal > 0 && contractAmt) {
                                _changedFields['custentity_bb_adv_payment_schdl_tot_amt'] = advTotal;
                                _changedFields['custentity_bb_adv_payment_schdl_percent'] = (advTotal / contractAmt) * 100;
                                _changedFields['custentity_bb_adv_payment_schdl_count'] = advMod.getAdvPaymentScheduleRecordCount(project.id);
                            }
                        } catch (e) {
                            log.error('error generating advanced payment schedule', e);
                        }
                        // save project in library file
                        _changedFields = accountingFields.setAccountingFields(project, true, _changedFields);
                        var projectUE = runtime.getCurrentScript();
                        log.debug('Remaining governance units', projectUE.getRemainingUsage());
                        break;

                    case 'delete':
                        break;
                }

            } catch (e) {
                log.error('ERROR', e);
                log.error('ERROR Line Number', e.lineNumber);
                log.error('ERROR Line message', e.message);
            }
            try {
                if (scriptContext.type == 'edit' || scriptContext.type == 'xedit') {
                    projectService.changeProjectTemplate(scriptContext.newRecord, scriptContext.oldRecord);
                }
            } catch (e) {
                log.error('error', e);
                throw e;
            }
        }

        /**
         * afterSubmit
         */
        function addModInverterBomItems(scriptContext, newRecord, oldRecord, config) {
            var projectId = newRecord.getValue({ fieldId: 'entityid' });
            log.debug('projectid bom adder automation check', projectId);
            if (!projectId) return;
            // stop bom automation process if invoice actuals is turned on.
            if (config.getValue({ fieldId: 'custrecord_bb_invoice_actuals_boolean' })) return;
            var salesOrderItemArr = [];
            var salesOrderObj = {};
            var project = newRecord;
            var oldProject = oldRecord;
            var useSubsids = config.getValue({ fieldId: 'custrecord_bb_ss_has_subsidiaries' });
            salesOrderObj['project'] = project.id;
            salesOrderObj['automated'] = true;
            salesOrderObj['soId'] = (project.getValue({ fieldId: 'custentity_bb_project_so' })) ? project.getValue({ fieldId: 'custentity_bb_project_so' }) : findProjectSalesOrder(project.id);
            if (useSubsids) {
                salesOrderObj['subsidiary'] = project.getValue({ fieldId: 'subsidiary' });
            }
            var bomRecords = inlineEditor.getSublistValues(project.id, null, 'BOM');
            log.audit('bomRecords', bomRecords);
            salesOrderItemArr = processBOMAutomationRecords(scriptContext, project, oldProject, bomRecords, salesOrderItemArr);
            log.debug('salesOrderItemArr', salesOrderItemArr);
            // should only process boms if changes are made to items or quantity.
            if (salesOrderItemArr.length > 0) {
                // create tasks and send details to scheduled script.
                salesOrderObj['items'] = salesOrderItemArr;
                var taskParameters = {};
                taskParameters['custscript_bb_ss_bom_item_array'] = [salesOrderObj];
                var scriptId = 'customscript_bb_ss_proj_bom_so_process';
                var deploymentId = 'customdeploy_bb_ss_proj_bom_so_proc';
                var taskType = task.TaskType.SCHEDULED_SCRIPT;
                try {
                    batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
                } catch (e) {
                    log.error('error submitting bom automation records', e);
                }
            }
        }

        /**
         * afterSubmit > addModInverterBomItems
         */
        function findProjectSalesOrder(projectId) {
            var soId = null;
            if (projectId) {
                var salesorderSearchObj = searchModule.create({
                    type: "salesorder",
                    filters:
                        [
                            ["type", "anyof", "SalesOrd"],
                            "AND",
                            ["custbody_bb_project", "anyof", projectId],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns:
                        [
                            "internalid"
                        ]
                });
                var soRecords = salesorderSearchObj.run().getRange({
                    start: 0,
                    end: 1
                });
                if (soRecords.length > 0) {
                    soId = soRecords[0].getValue({ name: 'internalid' });
                }
            }
            return soId;
        }

        /**
         * afterSubmit > addModInverterBomItems
         */
        function processBOMAutomationRecords(scriptContext, project, oldProject, bomRecords, salesOrderItemArr) {
            // run search on bom automation records
            var customrecord_bb_bom_automationSearchObj = searchModule.create({
                type: "customrecord_bb_bom_automation",
                filters:
                    [
                        ["custrecord_bb_bom_auto_config_record", "anyof", "1"]
                    ],
                columns:
                    [
                        "internalid",
                        "custrecord_bb_bom_auto_item_field_id",
                        "custrecord_bb_bom_auto_qty_field_id",
                        "custrecord_bb_bom_auto_def_qty_field_num"
                    ]
            });
            customrecord_bb_bom_automationSearchObj.run().each(function (result) {
                var qty;
                var oldQty;
                var defaultQty = result.getValue({ name: 'custrecord_bb_bom_auto_def_qty_field_num' });
                var item = parseInt(project.getValue({ fieldId: result.getValue({ name: 'custrecord_bb_bom_auto_item_field_id' }) }));
                var oldItem = (scriptContext.type != 'create') ? parseInt(oldProject.getValue({ fieldId: result.getValue({ name: 'custrecord_bb_bom_auto_item_field_id' }) })) : null;
                if (defaultQty) {
                    qty = defaultQty;
                } else {
                    qty = (project.getValue({ fieldId: result.getValue({ name: 'custrecord_bb_bom_auto_qty_field_id' }) })) ?
                        project.getValue({ fieldId: result.getValue({ name: 'custrecord_bb_bom_auto_qty_field_id' }) }) : 1;
                    oldQty = (oldProject.getValue({ fieldId: result.getValue({ name: 'custrecord_bb_bom_auto_qty_field_id' }) })) ?
                        oldProject.getValue({ fieldId: result.getValue({ name: 'custrecord_bb_bom_auto_qty_field_id' }) }) : 1;
                }
                salesOrderItemArr = processBomUpdates(project, oldProject, item, qty, oldItem, oldQty, bomRecords, salesOrderItemArr);
                return true;
            });
            return salesOrderItemArr;
        }

        /**
         * afterSubmit > addModInverterBomItems > processBOMAutomationRecords
         */
        function processBomUpdates(project, oldProject, itemId, itemQty, oldItemId, oldQty, bomRecords, salesOrderItemArr) {
            log.audit('itemId', itemId);
            log.audit('itemQty', itemQty);
            log.audit('oldItemId', oldItemId);
            log.audit('oldQty', oldQty);
            // log.audit('salesOrderItemArr', salesOrderItemArr);
            if (bomRecords.length > 0 && itemId) {
                // fix index lookup both item id from bomrecord search and
                var index = bomRecords.map(function (data) { return data.bomItem; }).indexOf(itemId);
                if (index != -1) {
                    if (itemId != bomRecords[index].bomItem || itemQty != bomRecords[index].bomQty) {
                        salesOrderItemArr = upsertBomData(itemId, itemQty, bomRecords[index].bomId, project.id, salesOrderItemArr, project);
                    }
                } else {
                    // bom record could have changed items or qty
                    if (itemId != oldItemId && itemId && oldItemId) {
                        //log.debug('old bom record found, updating the bom record with new item id');
                        var oldLookIndex = bomRecords.map(function (data) { return data.bomItem; }).indexOf(oldItemId);
                        salesOrderItemArr = upsertBomData(itemId, itemQty, bomRecords[oldLookIndex].bomId, project.id, salesOrderItemArr, project);
                    } else if (itemId) {
                        //log.debug('old bom record didnt match, creating a new one');
                        log.debug('item id for new bom record', itemId);
                        // new bom record
                        salesOrderItemArr = upsertBomData(itemId, itemQty, null, project.id, salesOrderItemArr, project);
                    }
                }
            } else if (itemId) {
                // adds new bom when there are not bom records created on the project yet
                salesOrderItemArr = upsertBomData(itemId, itemQty, null, project.id, salesOrderItemArr, project);
            } else if (oldItemId && !itemId && bomRecords.length > 0) {
                //if the current bom item is empty and old bom record has a value remove the bom record
                log.debug('oldItemId in delete', oldItemId);
                log.debug('itemId in delete', itemId);
                log.debug('project context in delete', project);
                log.debug('old project context in delete', oldProject);
                var deleteIndex = bomRecords.map(function (data) { return data.bomItem; }).indexOf(oldItemId);
                if (deleteIndex != -1) {
                    salesOrderItemArr = deleteBomData(oldItemId, itemQty, bomRecords[deleteIndex].bomId, project.id, salesOrderItemArr);
                }
            }
            return salesOrderItemArr;
        }

        /**
         * afterSubmit > addModInverterBomItems > processBOMAutomationRecords > processBomUpdates
         */
        function upsertBomData(itemId, qty, bomId, projectId, array, project) {
            var bomObj = {
                itemId: itemId,
                quantity: qty,
                projectId: projectId,
                bomId: bomId
            };
            array.push(bomObj);
            return array;
        }

        /**
         * afterSubmit > addModInverterBomItems > processBOMAutomationRecords > processBomUpdates
         */
        function deleteBomData(itemId, qty, bomId, projectId, array, project) {
            deleteObj = {
                itemId: itemId,
                quantity: qty,
                bomId: bomId,
                projectId: projectId,
                delete: true
            }
            array.push(deleteObj);
            return array;
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };

    });