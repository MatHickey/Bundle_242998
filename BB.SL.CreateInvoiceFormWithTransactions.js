/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/render', 'N/file', 'N/email', 'N/redirect', 'N/runtime', 'N/query'], function (record, search, render, file, email, redirect, runtime, query) {




    function getAllUrlParams(url) {

        // get query string from url (optional) or window
        var queryString = url ? url.split('?')[1] : window.location.search.slice(1);
        // we'll store the parameters here
        var obj = {};
        // if query string exists
        if (queryString) {
            // stuff after # is not part of query string, so get rid of it
            queryString = queryString.split('#')[0];
            // split our query string into its component parts
            var arr = queryString.split('&');
            for (var i = 0; i < arr.length; i++) {
                // separate the keys and the values
                var a = arr[i].split('=');
                // set parameter name and value (use 'true' if empty)
                var paramName = a[0];
                var paramValue = typeof (a[1]) === 'undefined' ? true : a[1];
                // (optional) keep case consistent
                paramName = paramName.toLowerCase();
                if (typeof paramValue === 'string') paramValue = paramValue.toLowerCase();
                // if the paramName ends with square brackets, e.g. colors[] or colors[2]
                if (paramName.match(/\[(\d+)?\]$/)) {
                    // create key if it doesn't exist
                    var key = paramName.replace(/\[(\d+)?\]/, '');
                    if (!obj[key]) obj[key] = [];
                    // if it's an indexed array e.g. colors[2]
                    if (paramName.match(/\[\d+\]$/)) {
                        // get the index value and add the entry at the appropriate position
                        var index = /\[(\d+)\]/.exec(paramName)[1];
                        obj[key][index] = paramValue;
                    } else {
                        // otherwise add the value to the end of the array
                        obj[key].push(paramValue);
                    }
                } else {
                    // we're dealing with a string
                    if (!obj[paramName]) {
                        // if it doesn't exist, create property
                        obj[paramName] = paramValue;
                    } else if (obj[paramName] && typeof obj[paramName] === 'string') {
                        // if property does exist and it's a string, convert it to an array
                        obj[paramName] = [obj[paramName]];
                        obj[paramName].push(paramValue);
                    } else {
                        // otherwise add the property
                        obj[paramName].push(paramValue);
                    }
                }
            }
        }

        return obj;
    }
    function onRequest(context) {
        log.debug('run', context.request.method);

        if (context.request.method) {
            log.debug('context', context.request);
            log.debug('context', context.request.headers.referer);
            var urlstr = context.request.headers.referer;
            var urlpackinglist, urlsalesorder, transactionfilter, packingslip, salesorder;
            if (urlstr) {
                var urlsearch = getAllUrlParams(urlstr);
                log.debug('url search', urlsearch);
                var paramid = urlsearch.id;
                var rectype;
                var istransaction = false;
                if (urlstr.indexOf('transactions') != -1) {
                    log.debug('Source is transaction', paramid);
                    istransaction = true;
                    var sql = 'SELECT recordtype, type FROM transaction where id = ?';
                    var results = query.runSuiteQL({ query: sql, params: [paramid] });
                    results = results.asMappedResults();
                    log.debug('sql results', results);
                    rectype = results[0].recordtype;

                }
                //get param date for form, search and folder to store
                var me = runtime.getCurrentScript();
                var searchcriteria = me.getParameter({ name: 'custscript_bb_sl_template_search' });
                var form = me.getParameter({ name: 'custscript_bb_sl_formid_int' });
                var savefolder = me.getParameter({ name: 'custscript_bb_sl_save_folder_txt' });

                var criteriafield = me.getParameter({ name: 'custscript_bb_sl_advprint_criteria_text' });
                var criteriatype = me.getParameter({ name: 'custscript_bb_sl_advprint_criteria_type' });
                var criteriasearchfield = me.getParameter({ name: 'custscript_bb_sl_advprint_criteria_value' });

                var criteriafieldSublist = me.getParameter({ name: 'custscript__bb_sl_advprint_criteria_subl' });
                var criteriatypeSublist = me.getParameter({ name: 'custscript_bb_sl_advprint_crit_type_subl' });
                var criteriasearchfieldSublist = me.getParameter({ name: 'custscript_bb_sl_advprint_crit_val_subl' });

                var criteriavalue;

                log.debug('criteria fields', {field:criteriafield, type: criteriatype, searchfield: criteriasearchfield })
                if (criteriasearchfield) {

                    if (istransaction) { // pass record type as a parameter
                        var sql = 'SELECT ' + criteriasearchfield + ', type FROM transaction where id = ?';
                        var results = query.runSuiteQL({ query: sql, params: [paramid] });
                        results = results.asMappedResults();
                        log.debug('transactionfieldresult results', results);
                        criteriavalue = results[0][criteriasearchfield];
                        log.debug('criteria value field', criteriavalue)

                    };
                }
                if (!searchcriteria) throw "Missing search parameter";
                if (!form) throw "Missing form parameter";
                if (!savefolder) throw "Missing save parameter";
                var renderer = render.create();

                renderer.setTemplateById(form);
                var invoiceSearchObj = search.load({
                    id: searchcriteria
                })
                var filters = invoiceSearchObj.filterExpression;
                // this code block is just in case the UI already has a filtered value
                var hasFilter = false;
                if (!criteriafield && !criteriasearchfield && !critertiatype ) {
                    for (var f = 0; f < filters.length; f++) {
                        if (filters[f][0] == 'internalid') {
                            filters[f] = ["internalid", "anyof", paramid];
                            hasFilter = true;
                        }
                    }
                    if (!hasFilter) filters.push("AND", ["internalid", "anyof", paramid]);
                } else if (criteriafieldSublist && criteriatypeSublist && criteriavalue ) {
                    for (var f = 0; f < filters.length; f++) {
                        if (filters[f][0] == criteriafieldSublist) {
                            filters[f] = [criteriafieldSublist, criteriatypeSublist, criteriavalue];
                            hasFilter = true;
                        }
                    }
                    if (!hasFilter) filters.push("AND", [criteriafieldSublist, criteriatypeSublist, criteriavalue]);
                } else  {
                    for (var f = 0; f < filters.length; f++) {
                        if (filters[f][0] == criteriafield) {
                            filters[f] = [criteriafield, criteriatype, criteriavalue];
                            hasFilter = true;
                        }
                    }
                    if (!hasFilter) filters.push("AND", [criteriafield, criteriatype, criteriavalue]);
                }
                log.audit('duplicate filters', filters);
                invoiceSearchObj.filterExpression = filters;
                //invoiceSearchObj.run();
                log.debug('invoiceSearchObj results', invoiceSearchObj);

                var newLocal = renderer.addRecord('record', record.load({
                    type: rectype,
                    id: paramid
                }));
                var results = getCustomSearchLineObject(invoiceSearchObj)
                renderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: "results",
                    data: results
                });
            };

            log.debug('file before lookup')
            //look up file if it exists before creating to delete for caching purposes

            var folderSearchObj = search.create({
                type: "folder",
                filters:
                    [
                        ["internalidnumber", "equalto", savefolder],
                        "AND",
                        ["file.name", "is", rectype + paramid + '.pdf']
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({ name: "foldersize", label: "Size (KB)" }),
                        search.createColumn({ name: "lastmodifieddate", label: "Last Modified" }),
                        search.createColumn({ name: "parent", label: "Sub of" }),
                        search.createColumn({ name: "numfiles", label: "# of Files" }),
                        search.createColumn({
                            name: "name",
                            join: "file",
                            label: "Name"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "file",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "folder",
                            join: "file",
                            label: "Folder"
                        })
                    ]
            });
            var searchResultCount = folderSearchObj.runPaged().count;
            log.debug("folderSearchObj result count", searchResultCount);
            folderSearchObj.run().each(function (result) {
                log.debug('file to delete', result);
                var fileDelete = result.getValue({
                    name: "internalid",
                    join: "file"
                })
                file.delete({
                    id: fileDelete
                });
                // .run().each has a limit of 4,000 results
                return true;
            });

            var contents = renderer.renderAsPdf();
            log.debug('contents', contents);

            contents.folder = savefolder;
            contents.name = rectype + paramid + '.pdf';
            var fileId = contents.save();
            if (paramid) {
                var id = record.attach({
                    record: {
                        type: 'file',
                        id: fileId
                    },
                    to: {
                        type: rectype,
                        id: paramid
                    }
                });
            }
            var itemFile = file.load(fileId);
            redirect.redirect({
                url: itemFile.url
            });
        }
    }


    function getCustomSearchLineObject(searchResult) {
        var lineArrayObj = {
            lines: []
        };
        searchResult.run().each(function(result) {
            var lineObj = {};
            for (var c = 0; c < searchResult.columns.length; c++) {
                lineObj[searchResult.columns[c].label] = result.getValue(searchResult.columns[c]);
            }
            lineArrayObj.lines.push(lineObj);

            return true;
        })
        log.audit('lines', lineArrayObj)
        return lineArrayObj;

    }

    return {
        onRequest: onRequest
    }
});