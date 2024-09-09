/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record', 'N/search', 'N/redirect'],

    function(record, search, redirect) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            log.debug('context.request.method', context.request.method);
            if (context.request.method == 'GET') {
                var projectActionId = context.request.parameters.id;
                if (projectActionId) {
                    var _record = record.load({
                        type: 'customrecord_bb_project_action',
                        id: projectActionId,
                        isDynamic: true
                    });
                    var _toCopyFieldsValues = ['name',
		            	'custrecord_bb_package', 
						'custrecord_bb_project_package_action', 
						'custrecord_bb_package_step_number', 
						'custrecord_bb_project', 
						'custrecord_bb_proj_doc_required_optional', 
						'custrecord_bb_project_doc_action_type',
						'custrecord_bb_projact_preced_pack_action',
                        'custrecord_bb_rejection_reason',
        			    'custrecord_ts_hold_disposition',
        			    'custrecordnonfunded_code_1',
        			    'custrecordnonfunded_code_2',
        			    'custrecordnonfunded_code_3',
        			    'custrecord_ts_rev_category'
                    ];
//BS-55 start
                    var precedingActionTemplate = _record.getValue({fieldId: 'custrecord_bb_projact_preced_pack_action'});
                    var precedingProjectActions = _record.getValue({fieldId: 'custrecord_bb_projact_preced_proj_action'});
//BS-55 end
                    var _newRecord = record.create({
                        type: 'customrecord_bb_project_action'
                    });

                    _toCopyFieldsValues.forEach(function (field) {
                        _newRecord.setValue({
                            fieldId: field,
                            value: _record.getValue({
                                fieldId: field
                            })
                        });
                    });

                    // get Package ID
                    // create a search to find out the minimum sequence action status id
                    // set value for 'custrecord_bb_document_status'
                    var packageId = _record.getValue({
                        fieldId: 'custrecord_bb_package'
                    });
                    var statusId = searchForMinActionStatusSequence(packageId);
                    _newRecord.setValue({
                        fieldId: 'custrecord_bb_document_status',
                        value: statusId
                    });
                    // Get Action Template to Check for Schedule Install
                    var templateID = _record.getText({
                        fieldId: 'custrecord_bb_project_package_action'
                    });
                    if (templateID == 'Schedule Installation') {
                       _newRecord.setValue({
                         fieldId: 'custrecord_msi_schdl_date',
                         value: null
                       });
                       _newRecord.setValue({
                         fieldId: 'custrecordric_days_scheduled',
                         value: null
                       });
                       _newRecord.setValue({
                         fieldId: 'custrecord_bb_proj_act_sch_end_date',
                         value: null
                       });
                       _newRecord.setValue({
                         fieldId: 'custrecord_bb_proj_act_scheduled_time',
                         value: null
                       });
                       _newRecord.setValue({
                         fieldId: 'custrecord_bb_proj_act_scheduled_end_tim',
                         value: null
                       });
                    }

//BS-55 start
                    _newRecord.setValue({fieldId: 'custrecord_bb_projact_preced_pack_action', value: precedingActionTemplate});
                    _newRecord.setValue({fieldId: 'custrecord_bb_projact_preced_proj_action', value: precedingProjectActions});
//BS-55 end
                    var _revisionNumber = parseInt(_record.getValue({
                        fieldId: 'custrecord_bb_revision_number'
                    }));
                    _revisionNumber = isNaN(_revisionNumber) ? 1 : _revisionNumber + 1;
                    _newRecord.setValue({
                        fieldId: 'custrecord_bb_revision_number',
                        value: _revisionNumber
                    });
                    var _newRecordId = _newRecord.save({
                        ignoreMandatoryFields: true
                    });

                    _record.setValue({
                        fieldId: 'custrecord_bb_new_rev_action',
                        value: _newRecordId
                    });
                    _record.setValue({
                        fieldId: 'isinactive',
                        value: false
                    });
                    _record.setValue({
                        fieldId: 'custrecord_bb_proj_actn_previous_rev_box',
                        value: true
                    });                    
                    _record.save({
                        ignoreMandatoryFields: true
                    });

                    // redirect to created record in edit
                    redirect.toRecord({
                        type : 'customrecord_bb_project_action',
                        id : _newRecordId
                    });
                    context.response.write('success');
                    return; // added to prevent any other code from executing.
                } else {
                    log.debug('project action parameter missing in request');
                    context.response.write('failure');
                }// end of project action id value
            }

        }

        function searchForMinActionStatusSequence(pacakgeId) {
            var statusId = '';
            var actionStatusSearch = search.create({
                type : 'customrecord_bb_document_status',  //Action Status record
                filters : [['custrecord_bb_doc_status_package', 'anyof', pacakgeId], "AND", ["isinactive", "is", "F"]],
                columns : [search.createColumn({
                    name : 'internalid'
                }), search.createColumn({
                    name : 'custrecord_bb_doc_status_seq',
                    sort : search.Sort.ASC
                })]
            }); // in this case it is mandatory to populate the sequence numbers for each action status
            var searchResult = actionStatusSearch.run().getRange({
                start: 0,
                end: 1
            });
            if(searchResult.length!= 0){
                var sequence = searchResult[0].getValue({
                    name : 'custrecord_bb_doc_status_seq',
                    sort : search.Sort.ASC
                });
                if (sequence != '' && sequence != null){
                    statusId = searchResult[0].getValue({
                        name : 'internalid'
                    });
                }
            }
            return statusId;
        }


        return {
            onRequest: onRequest
        };

    });