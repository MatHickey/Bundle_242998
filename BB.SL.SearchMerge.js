/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/runtime', 'N/file', 'N/https', 'N/url'],

    function (serverWidget, search, record, runtime, file, https, url) {
        /**
         * The script generates a Reports based on multiple searches and parameters set on the script deployment record
         * @param context
         */
        function onRequest(context) {
            if (context.request.method === https.Method.GET || context.request.method === https.Method.POST) {
                let currentScript = runtime.getCurrentScript();
                let reportName = currentScript.getParameter({name: 'custscript_bb_report_name_text'});
                let mergeOnColumnText = currentScript.getParameter({name: 'custscript_bb_merge_on_column_text'});
                let mainSearchID = currentScript.getParameter({name: 'custscript_bb_main_search_search'});
                let searchIds = currentScript.getParameter({name: 'custscript_bb_search_ids_text'});
                let columns = JSON.parse(currentScript.getParameter({name: 'custscript_bb_column_order_text'}).replace(/(\r\n|\n|\r)/gm, ""));
                let showProjectStage = currentScript.getParameter({name: 'custscript_bb_show_project_status'})


                let currentAccountingPeriod = context.request.parameters.currentAccountingPeriod;
                let projectStatus = context.request.parameters.projectStatus;
                let hideNav = context.request.parameters.hideNav || false;

                let mainSearchObj = search.load({
                    id: mainSearchID
                });
                if (showProjectStage && projectStatus) {
                    var defaultStatusSelection;
                    if (projectStatus) {
                        if (projectStatus.indexOf(',') != -1) {
                            defaultStatusSelection = projectStatus.split(',').map(String);
                        } else {
                            defaultStatusSelection = projectStatus
                        }
                    }
                    log.audit('project status uri decoded', defaultStatusSelection)
                    var additionalFiltersProjectStatus = [ "AND", ["custentity_bb_project_status","anyof", defaultStatusSelection]];
                    var newFilterExpressionProjectStatus = mainSearchObj.filterExpression.concat(additionalFiltersProjectStatus);
                    mainSearchObj.filterExpression = newFilterExpressionProjectStatus;
                }

                let mainSearchResults = getSearch(mainSearchObj);
                let mainSearchColumns = getSearchColumns(mainSearchObj, mergeOnColumnText);
                let mappedResults = {};
                mapResults(mainSearchResults, mainSearchColumns, mappedResults, mainSearchObj, columns);
                if (currentAccountingPeriod) {
                    var accountingObj = search.lookupFields({
                        type: search.Type.ACCOUNTING_PERIOD,
                        id: currentAccountingPeriod,
                        columns: ['enddate']
                    })
                }
                searchIds = searchIds.split(',');
                searchIds.forEach(function (searchId) {
                    let searchObj = search.load({
                        id: searchId
                    });
                    log.debug('search type', searchObj.searchType);

                    if (accountingObj && searchObj.searchType == 'transaction') {
                        log.debug('accountingObj.enddate', accountingObj.enddate);
                        var additionalFilters = [ "AND", ["formuladate: {trandate}","onorbefore", accountingObj.enddate]];
                        var newFilterExpression = searchObj.filterExpression.concat(additionalFilters);
                        searchObj.filterExpression = newFilterExpression;
                    }
                    let searchResults = getSearch(searchObj);
                    let searchColumns = getSearchColumns(searchObj, mergeOnColumnText);
                    mapResults(searchResults, searchColumns, mappedResults, searchObj, columns);
                });
                // log.debug('mappedResults', mappedResults)
                if (context.request.method === https.Method.GET) {
                    context.response.writePage(createForm(mainSearchResults, mainSearchColumns, mappedResults, columns, reportName, currentAccountingPeriod, defaultStatusSelection, hideNav));
                } else {
                    context.response.writeFile(createCsvFile(mainSearchResults, mainSearchColumns, mappedResults, columns, reportName));
                }
            }
        }

        /**
         * Get all the columns of the search and identifies the Merge on column
         * @param searchObj -  NS search Object
         * @param mergeOnColumnText -  the column label used in the saved search
         * @returns {{columns, mergeOnColumn}}   -  {columns : NS column object, mergeOnColumn : NS column object}
         */
        function getSearchColumns(searchObj, mergeOnColumnText) {
            let columns = searchObj.columns;
            let mergeOnColumn;
            for (let x = 0; x < columns.length; x++) {
                if (columns[x].label === mergeOnColumnText) {
                    mergeOnColumn = columns[x];
                    break;
                }
            }
            return {
                mergeOnColumn: mergeOnColumn,
                columns: columns
            }
        }

        /**
         * Maps the search results based on the merge on column
         * @param searchResults - Array of search results
         * @param searchColumns -  {columns : NS column object, mergeOnColumn : NS column object}
         * @param mappedResults - Map that contains the mapped values
         * @param parameterColumns - Array of objects containing data on the columns to show in the suitelet form.
         * @returns {*}
         */

        function mapResults(searchResults, searchColumns, mappedResults, searchObj, parameterColumns) {
            let columns = searchColumns.columns;
            for (let x = 0; x < searchResults.length; x++) {
                let result=searchResults[x];
                let mergeColumnValue = result.getValue(searchColumns.mergeOnColumn); // is the project id
                if (isNullOrEmpty(mappedResults[mergeColumnValue])) {
                    mappedResults[mergeColumnValue] = {};
                }

                for (let y = 0; y < columns.length; y++) {
                    let column=columns[y];
                    mappedResults[mergeColumnValue][column.label] = {
                        value: result.getValue(column),
                        searchID: searchObj.id,
                    };
                    var linkReferenceArray = parameterColumns.filter(function (data) {
                        if (data.linkReference) {
                            return data
                        }
                    })
                    if (linkReferenceArray.length > 0) {
                        for (var l = 0; l < linkReferenceArray.length; l++) {
                            var linkReference = linkReferenceArray[l].linkReference;
                            var name = linkReferenceArray[l].name;
                            if (mappedResults[mergeColumnValue][name] && mappedResults[mergeColumnValue][linkReference]) {
                                var link = mappedResults[mergeColumnValue][linkReference].value
                                mappedResults[mergeColumnValue][name].drillDownLink = link;
                            }
                        }
                    }
                }
            }
            return mappedResults;
        }

        /**
         * Returns all results of the a search
         * @param searchObj -  NS search obj
         * @returns {[]} - Array of search results
         */
        function getSearch(searchObj) {
            let results = [];
            let tempResults = [];
            let rangeStart = 0;
            let rangeEnd = 1000;

            let resultSet = searchObj.run();
            let tempResultsLength = 0;
            do {
                tempResults = resultSet.getRange({
                    start: rangeStart,
                    end: rangeEnd
                });
                tempResultsLength = !isNullOrEmpty(tempResults) ? tempResults.length : 0;
                if (tempResultsLength > 0) {
                    results = results.concat(tempResults);
                }
                rangeStart = rangeEnd;
                rangeEnd += 1000;
            }
            while (tempResultsLength === 1000);
            return results;
        }

        /**
         * Creates a form for the Suitelet to display
         * @param mainSearchResults -  Array of search results
         * @param mainSearchColumns -  {columns : NS column object, mergeOnColumn : NS column object}
         * @param mappedResults -  Mapped values of all the searches
         * @param columns -  the column parameters set on the deployment record
         * @param reportName -  The report name
         * @returns {{}} -  NS form obj
         */
        function createForm(mainSearchResults, mainSearchColumns, mappedResults, columns, reportName, currentAccountingPeriod, projectStatus, hideNav) {
            //log.debug('mainSearchResults', mainSearchResults)
            //log.debug('mainSearchColumns', mainSearchColumns)
            //log.debug('mappedResults', mappedResults)
            //log.debug('columns', columns)
            //log.debug('reportName', reportName)
            //log.debug('searchType', mainSearchResults.Type)
            log.audit('currentAccountingPeriod', currentAccountingPeriod)
            log.audit('projectStatus', projectStatus)
            let form = serverWidget.createForm({
                title: hideNav !== false ? ' ' : reportName,
                hideNavBar: hideNav !== false
            });
            var projectStatusParam = runtime.getCurrentScript().getParameter({name: 'custscript_bb_show_project_status'});
            if (projectStatusParam) {
                var projectStatusFilter = form.addField({
                    id: 'custpage_project_status',
                    type: serverWidget.FieldType.MULTISELECT,
                    label: 'Project Status',
                    source: 'customlist_bb_project_status'
                });
                projectStatusFilter.defaultValue = (projectStatus) ? projectStatus : null;
                form.addButton({
                    id: 'custpage_search_proj_status',
                    label: 'Search Project Status',
                    functionName: 'viewProjectStatus'
                })
            }
			var scriptIdValue = runtime.getCurrentScript().getParameter({name: 'custscript_bb_script_id'});
            var scriptDeploymentValue = runtime.getCurrentScript().getParameter({name: 'custscript_bb_deployment_id'});
          	
          	if (scriptIdValue && scriptDeploymentValue) {
                 var accountingPeriod = form.addField({
                  id : 'custpage_as_of_period',
                  type : serverWidget.FieldType.SELECT,
                 label : 'As Of Period',
                 source: 'accountingperiod'
              });
              if (currentAccountingPeriod) {
                 accountingPeriod.defaultValue = currentAccountingPeriod;
              }

              //form.addField({
              //   id : 'custpage_as_of_period',
              //    type : serverWidget.FieldType.SELECT,
              //    label : 'As Of Period',
              //  source: 'accountingperiod'
              // });

              var scriptId = form.addField({
                  id : 'custpage_script_internalid',
                  type : serverWidget.FieldType.TEXT,
                  label : 'Script ID'
              })
              scriptId.defaultValue = runtime.getCurrentScript().getParameter({name: 'custscript_bb_script_id'})

              var scriptDeployment = form.addField({
                  id : 'custpage_script_deploymentid',
                  type : serverWidget.FieldType.TEXT,
                  label : 'Script Deployment'
              })
              log.debug('scriptId')
              scriptDeployment.defaultValue = runtime.getCurrentScript().getParameter({name: 'custscript_bb_deployment_id'});
              scriptId.updateDisplayType({
                  displayType : serverWidget.FieldDisplayType.HIDDEN
              });
              scriptDeployment.updateDisplayType({
                  displayType : serverWidget.FieldDisplayType.HIDDEN
              });
            }
           

            form.addSubmitButton({label: ' Download CSV File'});

            form.clientScriptModulePath = './BB.CS.SearchMergeValidation'

            let sublist = form.addSublist({
                id: 'custpage_sublist',
                type: serverWidget.SublistType.LIST,
                label: 'Results'
            });
            // add sublist header
            for (let x = 0; x < columns.length; x++) {
                if (isNullOrEmpty(columns[x].isVisible) || columns[x].isVisible) {
                    let type = columns[x].type;
                    if (!isNullOrEmpty(columns[x].searchLink)) {
                        type = 'TEXT'
                    }
                    sublist.addField({
                        id: 'cust_column_' + x,
                        type: type,
                        label: columns[x].name
                    });
                }
            }
            let domain = url.resolveDomain({
                hostType: url.HostType.APPLICATION,
                accountId: runtime.accountId

            });
            // add sublist values
            for (let x = 0; x < mainSearchResults.length; x++) {
                let mergeOnColumnValue = mainSearchResults[x].getValue(mainSearchColumns.mergeOnColumn)
                for (let y = 0; y < columns.length; y++) {
                    if (isNullOrEmpty(columns[y].isVisible) || columns[y].isVisible) {
                        let value = null;

                        if (!isNullOrEmpty(columns[y].formula)) {
                            value = evaluateFormula(mappedResults[mergeOnColumnValue], columns[y].formula)

                        } else if (!isNullOrEmpty(columns[y].searchLink) && columns[y].searchLink == 'True' ) {
                            if (!isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name])&&!isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name].value) && !isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name].drillDownLink)) {
                                value = '<a href="https://' + domain + mappedResults[mergeOnColumnValue][columns[y].name].drillDownLink + '&searchid=' + mappedResults[mergeOnColumnValue][columns[y].name].searchID + '" target="_blank">' + mappedResults[mergeOnColumnValue][columns[y].name].value + '</a>'
                            }
                            else if (!isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name])&&!isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name].value)) { //&& isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name].drillDownLink)
                                value = '<a href="https://' + domain + '/app/common/search/searchresults.nl?searchid=' + mappedResults[mergeOnColumnValue][columns[y].name].searchID + '&whence=" target="_blank">' + mappedResults[mergeOnColumnValue][columns[y].name].value + '</a>'
                            }
                        } else {
                            if (!isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name])) {
                                value = mappedResults[mergeOnColumnValue][columns[y].name].value;
                            }
                        }
                        if (!isNullOrEmpty(value)) {
                            log.debug('value', value)
                            log.debug('columns[y]', columns[y])
                            try{
                                sublist.setSublistValue({
                                    id: 'cust_column_' + y,
                                    line: x,
                                    value: value
                                });
                            } catch(e){
                                log.error('error',e)
                            }
                        }
                    }
                }
            }


            return form;

        }

        /**
         * Creates a csv file to download
         * @param mainSearchResults -  Array of search results
         * @param mainSearchColumns -  {columns : NS column object, mergeOnColumn : NS column object}
         * @param mappedResults -  Mapped values of all the searches
         * @param columns -  the column parameters set on the deployment record
         * @param reportName -  The report name
         * @returns {{}} -  NS file obj
         */
        function createCsvFile(mainSearchResults, mainSearchColumns, mappedResults, columns, reportName) {
            let csvFile = '';
            // add sublist fields
            for (let x = 0; x < columns.length; x++) {
                if (isNullOrEmpty(columns[x].isVisible) || columns[x].isVisible) {
                    csvFile += columns[x].name + ','
                }
            }
            csvFile += '\r\n';
            for (let x = 0; x < mainSearchResults.length; x++) {
                let mergeOnColumnValue = mainSearchResults[x].getValue(mainSearchColumns.mergeOnColumn)
                for (let y = 0; y < columns.length; y++) {
                    if (isNullOrEmpty(columns[y].isVisible) || columns[y].isVisible) {
                        let value = null;
                        if (!isNullOrEmpty(columns[y].formula)) {
                            value =  evaluateFormula(mappedResults[mergeOnColumnValue], columns[y].formula)  ;
                        } else {
                            if (!isNullOrEmpty(mappedResults[mergeOnColumnValue][columns[y].name])) {
                                value =   mappedResults[mergeOnColumnValue][columns[y].name].value  ;
                            }
                        }
                        if (!isNullOrEmpty(value)) {
                            if(typeof value === 'string' && value.indexOf(',') != -1){
                                value = '"' + value+ '"';
                            }

                            csvFile += value
                        }
                        csvFile += ',';
                    }
                }
                csvFile += '\r\n';
            }
            return file.create({
                name: reportName + '.csv',
                fileType: file.Type.PLAINTEXT,
                contents: csvFile
            });

        }

        /**
         * Replaces all the column with values and evaluates the formula
         * @param mappedResultsRow - the merged row od data
         * @param formula -  the formula that needs evaluating
         * @returns {}  - the value of the formula
         */
        function evaluateFormula(mappedResultsRow, formula) {
            //log.debug('mappedResultsRow', mappedResultsRow);
            let match = formula.match(/{{([^}]+)}}/g);
            for (let i = 0; i < match.length; i++) {
                let number = mappedResultsRow[match[i].substr(2, match[i].length - 4)];
                //log.debug('number', number);
                if (!isNullOrEmpty(number)){
                    number =  number.value || 0
                }
                if(isNullOrEmpty(number)) {
                    number = 0
                }
                formula = formula.replace(match[i], number);
            }
            //log.debug('formula', formula);
            return eval(formula);
        }

        /**
         * evaluates if the input got a value
         * @param value
         * @returns {boolean}
         */
        function isNullOrEmpty(value) {
            if (value == null || value == undefined || value == NaN) {
                return true;
            }

            switch (Object.prototype.toString.call(value).slice(8, -1)) {
                case 'JavaArray':
                case 'Array':
                    return (value.length == 0);
                case 'Object':
                    for (let prop in value) {
                        if (value.hasOwnProperty(prop)) {
                            return false;
                        }
                    }

                    return true && JSON.stringify(value) === JSON.stringify({});
                case 'String':
                    return (value.trim() === '');
            }

            return false;
        }

        return {
            onRequest: onRequest
        }

    }
)
;