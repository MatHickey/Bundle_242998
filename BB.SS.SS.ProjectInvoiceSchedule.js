/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/format', './BB SS/SS Lib/BB_SS_MD_SolarConfig'], function(recordModule, searchModule, formatModule, configModule){

    var DEFAULT_DUE_DAY_COUNT = 7;
    var DEFAULT_PHASE_ID = 1;

    function execute(context){
        var _toProcess = [];
        var _invoiceTypes = {};
        var isOneWorldEnabled = configModule.getConfiguration('custrecord_bb_ss_has_subsidiaries')

        // build searches
        var _invoiceTypesSearch = searchModule.create({
            type: 'customrecord_bb_ss_invoice_type',
            filters: [['isinactive', searchModule.Operator.IS, 'F']],
            columns: ['custrecord_bb_ss_invoice_type_item']
        });

        //var _projectInvoiceScheduleSearch = searchModule.load({id: 'customsearch_c2_proj_invoice_schd_proc'});
        if (isOneWorldEnabled.value) {
            var _projectInvoiceScheduleSearch = searchModule.create({
                type: 'customrecord_bb_ss_proj_inv_schedule',
                filters: [
                  ['isinactive', searchModule.Operator.IS, 'F']
                  , 'AND'
                  , ['custrecord_bb_ss_proj_inv_sched_invoice', searchModule.Operator.ANYOF, '@NONE@']
                ],
                columns: [
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_proj'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_inv_type'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_location'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_amount'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_customer'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_memo'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_due_date'}),
                    searchModule.createColumn({name: 'subsidiary', join: 'custrecord_bb_ss_proj_inv_sched_proj'})
                ]
            });
        } else {
            var _projectInvoiceScheduleSearch = searchModule.create({
                type: 'customrecord_bb_ss_proj_inv_schedule',
                filters: [
                  ['isinactive', searchModule.Operator.IS, 'F']
                  , 'AND'
                  , ['custrecord_bb_ss_proj_inv_sched_invoice', searchModule.Operator.ANYOF, '@NONE@']
                ],
                columns: [
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_proj'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_inv_type'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_location'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_amount'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_customer'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_memo'}),
                    searchModule.createColumn({name:'custrecord_bb_ss_proj_inv_sched_due_date'}),
                ]
            });
        }

        var _config = configModule.getConfiguration('custrecord_bb_ss_gen_inv_due_day_count');
        var _dueDayCount = _config.value
            ? parseInt(_config.value)
            : DEFAULT_DUE_DAY_COUNT;

        _invoiceTypesSearch.run().each(function(row){
            var _item = row.getValue({name: 'custrecord_bb_ss_invoice_type_item'});
            if(_item){
                _invoiceTypes[row.id] = _item;
            }
            return true;
        });

        _projectInvoiceScheduleSearch.run().each(function(row){
            var _invoiceDate = formatModule.parse({value: row.getValue({name: 'custrecord_bb_ss_proj_inv_sched_due_date'}), type: formatModule.Type.DATE});
            var _now = new Date();
            var _processDate = new Date(_now.getFullYear(), _now.getMonth(), (_now.getDate() + _dueDayCount + 1));
            if(_invoiceDate < _processDate){
                _toProcess.push(row);
            }
            return true;
        });

        // process records
        if(_toProcess.length > 0) {
            //log.debug('To generate invoices', _toProcess.length);
            _toProcess.forEach(function(scheduled){
                //log.debug('Processing', scheduled);
                var _invoiceType = scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_inv_type'});
                if(!_invoiceType || (typeof _invoiceType === 'string' && _invoiceType.trim().length === 0)) return;
                var _itemInternalId = _invoiceTypes[_invoiceType];
                if(!_itemInternalId || (typeof _itemInternalId === 'string' && _itemInternalId.trim().length === 0)) return;
                var _location = scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_location'});
                if (isOneWorldEnabled.value) {
                    var _subsidiaryId = scheduled.getValue({name: 'subsidiary', join: 'custrecord_bb_ss_proj_inv_sched_proj'});
                }
                var _amount = scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_amount'});
                var _newInvoice = recordModule.create({
                    type: recordModule.Type.INVOICE
                });
                var _invoiceDate = formatModule.parse({value: scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_due_date'}), type: formatModule.Type.DATE});
                // var _invoicePeriodStartDate = null;
                // var _invoicePeriodEndDate = null;
                // try{
                //     _invoicePeriodStartDate = formatModule.parse({value: scheduled.getValue({name: 'custrecord_c2_inv_period_start_date'}), type: formatModule.Type.DATE});
                // } catch(ex) { }
                // try{
                //     _invoicePeriodEndDate = formatModule.parse({value: scheduled.getValue({name: 'custrecord_c2_inv_period_end_date'}), type: formatModule.Type.DATE});
                // } catch(ex) { }
                _newInvoice.setValue({fieldId: 'entity', value: scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_customer'}) });
                _newInvoice.setValue({fieldId: 'custbody_bb_project', value: scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_proj'}) });
                _newInvoice.setValue({fieldId: 'trandate', value: _invoiceDate });
                if (isOneWorldEnabled.value) {
                    _newInvoice.setValue({fieldId: 'subsidiary', value: _subsidiaryId });
                }
                _newInvoice.setValue({fieldId: 'location', value: _location });
                // _newInvoice.setValue({fieldId: 'custbody_bb_phase', value: DEFAULT_PHASE_ID });
                _newInvoice.setValue({fieldId: 'memo', value: scheduled.getValue({name: 'custrecord_bb_ss_proj_inv_sched_memo'}) });
                // _newInvoice.setValue({fieldId: 'custbody_bb_inv_period_start_date', value: _invoicePeriodStartDate });
                // _newInvoice.setValue({fieldId: 'custbody_bb_inv_period_end_date', value: _invoicePeriodEndDate });
                _newInvoice.insertLine({sublistId: 'item', line: 0});
                _newInvoice.setSublistValue({sublistId: 'item', line: 0, fieldId: 'item', value: _itemInternalId});
                _newInvoice.setSublistValue({sublistId: 'item', line: 0, fieldId: 'amount', value: _amount});
                _newInvoice.setSublistValue({sublistId: 'item', line: 0, fieldId: 'rate', value: _amount});
                _newInvoice.setSublistValue({sublistId: 'item', line: 0, fieldId: 'location', value: _location});
                //log.debug('Creating invoice', _newInvoice);
                var _newInvoiceId = _newInvoice.save({ignoreMandatoryFields: true});

                recordModule.submitFields({
                    type: 'customrecord_bb_ss_proj_inv_schedule',
                    id: scheduled.id,
                    values: {
                        'custrecord_bb_ss_proj_inv_sched_invoice': _newInvoiceId
                    }
                });
            });
        }

    }

    return {
        execute: execute
    }
});