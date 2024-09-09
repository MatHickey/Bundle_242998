/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Generate Advanced Payment Schedule Journal Entry.
 */
define(['N/record', 'N/search', 'N/runtime', './BB SS/SS Lib/BB.SS.AccrualJournal'],

function(record, search, runtime, revenueJournal) {
        // Journal fields  
        var      
        JOURNAL_PROJECT_FIELD = 'custbody_bb_project',
        JOURNAL_MILESTONE_FIELD = 'custbody_bb_milestone',
        JOURNAL_SUBSIDIARY_FIELD = 'subsidiary',

        JOURNAL_LINE_RECORD = 'line',
        JOURNAL_LINE_ACCOUNT_FIELD = 'account',
        JOURNAL_LINE_DEBIT_FIELD = 'debit',
        JOURNAL_LINE_CREDIT_FIELD = 'credit',
        JOURNAL_LINE_PROJECT_FIELD = 'entity',
        JOURNAL_LINE_MEMO_FIELD = 'memo',
        //search fields
        JOURNAL_MILESTONE_ID = '7'//Accrual
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @Since 2016.1
     */
    function onAction(scriptContext) {
        try {
            var projectAction = scriptContext.newRecord;
            var packageAction = projectAction.getValue({
                fieldId: 'custrecord_bb_project_package_action'
            });
            var projectId = projectAction.getValue({
                fieldId: 'custrecord_bb_project'
            });
            var bbConfigId = projectAction.getValue({
                fieldId: 'custrecord_bb_proj_action_config_record'
            }) || 1;
            var statusType = projectAction.getValue({fieldId: 'custrecord_bb_action_status_type'});

            //returns an array of objects that match the project and package action
            var advRecords = getAdvancedMilestoneScheduleForJournals(projectId, packageAction);
            log.debug('advRecords', advRecords);
            log.debug('status type', statusType);
            if (advRecords.length > 0 && statusType == 4) {
                // create journal entry records
                for (var i = 0; i < advRecords.length; i++) {
                    // execute if no transaction set and trans type is journal entry
                    if (!advRecords[i].custrecord_bbss_adv_subpay_transaction && advRecords[i].custrecord_bbss_adv_subpay_trans_type == 1) {
                        log.debug('executing JE');
                        // change this code create
                        // var jeId = generationJournalEntry(advRecords[i], bbConfigId);
                        if (projectId) {
                            var project = record.load({
                                type: record.Type.JOB,
                                id: projectId,
                                isDynamic: true
                            });
                            var config = record.load({
                                type: 'customrecord_bb_solar_success_configurtn',
                                id: bbConfigId
                            });
                            var jeId = revenueJournal.createProjectedRevenueRecognitionJe(project, config, advRecords[i]); 
                            if (advRecords[i].internalid && jeId) {
                                record.submitFields({
                                    type: 'customrecord_bbss_adv_sub_pay_schedule',
                                    id: advRecords[i].internalid,
                                    values: {
                                        'custrecord_bbss_adv_subpay_transaction': jeId,
                                        'custrecord_bbss_adv_subpay_recog_je': jeId,
                                        'custrecord_bbss_adv_subpay_milestonedate': new Date()
                                    },
                                    options: {
                                        ignoreMandatoryFields: true
                                    }
                                });
                            }
                            project.setValue({fieldId: 'custentity_bb_ss_accrual_journal', value: jeId});
                            project.save({
                                ignoreMandatoryFields: true
                            });
                        }
                    }
                }
            }
            return scriptContext.newRecord.id;

        } catch (e) {
            log.error('error generating advanced payment schedule journal transaction', e);
        }
    }

    function getAdvancedMilestoneScheduleForJournals(projectId, packageAction) {
        var array = [];
        var counter = 0;
        if (projectId && packageAction) {
            var advMilestoneScheduleSearch = search.create({
                type: "customrecord_bbss_adv_sub_pay_schedule",
                filters:
                [
                    ["custrecord_bbss_adv_subpay_project","anyof", projectId], 
                    "AND", 
                    ["custrecord_bbss_adv_subpay_trans_type","anyof","1"], 
                    "AND", 
                    ["custrecord_bbss_adv_subpay_action_list","anyof", packageAction]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internalid"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_project", label: "Project"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_milestone", label: "Milestone"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_amount", label: "Amount"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_amount_pct", label: "Amount %"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_dealer_amount", label: "Dealer Fee Amount"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_action_list", label: "Action"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_item_list", label: "Transaction Item"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_trans_type", label: "Transaction Type"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_recog_je_type", label: "Recognition JE Type"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_dealer_item", label: "Dealer Fee Item"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_milestonedate", label: "Milestone Date"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_transaction", label: "Transaction"}),
                    search.createColumn({name: "custrecord_bb_adv_subpay_already_invoic", label: "Already Invoiced?"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_recog_je", label: "Recognition JE"}),
                    search.createColumn({name: "custrecord_bbss_adv_subpay_trans_total", label: "Transaction Total"}),
                    search.createColumn({name: "subsidiary", join: 'CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT', label: "Subsidiary"}) 
                ]
            });
            var start = 0;
            var end = 1;
            var resultSet = advMilestoneScheduleSearch.run();
            var results = resultSet.getRange({
                start: start,
                end: end
            });
            for (var i = 0; i < results.length; i++) {
                var advObj = {};
                for (var c = 0; c < resultSet.columns.length; c++) {
                    if (!resultSet.columns[c].join) {
                        advObj[resultSet.columns[c].name] = (results[i].getValue({ name: resultSet.columns[c].name })) ? results[i].getValue({ name: resultSet.columns[c].name }) : null;
                    } else {
                        advObj[resultSet.columns[c].name] = (results[i].getValue({ name: resultSet.columns[c].name, join: resultSet.columns[c].join })) ? 
                            results[i].getValue({ name: resultSet.columns[c].name, join: resultSet.columns[c].join }) : null;
                    }
                }
                array.push(advObj);
            }
        }
        return array;
    }

    return {
        onAction : onAction
    };
    
});
