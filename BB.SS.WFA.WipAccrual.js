/**
 * @NApiVersion 2.x
 * @NScriptType workflowactionscript
 * @NModuleScope Public
 * @Overview - Invoice Actual WFA script.
 */
define(['N/record', 'N/search', 'N/runtime', './BB SS/SS Lib/BB.SS.MD.WipAccrual'],

    function(record, search, runtime, wip) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(scriptContext) {
            // try {
            var locationDeptClassObj = {};
            var lastdayPreviousMonth, firstdayPreviousMonth;
            var wipId = null;
            var periodObj = null;
            var accountingPeriodParam = runtime.getCurrentScript().getParameter({name: 'custscript_bb_wip_period'});

            locationDeptClassObj.wipLocation = runtime.getCurrentScript().getParameter({name: 'custscript_bb_wip_location'});
            locationDeptClassObj.wipDepartment = runtime.getCurrentScript().getParameter({name: 'custscript_bb_wip_department'});
            locationDeptClassObj.wipClass = runtime.getCurrentScript().getParameter({name: 'custscript_bb_wip_class'});

            var project = scriptContext.newRecord;
            var projectId = project.id;
            log.debug('project id from context', projectId)
            var bbConfigRecId = project.getValue({fieldId: 'custentity_bbss_configuration'}) || 1;
            var config = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: bbConfigRecId
            });

            if (accountingPeriodParam) {
                periodObj = wip.getPeriodDetailsByName(null, accountingPeriodParam);
                log.debug('accounting period search object', periodObj);
                lastdayPreviousMonth = periodObj.enddate;
                firstdayPreviousMonth = periodObj.startdate;
                wipId = wip.getWipRecordByAccountingPeriod(accountingPeriodParam, project.id);
            } else {
                lastdayPreviousMonth = wip.createDateString(wip.getLastDayOfPreviousMonth());
                firstdayPreviousMonth = wip.createDateString(wip.getFirstDayOfPreviousMonth());
            }

            var revenueAmount = wip.getRevenueAmount(config, projectId, lastdayPreviousMonth);
            var projectedCogsAmount = wip.getProjectedCogsAmount(projectId, config);

            log.debug('revenueAmount', revenueAmount);
            log.debug('projectedCogsAmount', projectedCogsAmount);

            if (config.getValue({fieldId: 'custrecord_bb_use_pre_dev_expenses_bool'})) {
                var wipSetting = config.getValue({fieldId: 'custrecord_bb_pre_dev_execution_type'});
                if (wipSetting == 1) { // execute skip costs prior to revenue, costs by percent
                    if (revenueAmount > 0) {
                        // may not be needed, wip journal types could be created for projects that may need to be reversed.
                        var cogsAmount = wip.getCogsAmount(config, projectId, null, lastdayPreviousMonth);
                        log.debug('cogsAmount', cogsAmount);
                        wip.reversalAllWIPJEs(projectId);
                        if (revenueAmount && cogsAmount && projectedCogsAmount) {
                            wip.createWIPAccrualRecord(wipId, project, config, revenueAmount, cogsAmount, projectedCogsAmount, true, periodObj, locationDeptClassObj);
                        }
                    } else {
                        var cogsAmount = wip.getCogsAmount(config, projectId, firstdayPreviousMonth, lastdayPreviousMonth);
                        log.debug('cogsAmount', cogsAmount);
                        if (revenueAmount && cogsAmount && projectedCogsAmount) {
                            wip.createWIPAccrualRecord(wipId, project, config, revenueAmount, cogsAmount, projectedCogsAmount, false, periodObj, locationDeptClassObj);
                        }
                    }

                } else if (wipSetting == 2) { // execute all, first check if revenue is detected on project

                    if (revenueAmount > 0) { // check if revenue exists on project, reversal all wip JEs and
                        // first reverse all WIP records then generate new WIP record and start cost by percent
                        wip.reversalAllWIPJEs(projectId);
                        // generate cost by percent JE with wip record
                        var cogsAmount = wip.getCogsAmount(config, projectId, null, lastdayPreviousMonth);
                        log.debug('cogsAmount', cogsAmount);
                        if (revenueAmount && cogsAmount && projectedCogsAmount) {
                            wip.createWIPAccrualRecord(wipId, project, config, revenueAmount, cogsAmount, projectedCogsAmount, true, periodObj, locationDeptClassObj);
                        }
                    } else { // execute costs JE
                        // execute WIP JE's
                        var cogsAmount = wip.getCogsAmount(config, projectId, firstdayPreviousMonth, lastdayPreviousMonth);
                        log.debug('cogsAmount', cogsAmount);
                        if (cogsAmount) {
                            wip.createWIPAccrualRecord(wipId, project, config, revenueAmount, cogsAmount, projectedCogsAmount, false, periodObj, locationDeptClassObj);
                        }
                    }
                }
            }
            // } catch (e) {
            //     log.error('error generating wip accrual for project id: '+ projectId, e);
            // }
        }

        return {
            onAction : onAction
        };

    });
