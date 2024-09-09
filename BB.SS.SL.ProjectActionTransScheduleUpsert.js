/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],

    function(record, search) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            log.debug('request data', context.request);
            if (context.request.method == 'POST') {
                log.debug('request parameters', context.request.parameters);
                var values = {};
                if (context.request.parameters.action == 'upsert') {
                    try {
                        log.debug('params', context.request.parameters);

                        if (context.request.parameters.id) {
                            if (context.request.parameters.custrecord_bb_pats_transaction_type) {
                                values['custrecord_bb_pats_transaction_type'] = context.request.parameters.custrecord_bb_pats_transaction_type;
                            }
                            if (context.request.parameters.custrecord_bb_pats_commit_srt_day_num) {
                                values['custrecord_bb_pats_commit_srt_day_num'] = context.request.parameters.custrecord_bb_pats_commit_srt_day_num;
                            }
                            if (context.request.parameters.custrecord_bb_pats_delivery_fm_start_ct) {
                                values['custrecord_bb_pats_delivery_fm_start_ct'] = context.request.parameters.custrecord_bb_pats_delivery_fm_start_ct;
                            }
                            if (context.request.parameters.custrecord_bb_pats_item) {
                                values['custrecord_bb_pats_item'] = context.request.parameters.custrecord_bb_pats_item;
                            }
                            if (context.request.parameters.custrecord_bb_pats_amount_num) {
                                values['custrecord_bb_pats_amount_num'] = context.request.parameters.custrecord_bb_pats_amount_num;
                            }
                            if (context.request.parameters.custrecord_bb_pats_entity) {
                                values['custrecord_bb_pats_entity'] = context.request.parameters.custrecord_bb_pats_entity;
                            }
                            if (context.request.parameters.custrecord_bb_pats_terms) {
                                values['custrecord_bb_pats_terms'] = context.request.parameters.custrecord_bb_pats_terms;
                            }
                            if (context.request.parameters.custrecord_bb_obligation_level) {
                                values['custrecord_bb_obligation_level'] = context.request.parameters.custrecord_bb_obligation_level;
                            }
                            if (context.request.parameters.custrecord_bb_cash_source) {
                                values['custrecord_bb_cash_source'] = context.request.parameters.custrecord_bb_cash_source;
                            }
                            if (context.request.parameters.custrecord_bb_error_margin) {
                                values['custrecord_bb_error_margin'] = context.request.parameters.custrecord_bb_error_margin;
                            }
                            if (context.request.parameters.custrecord_bb_pats_delivery_date) {
                                values['custrecord_bb_pats_delivery_date'] = new Date(context.request.parameters.custrecord_bb_pats_delivery_date);
                            }
                            // setting general fields required for the save
                            // values['custrecord_bb_pats_project'] = context.request.parameters.custrecord_bb_pats_project;
                            // values['custrecord_bb_pats_project_action'] = context.request.parameters.custrecord_bb_pats_project_action;
                            record.submitFields({
                                type: 'customrecord_bb_proj_act_transact_sched',
                                id: context.request.parameters.id,
                                values: values,
                                options: {
                                    ignoreMandatoryFields: true
                                }
                            });
                            log.debug('successful update to project action');
                            context.response.write(context.request.parameters.id);
                            return;
                        } else if (!context.request.parameters.id && context.request.parameters.custrecord_bb_pats_item && context.request.parameters.custrecord_bb_pats_amount_num && context.request.parameters.custrecord_bb_pats_transaction_type) {
                            var scheduleRecord = record.create({
                                type: 'customrecord_bb_proj_act_transact_sched',
                                isDynamic: true
                            });
                            scheduleRecord.setValue({
                                fieldId: 'custrecord_bb_pats_project',
                                value: context.request.parameters.custrecord_bb_pats_project
                            });
                            scheduleRecord.setValue({
                                fieldId: 'custrecord_bb_pats_project_action',
                                value: context.request.parameters.custrecord_bb_pats_project_action
                            });
                            if (context.request.parameters.custrecord_bb_pats_transaction_type) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_transaction_type',
                                    value: context.request.parameters.custrecord_bb_pats_transaction_type
                                });
                            }
                            if (context.request.parameters.custrecord_bb_pats_commit_srt_day_num) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_commit_srt_day_num',
                                    value: context.request.parameters.custrecord_bb_pats_commit_srt_day_num
                                });
                            }
                            if (context.request.parameters.custrecord_bb_pats_delivery_fm_start_ct) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_delivery_fm_start_ct',
                                    value: context.request.parameters.custrecord_bb_pats_delivery_fm_start_ct
                                });
                            }
                            if (context.request.parameters.custrecord_bb_pats_item) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_item',
                                    value: context.request.parameters.custrecord_bb_pats_item
                                });
                            }
                            if (context.request.parameters.custrecord_bb_pats_amount_num) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_amount_num',
                                    value: context.request.parameters.custrecord_bb_pats_amount_num
                                });
                            }
                            if (context.request.parameters.custrecord_bb_pats_entity) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_entity',
                                    value: context.request.parameters.custrecord_bb_pats_entity
                                });
                            }
                            if (context.request.parameters.custrecord_bb_pats_terms) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_pats_terms',
                                    value: context.request.parameters.custrecord_bb_pats_terms
                                });
                            }
                            if (context.request.parameters.custrecord_bb_obligation_level) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_obligation_level',
                                    value: context.request.parameters.custrecord_bb_obligation_level
                                });
                            }
                            if (context.request.parameters.custrecord_bb_cash_source) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_cash_source',
                                    value: context.request.parameters.custrecord_bb_cash_source
                                });
                            }
                            if (context.request.parameters.custrecord_bb_error_margin) {
                                scheduleRecord.setValue({
                                    fieldId: 'custrecord_bb_error_margin',
                                    value: context.request.parameters.custrecord_bb_error_margin
                                });
                            }

                            var saveId = scheduleRecord.save({
                                ignoreMandatoryFields: true
                            });
                            log.debug('successful creation of transaction schedule to project action');
                            context.response.write(String(saveId));
                            return;
                        }
                    } catch (e) {
                        log.debug('error update to project action', e);
                        context.response.write('failure');
                        return
                    }
                }
                if (context.request.parameters.action == 'transScheduledelete') {
                    record.delete({
                        type: 'customrecord_bb_proj_act_transact_sched',
                        id: context.request.parameters.id
                    });

                    context.response.write('deleted');
                    return;
                }

            } // end of post check
        } // end of function

        return {
            onRequest: onRequest
        };

    });