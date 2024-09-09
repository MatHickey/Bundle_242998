/**
 *@NApiVersion 2.x
 *@NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (search, record, runtime) {

    function onAction(scriptContext) {
        log.emergency('script context', scriptContext);
        var me = runtime.getCurrentScript();
        var searchcriteria = me.getParameter({ name: 'custscript_bb_ss_search_action_to_task' });
        var unlinked = me.getParameter({ name: 'custscript_bbss_is_unlinked_task' });
        var rec = scriptContext.newRecord;
        var project = rec.getValue('custrecord_bb_project');
        var recid = rec.id;
        var taskrecid = '';
        var dupfortitlecheck = false;
        var taskrec = getProjectTask(recid, unlinked, taskrecid);
        var actionSearchObj = updateActionSearch(searchcriteria, recid);
        processProjectActions(actionSearchObj, dupfortitlecheck, taskrec, unlinked, recid, project);
    }
    
    function updateActionSearch(searchcriteria, recid){
    	var actionSearchObj = search.load({
            id: searchcriteria
        });
        var filters = actionSearchObj.filterExpression;
        var hasVenFilter = false;
        for (var f = 0; f < filters.length; f++) {
            if (filters[f][0] == 'internalid') {
                filters[f] = ['internalid', 'is', recid];
                hasVenFilter = true;
            }
        }
        if (!hasVenFilter) filters.push('AND', ['internalid', 'is', recid]);
        log.audit('duplicate filters', filters);
        actionSearchObj.filterExpression = filters;
        var searchResultCount = actionSearchObj.runPaged().count;
        return actionSearchObj;
    }
    
    function processProjectActions(actionSearchObj, dupfortitlecheck, taskrec, unlinked, recid, project){
    	actionSearchObj.run().each(function (result) {
            var lists = [];
            var colnum = 0;
            result.columns.forEach(function (col) {
                log.audit('columns', col);
                var collabel = col.label;
                var coltype = col.type;
                var str = col.name;
                var sublist = '';
                var getvalue = '';
                if (str.indexOf('formula') != -1) {
                	getvalue = getFormulaColumnValues(getvalue, result, colnum, collabel, lists);
                } else {
                	getvalue = getNonFormulaColumnValues(collabel, sublist, result, col, lists);
                };
                if (coltype == 'date') {
                    getvalue = new Date(getvalue);
                }
                dupfortitlecheck = false
                if (collabel == 'title' && unlinked) {
                    dupfortitlecheck = checkDupForTitleColumnAndUnlinked(recid, getvalue, project);
                };
                if (dupfortitlecheck){
                	return true; 
                };
                if (!sublist) {
                    try {
                        taskrec.setValue({ fieldId: collabel, value: getvalue });
                    } catch (e) {
                        var str = e.toString();

                        try {
                            if (str.indexOf('Invalid date value') != -1) {
                                var newdate = taskrec.setValue({ fieldId: collabel, value: new Date(getvalue) });
                            } else {
                                taskrec.setText({ fieldId: collabel, text: getvalue });
                            };
                        } catch (e) {
                            log.error('both sets failed', e);
                        }
                    }
                }
                colnum = colnum + 1;
            });
            saveTaskRec(lists, taskrec, dupfortitlecheck);
            return true;
        });
    }
    
    function checkDupForTitleColumnAndUnlinked(recid, getvalue, project){
    	var projecttaskSearchObj = search.load({
            id: 'customsearch_bb_ss_wfa_project_tasksassc'
        });
        var filters = projecttaskSearchObj.filterExpression;
        var hasVenFilter = false;
        var hasProjFilter = false;
        for (var f = 0; f < filters.length; f++) {
            if (filters[f][0] == 'title') {
                filters[f] = ['title', 'is', getvalue];
                hasVenFilter = true;
            }
            if (filters[f][0] == 'project') {
                filters[f] = ['project', 'is', project ];
                hasProjFilter = true;
            }
        }
        if (!hasVenFilter)
            filters.push('AND', ['title', 'is', getvalue]);
        if (!hasProjFilter)
            filters.push('AND', ['project', 'is', project]);
        log.audit('duplicate filters', filters);
        projecttaskSearchObj.filterExpression = filters;

        var searchResultCount = projecttaskSearchObj.runPaged().count;
        if (searchResultCount > 0) {
            return true;           
        };
        return false;
    }
    
    function getNonFormulaColumnValues(collabel, sublist, result, col, lists){
    	var colname = col.name;
    	var coljoin = col.join;
    	var colsum = col.summary;
    	if (collabel) {
            sublist = collabel.substring(
                collabel.lastIndexOf('[') + 1,
                collabel.lastIndexOf(']')
            );
            if (sublist) {
                var remove = collabel.substring(
                    collabel.lastIndexOf('['),
                    collabel.lastIndexOf(']') + 2
                );
                collabel = collabel.replace(remove, '');
                log.emergency('col name after remove sublist ' + sublist, collabel);
            }
            if (coljoin && !colsum) {
                getvalue = result.getValue({ name: colname, join: col.join });
            } else if (colsum) {
                if (coljoin) {
                    getvalue = result.getValue({ name: colname, join: coljoin, summary: colsum });
                } else {
                    getvalue = result.getValue({ name: colname, summary: colsum });
                }
            } else {
                getvalue = result.getValue(colname);
            }
            if (sublist && collabel && getvalue) lists.push({ sublist: sublist, field: collabel, value: getvalue });
        };
        return getvalue;
    }
    
    function getFormulaColumnValues(getvalue, result, colnum, collabel, lists){
    	getvalue = result.getValue(result.columns[colnum]);
        if (collabel) {

            var sublist = collabel.substring(
                collabel.lastIndexOf('[') + 1,
                collabel.lastIndexOf(']')
            );

            if (sublist) {
                var remove = collabel.substring(
                    collabel.lastIndexOf('['),
                    collabel.lastIndexOf(']') + 2
                );
                collabel = collabel.replace(remove, '');
                log.emergency('col name after remove sublist ' + sublist, collabel);
            };
            if (sublist && collabel && getvalue) lists.push({ sublist: sublist, field: collabel, value: getvalue });
        };
        return getvalue;
    }
        
    function getProjectTask(recid, unlinked, taskrecid){
        var taskrec = null;
        if (recid && !unlinked) {
            var projecttaskSearchObj = search.load({
                id: 'customsearch_bb_ss_wfa_project_tasksassc'
            });
            var filters = projecttaskSearchObj.filterExpression;
            var hasVenFilter = false;
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == 'custevent_bb_ss_project_action_list') {
                    filters[f] = ['custevent_bb_ss_project_action_list', 'anyof', recid];
                    hasVenFilter = true;
                }
            }
            if (!hasVenFilter)
                filters.push('AND', ['custevent_bb_ss_project_action_list', 'anyof', recid]);
            log.audit('duplicate filters', filters);
            projecttaskSearchObj.filterExpression = filters;

            var searchResultCount = projecttaskSearchObj.runPaged().count;
            projecttaskSearchObj.run().each(function (result) {
                taskrecid = result.id;
                return true;
            });
        }
        if (taskrecid) {
            taskrec = record.load({
                type: 'projectTask',
                id: taskrecid,
                isDynamic: true
            });
        } else {
            taskrec = record.create({
                type: 'projectTask',
                isDynamic: true
            })
        }
        return taskrec;
    }
    
    function saveTaskRec(lists, taskrec,dupfortitlecheck){
        if (lists.length != 0) {
            var lineNum = taskrec.selectLine({
                sublistId: lists[0].sublist,
                line: 0
            });
            for (var j = 0; j < lists.length; j++) {
                if (lists[j].value && lists[j].field) {
                    taskrec.setCurrentSublistValue({
                        sublistId: lists[j].sublist,
                        fieldId: lists[j].field,
                        value: lists[j].value
                    });
                };
            }

            try {
                var commit = taskrec.commitLine({
                    sublistId: lists[0].sublist
                });
            } catch (e) {
                log.error('error', e);
            }
        };

        var plannedwork = taskrec.getValue({ fieldId: 'plannedwork' });
        if (!plannedwork) { taskrec.setValue({ fieldId: 'plannedwork', value: 0 }) };
        if (!dupfortitlecheck) {
            try{
            var save = taskrec.save();
            log.emergency('save', save);
            scriptContext.newRecord.setValue({ fieldId: 'custrecord_bb_ss_project_task_list', value: save });
            } catch (e){
                log.error('save error',e);
            }
        }
    }

    return {
        onAction: onAction
    }
});
