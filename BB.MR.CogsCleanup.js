/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/record', 'N/search'],

    function(runtime, record, search) {

            /**
             * Marks the beginning of the Map/Reduce process and generates input data.
             *
             * @typedef {Object} ObjectRef
             * @property {number} id - Internal ID of the record instance
             * @property {string} type - Record type id
             *
             * @return {Array|Object|Search|RecordRef} inputSummary
             * @since 2015.1
             */
            function getInputData() {
                    var array = [];
                    var searchId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_cogs_cleanup_search'});
                    if (searchId) {
                            var cogsCleanUpSearch = search.load({
                                    id: searchId
                            });
                            cogsCleanUpSearch.run().each(function(result) {
                                    array.push({
                                            projectSegmentId: result.getValue(cogsCleanUpSearch.columns[0]),
                                            amount: result.getValue(cogsCleanUpSearch.columns[1]),
                                            journal1: result.getValue(cogsCleanUpSearch.columns[2]),
                                            journal2: result.getValue(cogsCleanUpSearch.columns[3]),
                                    });
                            });
                    }
                    log.debug('array values in input stage', array);
                    return array;
            }

            /**
             * Executes when the map entry point is triggered and applies to each key/value pair.
             *
             * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
             * @since 2015.1
             */
            function map(context) {
                    var obj = JSON.parse(context.value);
                    log.debug('Map Stage object', obj);
                    var projectSegmentId = obj.projectSegmentId;
                    if (obj.journal1 || obj.journal2) {
                            var account = runtime.getCurrentScript().getParameter({name: 'custscript_bb_cogs_account'});
                            log.debug('account', account);
                            var writeOffAccount = runtime.getCurrentScript().getParameter({name: 'custscript_bb_writeoffcogs_account'});
                            log.debug('writeOffAccount', writeOffAccount);
                            var amount = obj.amount;
                            log.debug('amount', amount);
                            var projectObj = getProjectByProjectSegmentId(projectSegmentId);
                            log.debug('projectObj', projectObj);
                            var jeId = createJournalEntry(projectObj, projectSegmentId, account, writeOffAccount, amount);
                            log.debug('clean up journal successfully created', jeId);
                    }

            }

            /**
             * Executes when the reduce entry point is triggered and applies to each group.
             *
             * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
             * @since 2015.1
             */
            function reduce(context) {

            }



            /**
             * Executes when the summarize entry point is triggered and applies to the result set.
             *
             * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
             * @since 2015.1
             */
            function summarize(summary) {

            }

            function getProjectByProjectSegmentId(projectSegmentId) {
                log.debug('entered get proj by proj seg id function');
                log.debug('proj seg id', projectSegmentId);
                    var obj = {
                            projectId: null,
                            subsidiary: null
                    };
                    if (projectSegmentId) {
                            var customrecord_cseg_bb_projectSearchObj = search.create({
                                    type: "customrecord_cseg_bb_project",
                                    filters:
                                        [
                                                ["internalid","anyof",projectSegmentId],
                                                "AND",
                                                ["isinactive","is","F"]
                                        ],
                                    columns:
                                        [
                                                search.createColumn({name: "internalid", label: "Internal ID"}),
                                                search.createColumn({
                                                        name: "name",
                                                        sort: search.Sort.ASC,
                                                        label: "Name"
                                                }),
                                                search.createColumn({name: "custrecord_seg_project", label: "Project"}),
                                                search.createColumn({name: "cseg_bb_project_filterby_subsidiary", label: "filter by Subsidiary"})
                                        ]
                            });
                            var searchResultCount = customrecord_cseg_bb_projectSearchObj.runPaged().count;
                            log.debug("customrecord_cseg_bb_projectSearchObj result count",searchResultCount);
                            var results = customrecord_cseg_bb_projectSearchObj.run().getRange({start: 0, end: 1});
                            if (results.length > 0) {
                                    obj.projectId = results[0].getValue({name: 'custrecord_seg_project'});
                                    obj.subsidiary = results[0].getValue({name: 'cseg_bb_project_filterby_subsidiary'});
                            }
                    }
                    return obj;
            }


            function createJournalEntry(projectObj, projectSegmentId, account, writeOffAccount, amount) {
                log.debug('entered create journal function');
                log.debug('project', projectObj);
                log.debug('segment', projectSegmentId);
                log.debug('account', account);
                log.debug('write off account',writeOffAccount);
                log.debug('amount', amount);
                    if (projectObj.projectId && projectObj.subsidiary && projectSegmentId && account && writeOffAccount && amount) {
                            var journal = record.create({
                                    type: record.Type.JOURNAL_ENTRY,
                                    isDynamic: true
                            });
                            journal.setValue({fieldId: 'subsidiary', value: projectObj.subsidiary});
                            journal.setValue({fieldId: 'trandate', value: new Date()});
                            journal.setValue({fieldId: 'custbody_bb_project', value: projectObj.projectId});
                            if (amount < 0) {
                                    addJournalLine(journal, projectObj, projectSegmentId, account, amount, true);
                                    addJournalLine(journal, projectObj, projectSegmentId, writeOffAccount, amount, false);
                            } else {
                                    addJournalLine(journal, projectObj, projectSegmentId, account, amount, false);
                                    addJournalLine(journal, projectObj, projectSegmentId, writeOffAccount, amount, true);
                            }
                            return journal.save({ignoreMandatoryFields: true});
                    }
            }

            function addJournalLine(journal, projectObj, projectSegmentId, account, amount, isDebit) {
                    journal.selectNewLine({
                            sublistId: 'line'
                    });
                    journal.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'account',
                            value: account
                    });
                    if (isDebit) {
                            journal.setCurrentSublistValue({
                                    sublistId: 'line',
                                    fieldId: 'debit',
                                    value: Math.abs(amount)
                            });
                    } else {
                            journal.setCurrentSublistValue({
                                    sublistId: 'line',
                                    fieldId: 'credit',
                                    value: Math.abs(amount)
                            });
                    }
                    // journal.setCurrentSublistValue({
                    //     sublistId: 'line',
                    //     fieldId: 'entity',
                    //     value: projectObj.projectId
                    // })
                    journal.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'cseg_bb_project',
                            value: projectSegmentId
                    });
                    journal.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'memo',
                            value: 'COGS Clean Up'
                    });
                    journal.commitLine({sublistId: 'line'});

            }


            return {
                    getInputData: getInputData,
                    map: map,
                    reduce: reduce,
                    summarize: summarize
            };

    });

