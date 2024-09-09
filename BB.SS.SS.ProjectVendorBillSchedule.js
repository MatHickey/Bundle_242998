/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/format', './BB SS/SS Lib/BB.SS.MD.Vendor', './BB SS/SS Lib/BB_SS_MD_SolarConfig'],
  function(recordModule, searchModule, formatModule, vendorModule, configModule){

    var DEFAULT_DUE_DAY_COUNT = 7;
    var DEFAULT_PHASE_ID = 1;

    function execute(context){
        var _toProcess = [];
        var _vendorBillTypes = {};
        var isOneWorldEnabled = configModule.getConfiguration('custrecord_bb_ss_has_subsidiaries')
        // build searches
        var _vendorBillTypesSearch = searchModule.create({
            type: 'customrecord_bb_ss_vendor_bill_type',
            filters: [['isinactive', searchModule.Operator.IS, 'F']],
            columns: ['custrecord_bb_ss_vendor_bill_type_item']
        });
        var _projectVendorBillScheduleSearch;
        if (isOneWorldEnabled.value) {
            _projectVendorBillScheduleSearch = searchModule.create({
                type: 'customrecord_bb_ss_proj_vend_bill_sched',
                filters: [
                    ['isinactive', searchModule.Operator.IS, 'F']
                    , 'AND'
                    , ['custrecord_bb_ss_proj_vnd_bill_schd_bill', searchModule.Operator.ANYOF, '@NONE@']
                ],

                columns: [
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_type'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_loc'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_amt'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_vend'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_memo'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_due'}),
                    searchModule.createColumn({name: 'entityid', join: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'}),
                    searchModule.createColumn({name: 'entityid', join: 'custrecord_bb_ss_proj_vnd_bill_schd_vend'}),
                    searchModule.createColumn({name: 'subsidiary', join: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'})
                ]
            });
        } else {
            _projectVendorBillScheduleSearch = searchModule.create({
                type: 'customrecord_bb_ss_proj_vend_bill_sched',
                filters: [
                    ['isinactive', searchModule.Operator.IS, 'F']
                    , 'AND'
                    , ['custrecord_bb_ss_proj_vnd_bill_schd_bill', searchModule.Operator.ANYOF, '@NONE@']
                ],

                columns: [
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_type'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_loc'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_amt'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_vend'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_memo'}),
                    searchModule.createColumn({name: 'custrecord_bb_ss_proj_vnd_bill_schd_due'}),
                ]
            });
        }

        var _config = configModule.getConfiguration('custrecord_bb_ss_gen_bill_due_day_count')
        var _dueDayCount = _config.value
          ? parseInt(_config.value)
          : DEFAULT_DUE_DAY_COUNT;

        _vendorBillTypesSearch.run().each(function(row){
            var _item = row.getValue({name: 'custrecord_bb_ss_vendor_bill_type_item'});
            if(_item){
                _vendorBillTypes[row.id] = _item;
            }
            return true;
        });

        // _projectVendorBillScheduleSearch.run().each(function(row){
        //     var _dueDate = formatModule.parse({value: row.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_due'}), type: formatModule.Type.DATE});
        //     var _now = new Date();
        //     var _processDate = new Date(_now.getFullYear(), _now.getMonth(), (_now.getDate() + _dueDayCount + 1));
        //     if(_dueDate < _processDate){
        //         _toProcess.push(row);
        //     }
        //     return true;
        // });

        var page = _projectVendorBillScheduleSearch.runPaged();
        page.pageRanges.forEach(function(pageRange) {

            var pageResults = page.fetch(pageRange);
            pageResults.data.forEach(function(row) {
                var _dueDate = formatModule.parse({value: row.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_due'}), type: formatModule.Type.DATE});
                var _now = new Date();
                var _processDate = new Date(_now.getFullYear(), _now.getMonth(), (_now.getDate() + _dueDayCount + 1));
                if(_dueDate < _processDate){
                    _toProcess.push(row);
                }
            });
        });

        // process records
        if(_toProcess.length > 0) {
            log.debug('To generate vendor bills', _toProcess.length);
            _toProcess.forEach(function(scheduled){
                log.debug('Processing', scheduled);
                var _vendorBillType = scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_type'});
                if(!_vendorBillType || (typeof _vendorBillType === 'string' && _vendorBillType.trim().length === 0)) return;
                var _itemInternalId = _vendorBillTypes[_vendorBillType];
                if(!_itemInternalId || (typeof _itemInternalId === 'string' && _itemInternalId.trim().length === 0)) return;
                if (isOneWorldEnabled.value) {
                    var _subsidiaryId = scheduled.getValue({name: 'subsidiary', join: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'});
                }
                var _location = scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_loc'});
                var _amount = scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_amt'});
                var _projectId = scheduled.getValue({name: 'entityid', join: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'});
                var _vendorId = scheduled.getValue({name: 'entityid', join: 'custrecord_bb_ss_proj_vnd_bill_schd_vend'});
                var _vendorInternalId = scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_vend'});
                // var _locationSubsidiary = searchModule.lookupFields({
                //     type: 'location',
                //     id: _location,
                //     columns: ['subsidiary']
                // });
                // if(_locationSubsidiary && _locationSubsidiary.subsidiary && _locationSubsidiary.subsidiary.value){
                //     _locationSubsidiary = _locationSubsidiary.subsidiary.value;
                // }
                if (isOneWorldEnabled.value) {
                    var _vendorHasSubsidiary = vendorModule.hasVendorSubsidiary(_vendorInternalId, _subsidiaryId);
                    if(!_vendorHasSubsidiary){
                        vendorModule.addSubsidiaryToVendor(_vendorInternalId, _subsidiaryId);
                    }
                }

                var _vendorBill = recordModule.create({
                    type: recordModule.Type.VENDOR_BILL
                });
                var _billNo = [_vendorId, ' - ', _projectId, ' - ', scheduled.id].join('');
                var _vendorBillDueDate = formatModule.parse({value: scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_due'}), type: formatModule.Type.DATE});
                _vendorBill.setValue({fieldId: 'tranid', value: _billNo});
                _vendorBill.setValue({fieldId: 'entity', value:  _vendorInternalId});
                _vendorBill.setValue({fieldId: 'custbody_bb_project', value: scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_proj'}) });
                _vendorBill.setValue({fieldId: 'duedate', value: _vendorBillDueDate });
                if (isOneWorldEnabled.value) {
                    _vendorBill.setValue({fieldId: 'subsidiary', value: _subsidiaryId });
                }
                _vendorBill.setValue({fieldId: 'location', value: _location });
                // _vendorBill.setValue({fieldId: 'custbody_bb_phase', value: DEFAULT_PHASE_ID });
                _vendorBill.setValue({fieldId: 'memo', value: scheduled.getValue({name: 'custrecord_bb_ss_proj_vnd_bill_schd_memo'}) });
                _vendorBill.insertLine({sublistId: 'item', line: 0});
                _vendorBill.setSublistValue({sublistId: 'item', line: 0, fieldId: 'item', value: _itemInternalId});
                _vendorBill.setSublistValue({sublistId: 'item', line: 0, fieldId: 'amount', value: _amount});
                _vendorBill.setSublistValue({sublistId: 'item', line: 0, fieldId: 'rate', value: _amount});
                _vendorBill.setSublistValue({sublistId: 'item', line: 0, fieldId: 'location', value: _location});
                var _vendorBillId = _vendorBill.save({ignoreMandatoryFields: true});
                recordModule.submitFields({
                    type: 'customrecord_bb_ss_proj_vend_bill_sched',
                    id: scheduled.id,
                    values: {
                        'custrecord_bb_ss_proj_vnd_bill_schd_bill': _vendorBillId
                    }
                });
            });
        }

    }

    return {
        execute: execute
    }
});