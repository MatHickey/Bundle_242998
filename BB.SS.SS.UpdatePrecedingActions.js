/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */
define(['N/search', 'N/record'],

    function(search, record) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext) {
            try {
                var config = record.load({
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: 1
                });
                var configStatus = config.getValue({fieldId: 'custrecord_bb_config_preceding_status_ty'});
                var updatePrecedingActionSearchId = config.getValue({fieldId: 'custrecord_bb_updt_preceding_action_srch'});
                if (configStatus && updatePrecedingActionSearchId) {
                    var actionSearch = search.load({
                        id: updatePrecedingActionSearchId
                    });
                    var actionPaged = actionSearch.runPaged();
                    actionPaged.pageRanges.forEach(function(pageRange) {

                        var page = actionPaged.fetch(pageRange);
                        page.data.forEach(function(result) {
                            try {
                                log.debug('results', result);
                                var internalId = result.getValue('internalid');
                                var package = result.getValue('custrecord_bb_package');
                                log.debug('internalId', internalId);
                                log.debug('package', package);
                                var docStatus = getDocumentStatusByPackage(package, configStatus);
                                log.debug('docstatus', docStatus)
                                if (internalId && package) {
                                    log.debug('record submitting ', internalId);
                                    // test logic for error
                                    // var rec = record.load({
                                    //     type: 'customrecord_bb_project_action',
                                    //     id: internalId,
                                    //     isDynamic: true
                                    // });
                                    // rec.setValue({fieldId: 'custrecord_bb_document_status', value: docStatus});
                                    // rec.setValue({fieldId: 'custrecord_bb_document_status_date', value: new Date()});
                                    // try {var save = rec.save(); } catch(e){log.debug('save err', e)};
                                    record.submitFields({
                                        type: 'customrecord_bb_project_action',
                                        id: internalId,
                                        values: {
                                            'custrecord_bb_document_status': docStatus,
                                            'custrecord_bb_document_status_date': new Date()
                                        },
                                        options: {
                                            ignoreMandatoryFields: true
                                        }
                                    });
                                    log.debug('record successfully updated ', internalId);
                                }
                            } catch (e) {
                                log.error('error updating the current project action to internal status', e);
                            }
                            return true;
                        });
                        return true;
                    });
                } else {
                    log.debug('exiting script, no value is set on the configuration record for search or status');
                }

            } catch (e) {
                log.error('', e);
            }
        }


        function getDocumentStatusByPackage(package, configStatus) {
            var docStatusId = null;
            if (package && configStatus) {
                var customrecord_bb_document_statusSearchObj = search.create({
                    type: "customrecord_bb_document_status",
                    filters:
                        [
                            ["custrecord_bb_doc_status_package", "anyof", package],
                            "AND",
                            ["custrecord_bb_doc_status_type", "anyof", configStatus],
                            "AND",
                            ["isinactive", "is", "F"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "Internal ID"}),
                            search.createColumn({
                                name: "custrecord_bb_doc_status_seq",
                                sort: search.Sort.ASC,
                                label: "Sequence"
                            }),
                            search.createColumn({name: "custrecord_bb_doc_status_package", label: "Action Group"}),
                            search.createColumn({name: "custrecord_bb_doc_status_type", label: "Status Type"})
                        ]
                });
                var resultSet = customrecord_bb_document_statusSearchObj.run().getRange({start: 0, end: 1});
                if (resultSet.length > 0) {
                    docStatusId = resultSet[0].getValue({name: 'internalid'});
                }
            }
            return docStatusId;
        }

        return {
            execute: execute
        };

    });