/**
 *@NApiVersion 2.1
 *@NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (search, record, runtime) {

    function onAction(scriptContext) {
        // if (scriptContext.type == scriptContext.UserEventType.DELETE) {
        //     return;
        // }
        try {
            log.emergency('script context', scriptContext);
            var type = scriptContext.newRecord.type;
            log.emergency('rec type', type);
            var me = runtime.getCurrentScript();
            //  var searchcriteria = me.getParameter({ name: 'custscript_bb_ss_search_action_to_task' });
            //  var unlinked = me.getParameter({ name: 'custscript_bbss_is_unlinked_task' });
            var rec = scriptContext.newRecord;
            if (type == 'customrecord_proj_action_transaction_sch') {
                var action = rec.getValue('custrecord_bb_pats_project_action');
                var project = rec.getValue('custrecord_bb_pats_project');
                var amount = rec.getValue('custrecord_bb_pats_amount_num');
                var item = rec.getValue('custrecord_bb_pats_item');
            }
            if (type == 'customrecord_bb_project_action') {
                var action = rec.id;
                var project = rec.getValue('custrecord_bb_project');
                var amount = rec.getValue('custrecord_bb_proj_act_amount');
                var item = rec.getValue('custrecord_bb_proj_action_item');
            }
            //Search for items on PATS for project action
            var itemsearch = search.load({
                id: 'customsearch_bb_ss_project_action_items'
            })
            var filters = itemsearch.filterExpression;
            // log.debug('filters', filters + ' rec id ' + recid);
            // this code block is just in case the UI already has a filtered field
            var hasProj = false;
            var hasItem = false;
            for (var f = 0; f < filters.length; f++) {
                if (filters[f][0] == 'custrecord_bb_pats_project') {
                    filters[f] = ["custrecord_bb_pats_project", "is", project];
                    hasProj = true

                }
                if (filters[f][0] == 'custrecord_bb_pats_project_action') {
                    filters[f] = ["custrecord_bb_pats_project_action", "is", action];
                    hasItem = true;

                }
            }
            if (!hasProj) filters.push("AND", ["custrecord_bb_pats_project", "is", project]);
            if (!hasItem) filters.push("AND", ["custrecord_bb_pats_project_action", "is", action]);
            itemsearch.filterExpression = filters;
            // log.debug('filters', filters);
            var searchResultCount = itemsearch.runPaged().count;
            log.debug("57 items result count", searchResultCount);
            itemsearch.run().each(function (result) {

                var item = result.getValue({
                    name: "custrecord_bb_pats_item",
                    summary: "GROUP"
                });
                log.debug('item', item);
                var seqlines = search.load({
                    id: 'customsearch_bb_ss_project_expense_seq'
                })
                var filters = seqlines.filterExpression;
                //log.debug('filters', filters + ' rec id ' + recid);
                // this code block is just in case the UI already has a filtered field
                var hasProj = false;
                var hasItem = false;
                for (var f = 0; f < filters.length; f++) {
                    if (filters[f][0] == 'custrecord_bb_exp_budg_line_seq_proj') {
                        filters[f] = ["custrecord_bb_exp_budg_line_seq_proj", "is", project];
                        hasProj = true

                    }
                    if (filters[f][0] == 'custrecord_bb_exp_budg_line_seq_item') {
                        filters[f] = ["custrecord_bb_exp_budg_line_seq_item", "is", item];
                        hasItem = true;

                    }
                }
                if (!hasProj) filters.push("AND", ["custrecord_bb_exp_budg_line_seq_proj", "is", project]);
                if (!hasItem) filters.push("AND", ["custrecord_bb_exp_budg_line_seq_item", "is", item]);
                seqlines.filterExpression = filters;
                // log.debug('filters', filters);
                var searchResultCount = seqlines.runPaged().count;
                log.debug("seq lines count to delete", searchResultCount);
                seqlines.run().each(function (result) {
                    log.debug('result', result);
                    var deleterec = record.delete({
                        type: result.recordType,
                        id: result.id,
                    });
                    log.debug('delete rec', deleterec);
                    return true;
                });

                //Search for Project Expense Budget Lines to delete
                var expenselines = search.load({
                    id: 'customsearch_bb_ss_project_expense_line'
                })
                var filters = expenselines.filterExpression;
                log.debug('filters', filters + ' rec id ' + recid);
                // this code block is just in case the UI already has a filtered field
                var hasProj = false;
                var hasItem = false;
                for (var f = 0; f < filters.length; f++) {
                    if (filters[f][0] == 'custrecord_bb_exp_budg_line_seq_proj') {
                        filters[f] = ["custrecord_bb_exp_budg_line_seq_proj", "is", project];
                        hasProj = true

                    }
                    if (filters[f][0] == 'custrecord_bb_proj_exp_budget_item') {
                        filters[f] = ["custrecord_bb_proj_exp_budget_item", "is", item];
                        hasItem = true;

                    }
                }
                if (!hasProj) filters.push("AND", ["custrecord_bb_proj_exp_budg_line_proj", "is", project]);
                if (!hasItem) filters.push("AND", ["custrecord_bb_proj_exp_budget_item", "is", item]);
                expenselines.filterExpression = filters;
                log.debug('filters', filters);
                var searchResultCount = expenselines.runPaged().count;
                log.debug("budget lines to delete count", searchResultCount);
                expenselines.run().each(function (result) {
                    log.debug('result', result);
                    var deleterec = record.delete({
                        type: result.recordType,
                        id: result.id,
                    });
                    log.debug('delete rec', deleterec);
                    return true;
                });

                //Search for open budget rec
                var budgetid = '';
                var sequencetype = '';
                var openbudgets = search.load({
                    id: 'customsearch_bb_ss_proj_expense_budget'
                });
                var filters = openbudgets.filterExpression;
                // log.debug('filters', filters);
                // this code block is just in case the UI already has a filtered field
                var hasFilter = false;
                for (var f = 0; f < filters.length; f++) {
                    if (filters[f][0] == 'custrecord_bb_proj_exp_budget_project') {
                        filters[f] = ["custrecord_bb_proj_exp_budget_project", "is", project];
                        hasFilter = true;
                    }
                }
                if (!hasFilter) filters.push("AND", ["custrecord_bb_proj_exp_budget_project", "is", project]);
                //log.audit('duplicate filters', filters);
                openbudgets.filterExpression = filters;
                var searchResultCount = openbudgets.runPaged().count;
                log.debug('open budget count', searchResultCount);
                if (searchResultCount == 0) {
                    var budgetrec = record.create({
                        type: 'customrecord_bb_proj_exp_budget',
                        isDynamic: true
                    })
                    budgetrec.setValue({fieldId: 'custrecord_bb_proj_exp_budget_project', value: project});
                    budgetrec.setValue({fieldId: 'custrecord_bb_proj_exp_budget_seq', value: 2});
                    budgetrec.setValue({fieldId: 'custrecord_bb_proj_exp_budget_version', value: 'Current'});
                    var budgetid = budgetrec.save();
                 //   var sequence = result.getValue('custrecord_bb_proj_exp_budget_seq_count');
                    var budgetline = record.create({
                        type: 'customrecord_bb_proj_exp_budg_line',
                        isDynamic: true
                    });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget', value: budgetid });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_proj', value: project });
                    //budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_amount', value: amount });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_item', value: item });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_amount', newamount })
                    var budgetline = budgetline.save();
                    log.debug('budget line created', budgetline);

                    //TODO Fill in budget expense when built
                    // var sequence = 6;

                    //Look up for sequence amount calcuations
                    var lines = [];
                    var patlines = search.load({
                        id: 'customsearch_bb_ss_pat_budget_info'
                    })
                    var filters = patlines.filterExpression;
                    log.debug('filters', filters + ' rec id ' + recid);
                    // this code block is just in case the UI already has a filtered field
                    var hasProj = false;
                    var hasItem = false;
                    for (var f = 0; f < filters.length; f++) {
                        if (filters[f][0] == 'custrecord_bb_pats_project') {
                            filters[f] = ["custrecord_bb_pats_project", "is", project];
                            hasProj = true

                        }
                        if (filters[f][0] == 'custrecord_bb_pats_item') {
                            filters[f] = ["custrecord_bb_pats_item", "is", item];
                            hasItem = true;

                        }
                    }
                    if (!hasProj) filters.push("AND", ["custrecord_bb_pats_project", "is", project]);
                    if (!hasItem) filters.push("AND", ["custrecord_bb_pats_item", "is", item]);
                    patlines.filterExpression = filters;
                    //log.debug('filters', filters);
                    var searchResultCount = patlines.runPaged().count;
                    log.debug("pat lines result count", searchResultCount);
                    patlines.run().each(function (result) {
                        log.emergency('result', result);
                        var startdate = result.getValue({
                            name: "startdate",
                            join: "CUSTRECORD_BB_PATS_PROJECT"
                        });
                        var paymentdate = result.getValue({
                            name: "custrecord_bb_pats_expected_payment_date"
                        });
                        if (!paymentdate) return true;
                        var d = new Date(paymentdate);
                        log.debug('payment date', d);
                        //  var year = d.getFullYear()
                        var weeknum = getWeekNumber(d);

                        log.debug('sequence pay date', weeknum);
                        log.debug('start date ' + startdate, 'end date ' + paymentdate);
                        var amount = result.getValue({
                            name: 'custrecord_bb_pats_amount_num'
                        });
                        var amountleft = amount;
                        var time = new Date(paymentdate) - new Date(startdate);
                        log.debug('time', time);
                        var days = time / (1000 * 3600 * 24);
                        log.debug('days', days);
                        var week = Math.ceil(days / 7);
                        var findline = lines.find(lines => lines.sequence === week);
                        log.debug('200 find', findline);
                        if (findline) {
                            var newamount = findline.amount;
                            findline.amount = parseFloat(newamount) + parseFloat(amount);
                        } else {
                            lines.push({ sequence: week, amount: amount, week: weeknum })
                        };
                        return true;
                    });



                    log.debug('lines full', lines);
                    var newamount = 0;
                    for (var i = 0; i < lines.length; i++) {
                        var budgetseq = record.create({
                            type: 'customrecord_bb_proj_exp_budg_line_seq',
                            isDynamic: true
                        });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_exp_budg_line_seq_proj', value: project });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_seq', value: lines[i].sequence });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_seq_amt', value: parseFloat(lines[i].amount) });
                        newamount = newamount + parseFloat(lines[i].amount)
                        budgetseq.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line', value: budgetline });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_exp_budg_line_seq_item', value: item });
                        var weekstr = lines[i].week[1];
                        weekstr = weekstr.toString();
                        if (weekstr.length == 1) {
                            log.debug('early week', weekstr);
                            weekstr = '0' + weekstr
                        }
                        var week = lines[i].week[0] + '-' + weekstr;
                        log.debug('234 week', week);
                        budgetseq.setText({ fieldId: 'cseg_bb_paid_wk_num', text: week });
                        var saveseq = budgetseq.save();
                        log.debug('save seq', saveseq);
                    }
                    record.submitFields({
                        type: 'customrecord_bb_proj_exp_budg_line',
                        id: budgetline,
                        values: { custrecord_bb_proj_exp_budget_amount: newamount }

                    })
                }
                openbudgets.run().each(function (result) {
                    log.audit('open budget', result);
                    budgetid = result.id;
                    sequencetype = result.getValue('custrecord_bb_proj_exp_budget_seq');
                    var sequence = result.getValue('custrecord_bb_proj_exp_budget_seq_count');
                    var budgetline = record.create({
                        type: 'customrecord_bb_proj_exp_budg_line',
                        isDynamic: true
                    });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget', value: budgetid });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_proj', value: project });
                    //budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_amount', value: amount });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_item', value: item });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_amount', newamount })
                    var budgetline = budgetline.save();
                    log.debug('budget line created', budgetline);

                    //TODO Fill in budget expense when built
                    // var sequence = 6;

                    //Look up for sequence amount calcuations
                    var lines = [];
                    var patlines = search.load({
                        id: 'customsearch_bb_ss_pat_budget_info'
                    })
                    var filters = patlines.filterExpression;
                    log.debug('filters', filters + ' rec id ' + recid);
                    // this code block is just in case the UI already has a filtered field
                    var hasProj = false;
                    var hasItem = false;
                    for (var f = 0; f < filters.length; f++) {
                        if (filters[f][0] == 'custrecord_bb_pats_project') {
                            filters[f] = ["custrecord_bb_pats_project", "is", project];
                            hasProj = true

                        }
                        if (filters[f][0] == 'custrecord_bb_pats_item') {
                            filters[f] = ["custrecord_bb_pats_item", "is", item];
                            hasItem = true;

                        }
                    }
                    if (!hasProj) filters.push("AND", ["custrecord_bb_pats_project", "is", project]);
                    if (!hasItem) filters.push("AND", ["custrecord_bb_pats_item", "is", item]);
                    patlines.filterExpression = filters;
                    //log.debug('filters', filters);
                    var searchResultCount = patlines.runPaged().count;
                    log.debug("pat lines result count", searchResultCount);
                    patlines.run().each(function (result) {
                        log.emergency('result', result);
                        var startdate = result.getValue({
                            name: "startdate",
                            join: "CUSTRECORD_BB_PATS_PROJECT"
                        });
                        var paymentdate = result.getValue({
                            name: "custrecord_bb_pats_expected_payment_date"
                        });
                        if (!paymentdate) return true;
                        var d = new Date(paymentdate);
                        log.debug('payment date', d);
                        //  var year = d.getFullYear()
                        var weeknum = getWeekNumber(d);

                        log.debug('sequence pay date', weeknum);
                        log.debug('start date ' + startdate, 'end date ' + paymentdate);
                        var amount = result.getValue({
                            name: 'custrecord_bb_pats_amount_num'
                        });
                        var amountleft = amount;
                        var time = new Date(paymentdate) - new Date(startdate);
                        log.debug('time', time);
                        var days = time / (1000 * 3600 * 24);
                        log.debug('days', days);
                        if (sequencetype == 1){
                            var week = Math.ceil(days / 30);
                        } else {
                            var week = Math.ceil(days / 7);
                        }
                       
                        var findline = lines.find(lines => lines.sequence === week);
                        log.debug('200 find', findline);
                        if (findline) {
                            var newamount = findline.amount;
                            findline.amount = parseFloat(newamount) + parseFloat(amount);
                        } else {
                            lines.push({ sequence: week, amount: amount, week: weeknum })
                        };
                        // var amountperweek = amount / weeks;
                        // log.debug('amount per week', amountperweek);
                        // for (var i = 0; i < weeks; i++) {
                        //     log.debug(i, lines);
                        //     var lineamount = lines[i] || 0;
                        //     if (amountleft - amountperweek >= 0) {

                        //         log.debug('line amount', lineamount);
                        //         lines[i] = amountperweek + lineamount
                        //     } else {
                        //         lines[i] = amountleft + lineamount
                        //     }

                        //     amountleft - amountperweek
                        // }
                        // log.emergency('amount left', lines);
                        return true;
                    });



                    log.debug('lines full', lines);
                    var newamount = 0;
                    for (var i = 0; i < lines.length; i++) {
                        var budgetseq = record.create({
                            type: 'customrecord_bb_proj_exp_budg_line_seq',
                            isDynamic: true
                        });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_exp_budg_line_seq_proj', value: project });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_seq', value: lines[i].sequence });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_seq_amt', value: parseFloat(lines[i].amount) });
                        newamount = newamount + parseFloat(lines[i].amount)
                        budgetseq.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line', value: budgetline });
                        budgetseq.setValue({ fieldId: 'custrecord_bb_exp_budg_line_seq_item', value: item });
                        var weekstr = lines[i].week[1];
                        weekstr = weekstr.toString();
                        if (weekstr.length == 1) {
                            log.debug('early week', weekstr);
                            weekstr = '0' + weekstr
                        }
                        var week = lines[i].week[0] + '-' + weekstr;
                        log.debug('234 week', week);
                        if (sequencetype != 1) budgetseq.setText({ fieldId: 'cseg_bb_paid_wk_num', text: week });
                       
                        var saveseq = budgetseq.save();
                        log.debug('save seq', saveseq);
                    }
                    record.submitFields({
                        type: 'customrecord_bb_proj_exp_budg_line',
                        id: budgetline,
                        values: { custrecord_bb_proj_exp_budget_amount: newamount }

                    })
                    return true;

                });

                if (budgetid) {
                    var budgetrec = record.load({
                        type: 'customrecord_bb_proj_exp_budget',
                        id: budgetid,
                        isDynamic: true
                    })
                } else {
                    return;
                    var budgetrec = record.create({
                        type: 'customrecord_bb_proj_exp_budget',
                        isDynamic: true
                    });
                    //TODO math for sequence number
                    var sequence = 6;
                    budgetrec.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_version', value: String(new Date()) });
                    budgetrec.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_project', value: project });
                    budgetrec.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_seq', value: 2 });
                    budgetrec.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_seq_count', value: sequence });
                    var save = budgetrec.save();

                    var budgetline = record.create({
                        type: 'customrecord_bb_proj_exp_budg_line',
                        isDynamic: true
                    });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget', value: save });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budg_line_proj', value: project });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_amount', value: amount });
                    budgetline.setValue({ fieldId: 'custrecord_bb_proj_exp_budget_item', value: item });
                    //TODO Fill in budget expense when built

                    var budgetid = budgetline.save();
                }
                return true;

            });


            log.debug('rec', rec + ' action ' + action);
            var rectype = rec.type;
            var recid = rec.id;
            var taskrecid = '';
            var recordtype = '';
            var dupfortitlecheck = false;
            //Search for line sequences to delete
        } catch (e) {
            log.debug('total catch', e);
        }

    }
    function getWeekNumber(d) {
        // Copy date so don't modify original
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        // Set to nearest Thursday: current date + 4 - current day number
        // Make Sunday's day number 7
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        // Get first day of year
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        // Calculate full weeks to nearest Thursday
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        // Return array of year and week number
        var year = d.getUTCFullYear();
        return [d.getUTCFullYear(), weekNo];
    }
    return {
        onAction: onAction
    }
});
