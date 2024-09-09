/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
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

define(['N/record', 'N/search', 'N/runtime'],

    function(record, search, runtime) {

        function beforeSubmit(scriptContext){
            try {
                var transaction = scriptContext.newRecord;
                var transactionId = transaction.id;
                var trigger = scriptContext.type;
                var recType = transaction.type;
                log.debug('record type', recType);
                switch (trigger) {
                    case 'create':
                    case 'edit':
                    case 'xedit':
                        var projectId = transaction.getValue({fieldId: 'custbody_bb_project'});
                        var dateCreated = (transaction.getValue({fieldId: 'createddate'})) ? new Date(transaction.getValue({fieldId: 'createddate'})) : null;
                        if (projectId) {
                            var projObj = search.lookupFields({
                                type: search.Type.JOB,
                                id: projectId,
                                columns: ['custentity_bb_ss_accrual_journal', 'custentity_bb_accrual_je_created_date']
                            });
                            var accrualJe = (projObj.custentity_bb_ss_accrual_journal.length > 0) ? projObj.custentity_bb_ss_accrual_journal[0].value : null;
                            if (accrualJe) {
                                var accrualObj = search.lookupFields({
                                    type: search.Type.JOURNAL_ENTRY,
                                    id: accrualJe,
                                    columns: ['datecreated']
                                });
                                var recognitionDate = new Date(accrualObj.datecreated);

                            }
                            log.debug('recognition date created', recognitionDate);
                            log.debug('transaction date created', dateCreated);
                            // var recognitionDate = (projObj.custentity_bb_accrual_je_created_date) ? new Date(projObj.custentity_bb_accrual_je_created_date) : null;
                            if (accrualJe && dateCreated > recognitionDate && dateCreated && recognitionDate) {
                                transaction.setValue({
                                    fieldId: 'custbody_bb_project',
                                    value: null
                                });
                                transaction.setValue({
                                    fieldId: 'custbody_bb_project',
                                    value: projectId
                                });
                            }
                        }
                    break;
                }
            } catch (e) {
                log.error('error updating project field', e);
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };

    });
