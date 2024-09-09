/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 * @author Michael Golichenko
 * @version 0.0.1
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

define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/format', './BB SS/SS Lib/BB_SS_MD_SolarConfig', './BB SS/SS Lib/BB.SS.MD.CustomSublist'],
    function(recordModule, searchModule, serverWidgetModule, formatModule, solarConfigModule, customSublistService) {

        var _vendorLicenseTabId = solarConfigModule.getConfiguration('custrecord_bb_vend_lic_sublist_tab_id').value;
        var _vendorInsuranceTabId = solarConfigModule.getConfiguration('custrecord_bb_vend_insur_sublist_tab_id').value;
        log.debug('sublist license tab id', _vendorLicenseTabId);
        log.debug('sublist insurance tab id', _vendorInsuranceTabId);
        var _vendorLicenceSublist = customSublistService.createCustomSublist();
        _vendorLicenceSublist
            .setTabId(_vendorLicenseTabId)
            .setSublistRecordType('customrecord_bb_vendor_license')
            .setSublistId('custpage_vendor_license_list')
            .setSublistLabel('Vendor License')
            .setFilter(function(){ return [['custrecord_bb_vendor', 'ANYOF', [this.recordId]]]; })
            .setFieldMapping('custpage_license_id', 'internalid', serverWidgetModule.FieldType.INTEGER, 'ID', undefined, false, serverWidgetModule.FieldDisplayType.DISABLED)
            .setFieldMapping('custpage_license_vendor', 'custrecord_bb_vendor', serverWidgetModule.FieldType.SELECT, 'VENDOR', 'vendor', false, serverWidgetModule.FieldDisplayType.HIDDEN)
            .setFieldMapping('custpage_license_status', 'custrecord_bb_license_enroll_doc_status', serverWidgetModule.FieldType.SELECT, 'LICENSE STATUS', 'customlist_bb_insurance_document_statu')
            .setFieldMapping('custpage_license_status_change_date', 'custrecord_bb_license_status_change_date', serverWidgetModule.FieldType.DATE, 'LICENSE STATUS DATE', undefined, false, undefined, formatModule.Type.DATE)
            .setFieldMapping('custpage_license_verified', 'custrecord_bb_license_verified_date', serverWidgetModule.FieldType.DATE, 'LICENSE VERIFIED', undefined, false, undefined, formatModule.Type.DATE)
            .setFieldMapping('custpage_license_state', 'custrecord_bb_license_state', serverWidgetModule.FieldType.SELECT, 'LICENSE STATE', 'customrecord_bb_state')
            .setFieldMapping('custpage_license_number', 'custrecord_bb_license_number_text', serverWidgetModule.FieldType.TEXT, 'LICENSE NUMBER')
            .setFieldMapping('custpage_license_type', 'custrecord_bb_license_type', serverWidgetModule.FieldType.SELECT, 'LICENSE TYPE', 'customlist_bb_license_type')
            .setFieldMapping('custpage_license_expiration', 'custrecord_bb_license_expiration_date', serverWidgetModule.FieldType.DATE, 'LICENSE EXPIRATION', undefined, false, undefined, formatModule.Type.DATE);

        var _vendorInsuranceSublist = customSublistService.createCustomSublist();
        _vendorInsuranceSublist
            .setTabId(_vendorInsuranceTabId)
            .setSublistRecordType('customrecord_bb_vendor_insurance')
            .setSublistId('custpage_vendor_insurance_list')
            .setSublistLabel('Vendor Insurance')
            .setFilter(function(){ return [['custrecord_bb_insurance_vendor', 'ANYOF', [this.recordId]]]; })
            .setFieldMapping('custpage_insurance_id', 'internalid', serverWidgetModule.FieldType.INTEGER, 'ID', undefined, false, serverWidgetModule.FieldDisplayType.DISABLED)
            .setFieldMapping('custpage_insurance_vendor', 'custrecord_bb_insurance_vendor', serverWidgetModule.FieldType.SELECT, 'VENDOR', 'vendor', false, serverWidgetModule.FieldDisplayType.HIDDEN)
            .setFieldMapping('custpage_insurance_type', 'custrecord_bb_insurance_type', serverWidgetModule.FieldType.SELECT, 'INSURANCE TYPE', 'customlist_bb_insurance_type')
            .setFieldMapping('custpage_insurance_p_type', 'custrecord_bb_insurance_policy_type', serverWidgetModule.FieldType.SELECT, 'POLICY TYPE', 'customlist_bb_insurance_policy_type')
            .setFieldMapping('custpage_insurance_status', 'custrecord_bb_insurance_enroll_doc_stat', serverWidgetModule.FieldType.SELECT, 'INSURANCE STATUS', 'customlist_bb_insurance_document_statu')
            .setFieldMapping('custpage_insurance_status_date', 'custrecord_bb_ins_status_change_date', serverWidgetModule.FieldType.DATE, 'INSURANCE STATUS DATE', undefined, false, undefined, formatModule.Type.DATE)
            .setFieldMapping('custpage_insurance_policy_amount', 'custrecord_bb_policy_amount', serverWidgetModule.FieldType.CURRENCY, 'POLICY AMOUNT')
            .setFieldMapping('custpage_insurance_state', 'custrecord_bb_insurance_state', serverWidgetModule.FieldType.SELECT, 'INSURANCE STATE', 'customrecord_bb_state')
            .setFieldMapping('custpage_insurance_expiration', 'custrecord_bb_insurance_expiration_date', serverWidgetModule.FieldType.DATE, 'INSURANCE EXPIRATION', undefined, false, undefined, formatModule.Type.DATE)
            .setFieldMapping('custpage_insurance_min_policy_amount', 'custrecord_bb_minimum_policy_amount', serverWidgetModule.FieldType.CURRENCY, 'MINIMUM POLICY AMOUNT')
            .setFieldMapping('custpage_insurance_rejection_comments', 'custrecord_bb_ins_rejection_comments', serverWidgetModule.FieldType.TEXTAREA, 'REJECTION COMMENTS')
            .setFieldMapping('custpage_insurance_reject_comm_history', 'custrecord_bb_ins_reject_comm_history', serverWidgetModule.FieldType.TEXTAREA, 'REJECTION COMMENT HISTORY', undefined, false, serverWidgetModule.FieldDisplayType.READONLY);

        function beforeLoad (scriptContext) {
            try {
                var trigger = scriptContext.type;
                switch(trigger) {
                    case 'view':
                    case 'edit':
                    case 'xedit':
                        _vendorLicenceSublist
                            .setForm(scriptContext.form)
                            .setRecordId(scriptContext.newRecord.id)
                            .render();
                        _vendorInsuranceSublist
                            .setForm(scriptContext.form)
                            .setRecordId(scriptContext.newRecord.id)
                            .render();
                        break;
                }
            } catch (e) {
                log.error('ERROR', e);
            }
        }


        function afterSubmit(scriptContext) {
            try {
                var trigger = scriptContext.type;
                //var _todayDate = formatModule.format({value: new Date(),type:format.Type.DATE});
                switch (trigger) {
                    //case 'create':
                    case 'edit':
                    case 'xedit':
                        _vendorLicenceSublist
                            .setRecord(scriptContext.newRecord)
                            .setRecordId(scriptContext.newRecord.id)
                            .on('before.item.insert', function(insertItem){
                                insertItem['custrecord_bb_vendor'] = { value: this.recordId };
                            })
                            .upsert();
                        _vendorInsuranceSublist
                            .setRecord(scriptContext.newRecord)
                            .setRecordId(scriptContext.newRecord.id)
                            .on('before.item.insert', function(insertItem){
                                insertItem['custrecord_bb_insurance_vendor'] = { value: this.recordId };
                            })
                            .upsert();
                        break;
                    case 'delete':
                        break;
                }
            } catch (e) {
                log.error('ERROR', e);
            }
        }

        return {
            beforeLoad: beforeLoad,
            afterSubmit: afterSubmit
        };

    });