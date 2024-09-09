/**
 *@NApiVersion 2.1
 *@NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (search, record, runtime) {

    function onAction(scriptContext) {
        // if (scriptContext.type == scriptContext.UserEventType.DELETE) {
        //     return;
        // }
        //  log.debug('script')
        try {
            var rec = scriptContext.newRecord;
            log.debug('rec', rec);
            var rectype = rec.type;
            var recid = rec.id;
            var projecttaskSearchObj = search.load({
                id: 'customsearch_bb_ss_wfa_actionassctotask'
            });
            var filters = projecttaskSearchObj.filterExpression;
            log.debug('filters', filters + ' rec id ' + recid);
            // this code block is just in case the UI already has a filtered vendor
            var hasVenFilter = false;
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == 'custrecord_bb_ss_project_task_list') {
                    filters[f] = ["custrecord_bb_ss_project_task_list", "anyof", recid];
                    hasVenFilter = true;
                }
            }
            if (!hasVenFilter) filters.push("AND", ["custrecord_bb_ss_project_task_list", "anyof", recid]);
            log.audit('duplicate filters', filters);
            projecttaskSearchObj.filterExpression = filters;
            var taskrecid = '';
            var recordtype = '';
            var searchResultCount = projecttaskSearchObj.runPaged().count;
            log.debug("project task search count", searchResultCount);
            projecttaskSearchObj.run().each(function (result) {
                taskrecid = result.id;
                recordtype = result.recordType;
                log.debug('task rec', taskrecid);
                // .run().each has a limit of 4,000 results
                return true;
            });
            log.debug('task rec id before load', taskrecid);
            if (taskrecid) {
                var taskrec = record.load({
                    type: "customrecord_bb_project_action",
                    id: taskrecid,
                    isDynamic: true
                });
            } else {
                var taskrec = record.create({
                    type: "customrecord_bb_project_action",
                    isDynamic: true
                })
            }

            log.debug('after create')

            var me = runtime.getCurrentScript();
            var searchcriteria = me.getParameter({ name: 'custscript_bb_ss_search_task_to_action' });
            if (!searchcriteria) {
                return;
            }
            var actionSearchObj = search.load({
                id: searchcriteria
            });
            var filters = actionSearchObj.filterExpression;
            log.debug('filters', filters + ' rec id ' + recid);
            // this code block is just in case the UI already has a filtered vendor
            var hasVenFilter = false;
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == 'internalid') {
                    filters[f] = ["internalid", "anyof", recid];
                    hasVenFilter = true;
                }
            }
            if (!hasVenFilter) filters.push("AND", ["internalid", "anyof", recid]);
            log.audit('duplicate filters', filters);
            actionSearchObj.filterExpression = filters;
            var searchResultCount = actionSearchObj.runPaged().count;
            log.debug("projecttaskSearchObj result count", searchResultCount);
            actionSearchObj.run().each(function (result) {
                //     log.debug('result', result);
                var colnum = 0
                result.columns.forEach(function (col) {
                    // log.debug('result in column', result); // log each column
                    //         log.audit('columns', col);
                    var colname = col.name;
                    var collabel = col.label;
                    var coljoin = col.join;
                    var coltype = col.type;
                    //      log.debug('col name in header', col["type"]);
                    var colsum = col.summary;
                    var str = colname;
                    if (str.indexOf('formula') != -1) {
                        var getvalue = result.getValue(result.columns[colnum]);
                        //   searchresults.getValue(_searchset.columns[0]);
                        log.debug('FORMULA VALUE', getvalue);
                    } else {
                        if (coljoin && !colsum) {
                            var getvalue = result.getValue({ name: colname, join: col.join });
                        } else if (colsum) {
                            if (coljoin) {
                                //   log.debug('yes join', colname + ' j ' + coljoin + ' s ' + colsum);
                                var getvalue = result.getValue({ name: colname, join: coljoin, summary: colsum });
                            } else {
                                //  log.debug('no join')
                                var getvalue = result.getValue({ name: colname, summary: colsum });
                            }
                        } else {
                            var getvalue = result.getValue(colname);
                        }
                    };
                    //  log.debug('coltype', col.type);
                    if (col.type == "date") {
                        log.debug('col type is date', coltype);
                        getvalue = new Date(getvalue);
                    }
                    log.audit(collabel, getvalue);


                    // if (!sublist) {
                    try {

                        taskrec.setValue({ fieldId: collabel, value: getvalue });
                    } catch (e) {
                        var str = e.toString();
                        log.debug('setting error', e);
                        log.debug('str err', str.indexOf("Invalid date value"));
                        try {
                            if (str.indexOf("Invalid date value") != -1) {
                                log.debug('setting to date');
                                taskrec.setValue({ fieldId: collabel, value: new Date(getvalue) });
                            } else {
                                taskrec.setText({ fieldId: collabel, text: getvalue });
                                log.debug('set text set', collabel);
                            };
                        } catch (e) {
                            log.debug('both sets failed', e);
                        }
                    }
                    //   taskrec.setValue({ fieldId: collabel, value: getvalue });
                    colnum = colnum + 1;
                });
                var save = taskrec.save();
                log.emergency('save', save);
                scriptContext.newRecord.setValue({ fieldId: 'custevent_bb_ss_project_action_list', value: save });
                // var otherId = record.submitFields({
                //     type: 'projectTask',
                //     id: recid,
                //     values: {
                //         'custevent_bb_ss_project_action_list': save
                //     }
                // });

                // .run().each has a limit of 4,000 results
                return true;
            });
        } catch (e) {
            log.debug('error updating action', e);
        }
    }

    return {
        onAction: onAction
    }
});
