/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/search', 'N/record', 'N/ui/serverWidget', 'N/config', 'N/task', 'N/redirect', 'N/runtime'], function (search, record, serverWidget, config, task, redirect, runtime) {
    function onRequest(context) {
        // parameters.....
        var request = context.request;


        if (context.request.method == 'GET') {
            var monthParam = request.parameters.month || null;
            var yearParam = request.parameters.year || null;
            var taskId = request.parameters.mapreducetask || null;
            var scriptObj = runtime.getCurrentScript()
            var form = serverWidget.createForm({
                title: 'Consolidated Energy Details'
            });
            var fld_task = form.addField({
                id: "custpage_taskid",
                type: serverWidget.FieldType.TEXT,
                label: 'task id'
            });

            fld_task.defaultValue = taskId;

            fld_task.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            var scriptId = form.addField({
                id: "custpage_scriptid",
                type: serverWidget.FieldType.TEXT,
                label: 'task id'
            });

            scriptId.defaultValue = scriptObj.id;

            scriptId.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            var depId = form.addField({
                id: "custpage_depid",
                type: serverWidget.FieldType.TEXT,
                label: 'task id'
            });

            depId.defaultValue = scriptObj.deploymentId;

            depId.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            form.clientScriptModulePath = './BB.CS.ConsolidatedEnergyScreen';
            if (!taskId) {
                form.addButton({
                    id: 'buttonid',
                    label: 'Refresh',
                    functionName: 'refresh()'
                });
                var monthField = form.addField({
                    id: 'custpage_month',
                    type: 'select',
                    label: 'Select Month',
                    source: 'customlist_bb_month'
                });
                var month = monthParam ? monthParam : ((new Date()).getMonth() + 1)
                monthField.defaultValue = month

                var yearField = form.addField({
                    id: 'custpage_year',
                    type: 'select',
                    label: 'Select Year'
                });
                yearField.addSelectOption({
                    value: (new Date()).getFullYear(),
                    text: (new Date()).getFullYear()
                })
                yearField.addSelectOption({
                    value: ((new Date()).getFullYear() - 1),
                    text: ((new Date()).getFullYear() - 1)
                })
                yearField.addSelectOption({
                    value: ((new Date()).getFullYear() - 2),
                    text: ((new Date()).getFullYear() - 2)
                })
                var year = yearParam ? yearParam : (new Date()).getFullYear()
                yearField.defaultValue = year

                var sublist = form.addSublist({
                    id: 'custpage_energy_list',
                    type: serverWidget.SublistType.LIST,
                    label: 'Energy generated Details'
                });
                sublist.addButton({
                    id: 'custpage_mark_all',
                    label: 'Mark All',
                    functionName: 'markAll(true, "custpage_energy_list")'
                });
                sublist.addButton({
                    id: 'custpage_mark_all',
                    label: 'Unmark All',
                    functionName: 'markAll(false, "custpage_energy_list")'
                });

                createSuiteletSublist(sublist)
                populateSuiteletData(sublist, getSavedSearchResult(month, year))
                form.addSubmitButton({
                    label: 'Get Data'
                });
            }

            context.response.writePage(form);
        } else {

            var monthToCheck = context.request.parameters.custpage_month
            var yearToCheck = context.request.parameters.custpage_year
            var projLines = context.request.getLineCount({
                group: 'custpage_energy_list'
            });

            var projToProcess = []
            for (var num = 0; num < projLines; num++) {
                var mark = context.request.getSublistValue({
                    group: 'custpage_energy_list',
                    name: 'custpage_check_box',
                    line: num
                });
                if (mark == 'T') {
                    projToProcess.push(context.request.getSublistValue({
                        group: 'custpage_energy_list',
                        name: 'custpage_proj_internal_id',
                        line: num
                    }))
                }
            }

            if (projToProcess.length > 0) {
                var projObj = getProjectEnergyproductionrecordsForProjects(projToProcess, monthToCheck, yearToCheck)
                var energyDataNotpresentPerProject = getenergyMissingProjWithDates(projObj, monthToCheck, yearToCheck)
                log.debug('projObj', projObj)
                log.debug('energyDataNotpresentPerProject', energyDataNotpresentPerProject)

                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_bb_ss_mr_monthlyengprodgen',
                        deploymentId: 'customdeploy_bb_ss_mr_monthlyengprodgen',
                        params: {
                            custscript_bb_from_cons_energy_suitelet: true,
                            custscript_bb_consolidated_array: energyDataNotpresentPerProject
                        }
                    });
                    var taskID = mrTask.submit();
                    redirect.toSuitelet({
                        scriptId: 'customscript_bb_sl_consolidatedenergyscr',
                        deploymentId: 'customdeploy_bb_sl_consolidatedenergyscr',
                        parameters: {
                            'mapreducetask': taskID
                        }
                    });
            } else {
                redirect.toSuitelet({
                    scriptId: 'customscript_bb_sl_consolidatedenergyscr',
                    deploymentId: 'customdeploy_bb_sl_consolidatedenergyscr'
                });
            }


        }
    }

    function getSavedSearchResult(month, year) {

        var lastDateOfTheMonth = new Date(year, month, 0).getDate();

        var dateRangeStartDate = month + '/1/' + year;
        var dateRangeEndDate = month + '/' + lastDateOfTheMonth + '/' + year;
        log.debug("SUBSTR(TO_CHAR(LAST_DAY(TRUNC(TO_DATE('" + dateRangeStartDate + "','MM/DD/YYYY'), 'MONTH')),'DD-MM-YYYY'),1,2)")
        var customrecord_bb_proj_energy_productionSearchObj = search.create({
            type: "customrecord_bb_proj_energy_production",
            filters:
                [
                    ["custrecord_bb_proj_en_prdct_st_date", "within", dateRangeStartDate, dateRangeEndDate]
                ],
            columns:
                [
                    search.createColumn({
                        name: "custrecord_bb_proj_en_prdct_project",
                        summary: "GROUP",
                        label: "Project"
                    }),
                    search.createColumn({
                        name: "entityid",
                        join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                        summary: "GROUP",
                        label: "ID"
                    }),
                    search.createColumn({
                        name: "internalid",
                        summary: "COUNT",
                        label: "Days in the system"
                    }),
                    search.createColumn({
                        name: "formulatext",
                        summary: "MAX",
                        formula: "SUBSTR(TO_CHAR(LAST_DAY(TRUNC(TO_DATE('" + dateRangeStartDate + "','MM/DD/YYYY'), 'MONTH')),'DD-MM-YYYY'),1,2)",
                        label: "Days Needed"
                    }),
                    search.createColumn({
                        name: "formulatext",
                        summary: "MAX",
                        formula: "SUBSTR(TO_CHAR(LAST_DAY(TRUNC(TO_DATE('" + dateRangeStartDate + "','MM/DD/YYYY'), 'MONTH')),'DD-MM-YYYY'),1,2)  -  count({internalid})",
                        label: "Missing Days"
                    }),
                    search.createColumn({
                        name: "custrecordustrecord_bb_proj_en_produced",
                        summary: "SUM",
                        label: "Energy Produced"
                    }),
                    search.createColumn({
                        name: "custrecord_bb_energy_prod_revenue",
                        summary: "SUM",
                        label: "Revenue"
                    })
                ]
        });

        var searchResultCount = customrecord_bb_proj_energy_productionSearchObj.runPaged().count;
        log.debug("customrecord_bb_proj_energy_productionSearchObj result count", searchResultCount);

        return customrecord_bb_proj_energy_productionSearchObj;
    }


    function createSuiteletSublist(sublist) {
        var checkBox = sublist.addField({
            id: 'custpage_check_box',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Mark'
        });
        var projinternalIdFld = sublist.addField({
            id: 'custpage_project_id',
            type: serverWidget.FieldType.URL,
            label: 'Project Link'
        });
        projinternalIdFld.linkText = 'View Project';
        var projFld = sublist.addField({
            id: 'custpage_project',
            type: serverWidget.FieldType.TEXT,
            label: 'Project'
        });
        var daysInSysFld = sublist.addField({
            id: 'custpage_days_in_sys',
            type: serverWidget.FieldType.TEXT,
            label: 'Days in the system'
        });
        var daysNeededFld = sublist.addField({
            id: 'custpage_days_needed',
            type: serverWidget.FieldType.TEXT,
            label: 'Days Needed'
        });
        var missingDaysFld = sublist.addField({
            id: 'custpage_missing_days',
            type: serverWidget.FieldType.TEXT,
            label: 'Missing Days'
        });
        var energyProdFld = sublist.addField({
            id: 'custpage_energy_produced',
            type: serverWidget.FieldType.TEXT,
            label: 'Energy Produced'
        });
        var revenueFld = sublist.addField({
            id: 'custpage_revenue',
            type: serverWidget.FieldType.TEXT,
            label: 'Revenue'
        });
        var projInternalIdFld = sublist.addField({
            id: 'custpage_proj_internal_id',
            type: serverWidget.FieldType.TEXT,
            label: 'projInternalid'
        });
        projInternalIdFld.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        revenueFld.defaultValue = '0';
    }


    function populateSuiteletData(sublist, searchResult) {
        var companyInfo = config.load({
            type: config.Type.COMPANY_INFORMATION
        });
        var accountNum = companyInfo.getValue({
            fieldId: 'companyid'
        });
        var accountId = '';
        var pattern = new RegExp(/[_]/);
        var patternNumber = new RegExp(/[1]/);
        if (pattern.test(accountNum)) {
            var sbacctId = accountNum.split('_').shift();
            var number = accountNum.split('_').pop();
            accountId = sbacctId + '-' + number;
        } else {
            accountId = accountNum;
        }
        log.debug('columns', searchResult.Column)
        var count = 0;
        searchResult.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var projId = result.getValue({
                name: searchResult.columns[0],
                summary: "GROUP"
            })
            sublist.setSublistValue({
                id: 'custpage_project_id',
                line: count,
                value: 'https://' + accountId + '.app.netsuite.com/app/accounting/project/project.nl?id=' + projId
            });
            sublist.setSublistValue({
                id: 'custpage_project',
                line: count,
                value: result.getValue({
                    name: searchResult.columns[1],
                    summary: "GROUP"
                })
            });

            sublist.setSublistValue({
                id: 'custpage_days_in_sys',
                line: count,
                value: result.getValue({
                    name: searchResult.columns[2],
                    summary: "COUNT",
                })
            });
            sublist.setSublistValue({
                id: 'custpage_days_needed',
                line: count,
                value: result.getValue({
                    name: searchResult.columns[3],
                    summary: "MAX"
                })
            });
            sublist.setSublistValue({
                id: 'custpage_missing_days',
                line: count,
                value: result.getValue({
                    name: searchResult.columns[4],
                    summary: "MAX",
                })
            });
            sublist.setSublistValue({
                id: 'custpage_energy_produced',
                line: count,
                value: result.getValue({
                    name: searchResult.columns[5],
                    summary: "SUM",
                }) ? result.getValue({
                    name: searchResult.columns[5],
                    summary: "SUM"
                }) : null
            });
            sublist.setSublistValue({
                id: 'custpage_revenue',
                line: count,
                value: result.getValue({
                    name: searchResult.columns[6],
                    summary: "SUM"
                }) ? result.getValue({
                    name: searchResult.columns[6],
                    summary: "SUM"
                }) : null
            });
            sublist.setSublistValue({
                id: 'custpage_proj_internal_id',
                line: count,
                value: projId
            });

            count = count + 1
            return true;
        });
    }


    function getProjectEnergyproductionrecordsForProjects(projToProcess, month, year) {

        log.debug('projToProcess', projToProcess)
        var ALSO_ENERGY = 1;
        var SOLAR_EDGE = 2;
        var POWER_FACTOR = 4
        var lastDateOfTheMonth = new Date(year, month, 0).getDate();

        var dateRangeStartDate = month + '/1/' + year;
        var dateRangeEndDate = month + '/' + lastDateOfTheMonth + '/' + year;
        var customrecord_bb_proj_energy_productionSearchObj = search.create({
            type: "customrecord_bb_proj_energy_production",
            filters:
                [
                    ["custrecord_bb_proj_en_prdct_project", "anyof", projToProcess],
                    "AND",
                    ["custrecord_bb_proj_en_prdct_st_date", "within", dateRangeStartDate, dateRangeEndDate]
                ],
            columns:
                [
                    search.createColumn({
                        name: "custrecord_bb_proj_en_prdct_st_date",
                        sort: search.Sort.ASC,
                        label: "Start Date"
                    }),
                    search.createColumn({name: "custrecord_bb_proj_en_prdct_project", label: "Project"}),
                    search.createColumn({
                        name: "custentity_bb_energy_production_source",
                        join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                        label: "Energy Production Source"
                    }),
                    search.createColumn({
                        name: "custentity_bb_ss_alsoenergy_site_id",
                        join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                        label: "AlsoEnergy Site"
                    }),
                    search.createColumn({
                        name: "custentity_bb_ss_solaredge_site_id",
                        join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                        label: "SolarEdge Site"
                    }),
                    search.createColumn({
                        name: "custentity_bb_ss_powerfactors_site_id",
                        join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                        label: "PowerFactors Site Id"
                    })
                ]
        });
        var searchResultCount = customrecord_bb_proj_energy_productionSearchObj.runPaged().count;
        log.debug("customrecord_bb_proj_energy_productionSearchObj result count", searchResultCount);
        var projectObj = {}
        customrecord_bb_proj_energy_productionSearchObj.run().each(function (result) {
            var proj = result.getValue({
                name: 'custrecord_bb_proj_en_prdct_project'
            })
            var energySource = result.getValue({
                name: "custentity_bb_energy_production_source",
                join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
            })
            var siteId;
            if (energySource == ALSO_ENERGY) {
                siteId = result.getValue({
                    name: "custentity_bb_ss_alsoenergy_site_id",
                    join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                })
            } else if (energySource == SOLAR_EDGE) {
                siteId = result.getValue({
                    name: "custentity_bb_ss_solaredge_site_id",
                    join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                })
            } else if (energySource == POWER_FACTOR) {
                siteId = result.getValue({
                    name: "custentity_bb_ss_powerfactors_site_id",
                    join: "CUSTRECORD_BB_PROJ_EN_PRDCT_PROJECT",
                })
            }
            var projID = proj + "%" + energySource

            if (projectObj[projID]) {
                var date = result.getValue({
                    name: 'custrecord_bb_proj_en_prdct_st_date'
                })
                var dateNumber = date.split(" ")[0].split("/")[1]
                projectObj[projID].push(dateNumber + '?' + siteId)
            } else {
                var date = result.getValue({
                    name: 'custrecord_bb_proj_en_prdct_st_date'
                })
                var dateNumber = date.split(" ")[0].split("/")[1]
                projectObj[projID] = [dateNumber + '?' + siteId]
            }


            return true;
        });
        return projectObj;
    }

    function getenergyMissingProjWithDates(projObj, monthToCheck, yearToCheck) {
        var lastDateOfTheMonth = new Date(yearToCheck, monthToCheck, 0).getDate();
        log.debug('lastDateOfTheMonth', lastDateOfTheMonth)
        var todayMonth = new Date().getMonth() + 1;
        var todayNumberOfDay = new Date().getDate() - 1;
        var lastDay = 0;
        if (todayMonth != monthToCheck) {
            lastDay = lastDateOfTheMonth
        } else {
            lastDay = todayNumberOfDay
        }
        var finalArray = []
        log.debug('projObj', projObj)

        var newProjObj = {};
        var site;

        for (var proj in projObj) {
            var dateArr = []
            site = projObj[proj][0].toString().split('?')[1]
            for (var ind = 0; ind < projObj[proj].length; ind++) {
                var dateSiteIDArr = projObj[proj][ind].toString().split('?')
                dateArr.push(dateSiteIDArr[0])
            }
            log.debug('dateArr',dateArr)
            newProjObj[proj] = dateArr
        }

        for (var proj in newProjObj) {
            log.debug('new projObj proj',proj)
            for (var num = 1; num < lastDay + 1; num++) {
                if (newProjObj[proj].indexOf(num.toString()) == -1) {
                    var projidArr = proj.split('%')
                    log.audit(dateSiteIDArr[1])
                    finalArray.push({
                        id: projidArr[0],
                        startDate: monthToCheck + '/' + num + '/' + yearToCheck + ' 00:00:00',
                        endDate: monthToCheck + '/' + (num + 1) + '/' + yearToCheck + ' 00:00:00',
                        energySource: projidArr[1],
                        site: site
                    })
                }
            }
        }
        return finalArray;
    }

    return {
        onRequest: onRequest
    };
});