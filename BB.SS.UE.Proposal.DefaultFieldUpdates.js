/**
 * This is a Proposal default field values processing
 *
 * @exports BB.SS.UE.Proposal.DefaultFieldUpdates
 *
 * @author Michael Golichenko <mgolichenko@bluebanyansolutions.com>
 * @version 0.0.1
 *
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 **/

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define([
    './BB SS/SS Lib/BB.SS.Proposal.Service'
    ,'./BB SS/SS Lib/BB.SS.Lead.Service'
    ,'./BB SS/SS Lib/BB.SS.Project.Service'
    ,'./BB SS/SS Lib/BB.SS.Proposal.Model'
    ,'./BB SS/SS Lib/BB.SS.Lead.Model'
    ,'./BB SS/SS Lib/BB.SS.Project.Model'
    ,'./BB SS/SS Lib/BB_SS_MD_SolarConfig.js'
    ],
    /**
     *
     * @param proposalService {module:ProposalService}
     * @param leadService {module:LeadService}
     * @param projectService {module:ProjectService}
     * @param proposalModel {module:ProposalModel}
     * @param leadModel {module:LeadModel}
     * @param projectModel {module:ProjectModel}
     *
     * @return {{beforeSubmit: beforeSubmit, afterSubmit: afterSubmit}}
     */
    function(proposalService, leadService, projectService, proposalModel, leadModel, projectModel, solarConfig) {
        /**
         * Function definition to be triggered before record is saved.
         *
         * @governance 0, 12+
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {
            try {
                var trigger = scriptContext.type;
                if (trigger == 'create' || trigger == 'edit' || trigger == 'xedit') {
                    if(trigger == 'create'){
                        proposalService.setProposalSequenceNumber(scriptContext.newRecord, false);
                    }
                    log.debug('before submit new record', JSON.stringify(scriptContext.newRecord));
                    proposalService.uncheckSelectedProposals(scriptContext.newRecord);
                }
            } catch(error){
                log.error('error', error);
            }
        }
        /**
         * Function definition to be triggered before record is saved.
         *
         * @governance 0, 10, 15
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext){
            try {
                log.debug('is selected', proposalService.isProposalSelected(scriptContext.newRecord));
                if(proposalService.isProposalSelected(scriptContext.newRecord)) {
                    var _leadId = scriptContext.newRecord.getValue({fieldId: proposalModel.CustomFields.LEAD_REF}),
                        _projectTemplateId = scriptContext.newRecord.getValue({fieldId: proposalModel.CustomFields.PROJECT_TEMPLATE_REF}),
                        _lead = leadService.getLeadRecordById(_leadId),
                        _projectTemplate = projectService.getProjectRecordById(_projectTemplateId),
                        _financingType = _projectTemplate.getValue({fieldId: projectModel.CustomFields.FINANCING_TYPE}),
                        _financier = _projectTemplate.getValue({fieldId: projectModel.CustomFields.FINANCIER_REF});
                    log.debug('financing type',  _financingType);
                    if (_financingType) {
                        _lead.setValue({fieldId: leadModel.CustomFields.FINANCING_TYPE, value: _financingType});
                        log.debug('financier',  _financier);
                        if (_financingType == 1) { // 1 = Cash Financing Type
                            var configField = ['custrecord_bb_cash_payment_schedule'];
                            var paymentSchedule = solarConfig.getConfigurations(configField);
                            var cashPaymentSchedule = paymentSchedule.custrecord_bb_cash_payment_schedule.value;
                            _lead.setValue({fieldId:'custentity_bb_financier_payment_schedule', value: cashPaymentSchedule});
                        }
                        if (_financier) {
                            _lead.setValue({fieldId: leadModel.CustomFields.FINANCIER_REF, value: _financier});
                        }
                        _lead.save();
                    }
                }
            } catch(error){
                log.error('error', error);
            }
        }

        return {
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });