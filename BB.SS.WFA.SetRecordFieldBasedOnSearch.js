/**
 *@NApiVersion 2.x
 *@NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (search, record, runtime) {

    function onAction(scriptContext) {
        // if (scriptContext.type == scriptContext.UserEventType.DELETE) {
        //     return;
        // }
        //   log.emergency('script context', scriptContext);
        var logtrigger = 830;
        log.emergency('script context', scriptContext.workflowId);
        var wfid = scriptContext.workflowId;
        var me = runtime.getCurrentScript();
        var searchcriteria = me.getParameter({ name: 'custscript_bbss_wfa_results_fld_map' });
        var joinrecfield = me.getParameter({ name: 'custscript_bb_wfa_record_join_text' });
        var joinrectype = me.getParameter({ name: 'custscript_bbss_wfa_rec_type' });
        var createdrecordfield = me.getParameter({ name: 'custscript_bb_created_record_field' });
        var createdrecordtype = me.getParameter({ name: 'custscript_bb_created_record_type' });
        var rec = scriptContext.newRecord;
        // if (createdrecordfield) {
        //     if (wfid == logtrigger) log.debug(wfid + wfid + 'join field', createdrecordfield );
        //     var getJoin = rec.getValue(createdrecordfield);
        //     scriptContext.newRecord.getValue('custrecord_bb_project');
        //     if (wfid == logtrigger) if (wfid == logtrigger) log.debug(wfid + wfid + wfid + 'get join', getJoin);
        // };
        if (wfid == logtrigger) if (wfid == logtrigger) log.debug(wfid + wfid + 'rec', rec);
        var rectype = rec.type;
        var recid = rec.id;
        var taskrecid = '';
        var recordtype = '';
        var actionSearchObj = search.load({
            id: searchcriteria
        });
        if (wfid == logtrigger) log.debug(wfid + 'search id', actionSearchObj);
        var filters = actionSearchObj.filterExpression;
        if (wfid == logtrigger) log.debug(wfid + 'filters', filters + ' rec id ' + recid);
        // this code block is just in case the UI already has a filtered field
        var hasVenFilter = false;
        log.emergency('join recs ' + joinrecfield, joinrectype);
        if (joinrecfield && joinrectype) {
            log.emergency('in loop for joins');
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == joinrecfield) {
                    filters[f] = [joinrecfield, "is", recid];
                    hasVenFilter = true;
                }
            }
            if (!hasVenFilter) filters.push("AND", [joinrecfield, "is", recid]);
            // log.audit('duplicate filters', filters);
            actionSearchObj.filterExpression = filters;
            var searchResultCount = actionSearchObj.runPaged().count;
            if (wfid == logtrigger) log.debug(wfid + "join rec result count", searchResultCount);
        } else {
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == 'internalid') {
                    filters[f] = ["internalid", "is", recid];
                    hasVenFilter = true;
                }
            }
            if (!hasVenFilter) filters.push("AND", ["internalid", "is", recid]);
            //  log.audit('duplicate filters', filters);
            actionSearchObj.filterExpression = filters;
            var searchResultCount = actionSearchObj.runPaged().count;
            if (wfid == logtrigger) log.debug(wfid + "same rec result count", searchResultCount);
        };
        var i = 0;
        var joining = false;
        actionSearchObj.run().each(function (result) {
            if (createdrecordtype) {
                joining = true;
                log.emergency('get join result ' + createdrecordtype, result);

                var getJoin;

                if (createdrecordtype == 'customrecord_bb_homeowners_association') {
                    log.emergency('in  hoa lookup');
                    var addr1 = result.getValue({
                        name: "custrecord_bb_pi_hoa_street_text",
                        join: "CUSTRECORD_BB_PI_PROJECT",
                        summary: "MAX"
                    });
                    var addrzip = result.getValue({
                        name: "custrecord_bb_pi_hoa_zip_text",
                        join: "CUSTRECORD_BB_PI_PROJECT",
                        summary: "MAX"
                    });
                    var hoaname = result.getValue({
                        name: "custrecord_bb_pi_hoa_name_text",
                        join: "CUSTRECORD_BB_PI_PROJECT",
                        summary: "MAX"
                    });

                    log.emergency('in  hoa lookup ' + addr1, addrzip + ' hoa name ' + hoaname);
                    //   try {
                    var hoaSearchObj = search.load({
                        id: 'customsearch_bb_wfa_hoalookup'
                    });
                    var hasAddrFilter = false;
                    var hasZipFilter = false;
                    var hashoanamefilter = false;
                    var filters = hoaSearchObj.filterExpression;
                    for (var f = 0; f < filters.length; f++) {
                        if (filters[f][0] == "custrecord_bb_hoa_address_line1") {
                            filters[f] = ["custrecord_bb_hoa_address_line1", "is", addr1];
                            hasAddrFilter = true;
                        }
                        ;
                        if (filters[f][0] == "custrecord_bb_hoa_address_zip") {
                            filters[f] = ["custrecord_bb_hoa_address_zip", "is", addrzip];
                            hasZipFilter = true;
                        }
                        ;
                        if (filters[f][0] == "name") {
                            filters[f] = ["name", "is", hoaname];
                            hashoanameFilter = true;
                        }
                    }
                    if (!hasAddrFilter) filters.push("AND", ["custrecord_bb_hoa_address_line1", "is", addr1]);
                    if (!hasZipFilter) filters.push("AND", ["custrecord_bb_hoa_address_zip", "is", addrzip]);
                    if (!hashoanamefilter) filters.push("AND", ["name", "is", hoaname]);
                    // log.audit('duplicate filters', filters);
                    hoaSearchObj.filterExpression = filters;
                    var searchResultCount = hoaSearchObj.runPaged().count;
                    log.emergency("hoa lookup result count", searchResultCount);
                    hoaSearchObj.run().each(function (result) {
                        log.emergency('hoa result', result);
                        getJoin = result.id;
                        // .run().each has a limit of 4,000 results
                        return true;
                    });
                    


                } else {
                    var getJoin = result.getValue({
                        name: joinrecfield,
                        summary: "MAX"
                    });
                };

                log.emergency('get join', getJoin);
                if (getJoin) {
                    log.emergency('in join loop ' + getJoin);
                    var taskrec = record.load({
                        type: createdrecordtype,
                        id: getJoin,
                        isDynamic: true
                    });

                } else {
                    var taskrec = record.create({
                        type: createdrecordtype,
                        isDynamic: true
                    });
                    log.emergency('creating rec type', createdrecordtype);
                }
            } else {
                var taskrec = record.load({
                    type: rectype,
                    id: recid,
                    isDynamic: true
                });
            }


            var lists = [];
            if (wfid == logtrigger) log.debug(wfid + 'result', result);
            var colnum = 0;
            var fieldschanged = {};
            result.columns.forEach(function (col) {

                //USING THE COLUMN TO MAP TO THE NEW FIELD ON THE TO RECORD
                // if (wfid == logtrigger) log.debug(wfid + 'result in column', result); // log each column
                if (wfid == logtrigger) log.audit('columns', col);
                var colname = col.name;
                var collabel = col.label;
                var coljoin = col.join;
                var coltype = col.type;
                var colsum = col.summary;
                var str = colname;
                var sublist = '';
                if (str.indexOf('formula') != -1) {
                    var getvalue = result.getValue(result.columns[colnum]);
                    //   searchresults.getValue(_searchset.columns[0]);
                    if (wfid == logtrigger) log.debug(wfid + 'FORMULA VALUE ' + collabel, getvalue);
                    if (collabel) {

                        //USING [] NOTATION TO CHECK FOR SUBLIST VALUES IN THE LABEL
                        var sublist = collabel.substring(
                            collabel.lastIndexOf("[") + 1,
                            collabel.lastIndexOf("]")
                        );

                        // if (wfid == logtrigger) log.debug(wfid + 'sublist name', sublist);
                        if (sublist) {
                            var remove = collabel.substring(
                                collabel.lastIndexOf("["),
                                collabel.lastIndexOf("]") + 2
                            );
                            collabel = collabel.replace(remove, '');
                            if (wfid == logtrigger) log.emergency('col name after remove sublist ' + sublist, collabel);
                        };
                        if (sublist && collabel && getvalue) lists.push({ sublist: sublist, field: collabel, value: getvalue });
                    };
                } else {
                    if (collabel) {
                        sublist = collabel.substring(
                            collabel.lastIndexOf("[") + 1,
                            collabel.lastIndexOf("]")
                        );
                        // if (wfid == logtrigger) log.debug(wfid + 'sublist name', sublist);
                        if (sublist) {
                            var remove = collabel.substring(
                                collabel.lastIndexOf("["),
                                collabel.lastIndexOf("]") + 2
                            );
                            collabel = collabel.replace(remove, '');
                            if (wfid == logtrigger) log.emergency('col name after remove sublist ' + sublist, collabel);
                        }
                        if (coljoin && !colsum) {
                            var getvalue = result.getValue({ name: colname, join: col.join });
                        } else if (colsum) {
                            if (coljoin) {
                                if (wfid == logtrigger) log.debug(wfid + 'yes join', colname + ' j ' + coljoin + ' s ' + colsum);
                                var getvalue = result.getValue({ name: colname, join: coljoin, summary: colsum });
                            } else {
                                if (wfid == logtrigger) log.debug(wfid + 'no join')
                                var getvalue = result.getValue({ name: colname, summary: colsum });
                            }
                            // } else if (colname == "formulatext") {
                            //     var getvalue = result.getValue({ name: colname, summary: colsum, label: collabel });
                            //     if (wfid == logtrigger) log.debug(wfid + 'formula test value', getvalue);
                        } else {
                            var getvalue = result.getValue(colname);
                        }
                        if (wfid == logtrigger) log.debug(wfid + 'sublist check ' + sublist, 'field ' + collabel + ' value ' + getvalue);
                        if (sublist && collabel && getvalue) lists.push({ sublist: sublist, field: collabel, value: getvalue });
                    };
                };
                if (coltype == "date") {
                    getvalue = new Date(getvalue);
                }
                //   log.audit('165 rec' + recid + ' state ' + state + ' label ' + collabel, getvalue + ' search ' + searchcriteria + ' unlinked ' + unlinked);
                if (wfid == logtrigger) log.debug(wfid + '199 sublist check', sublist);
                //      if (!sublist) {
                fieldschanged[collabel] = getvalue;
                try {
                    if (getvalue == 'true') getvalue = true;
                    if (getvalue == 'false') getvalue = false;
                    if (wfid == logtrigger) log.debug(wfid + '198 setting field ' + collabel, getvalue);
                    if (getvalue) {
                        taskrec.setValue({ fieldId: collabel, value: getvalue });
                    }
                } catch (e) {
                    var str = e.toString();
                    if (wfid == logtrigger) log.debug(wfid + 'setting error', e);

                    try {
                        if (str.indexOf("Invalid date value") != -1) {
                            if (getvalue) {
                                var newdate = taskrec.setValue({ fieldId: collabel, value: new Date(getvalue) });
                            }
                            if (wfid == logtrigger) log.debug(wfid + 'new date set', newdate);
                        } else {
                            if (getvalue) {
                                taskrec.setText({ fieldId: collabel, text: getvalue });
                            }
                            if (wfid == logtrigger) log.debug(wfid + 'set text set', collabel + ' text ' + getvalue);

                        };
                    } catch (e) {
                        if (wfid == logtrigger) log.debug(wfid + 'both sets failed', e);
                    }
                }
                colnum = colnum + 1
                // if (wfid == logtrigger) log.emergency('col count', colnum + ' col name ' + col.name);
                return true;
            });

            try {
                if (wfid == logtrigger) log.emergency('fields changed', fieldschanged);
                var save = taskrec.save();
                if (wfid == logtrigger) log.emergency('save', save);
                if (joining) {
                    if (wfid == logtrigger) log.emergency('setting hoa field to save ' + scriptContext.newRecord.id, save );
                    scriptContext.newRecord.setValue({ fieldId: joinrecfield, value: save });
                    // var prjsave = rec.save();
                    // if (wfid == logtrigger) log.emergency('prj save', prjsave);
                };
                // if (createdrecordfield && createdrecordtype){
                //     var otherId = record.submitFields({
                //         type: createdrecordtype,
                //         id: rec.id,
                //         values: {
                //             createdrecordfield: save
                //         }
                //     });
                // }
            } catch (e) {
                if (wfid == logtrigger) log.emergency('e', e);
            }
        });
    }

    return {
        onAction: onAction
    }
});

