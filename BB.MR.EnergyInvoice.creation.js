/**
 *@NApiVersion 2.x
 *@author
 *@NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/plugin','./BB SS/SS Lib/moment.min'],
    function (record, search, plugin, moment) {

        /**
         * Function load the correct plugin for invoice generation based on the project invoicing strategy
         * @param String : invoiceType - type of invoicing strategy
         * @returns Object - An Object implementing the custom plug-in type.
         */
        function _getPlugin(invoiceType) {
            switch (invoiceType) {
                case 'per kwh':
                    return plugin.loadImplementation({
                        type: 'customscript_bb_ss_auto_inv_plgn_typ',
                        implementation: 'customscript_bb_invoice_perkwh'
                    });
                case 'flat fee':
                    return plugin.loadImplementation({
                        type: 'customscript_bb_ss_auto_inv_plgn_typ',
                        implementation: 'customscript_bb_invoice_flat_fee'
                    });
            };
        };

        /**
         *Function Searches the projects which has today as thier invoice date and searches all their energy production record for invoicing
         * @returns Object : projectData - Object with project energy data
         */
        function _getProjectData() {
            var config = search.lookupFields({
                type: 'customrecord_bb_solar_success_configurtn',
                id: '1',
                columns: ['custrecord_bb_energy_production_item', 'custrecord_bb_prj_search_for_invoice']
            });
            log.debug('config',config);
            var projectData = {};
            var projSearch = search.load({
                type: search.Type.JOB,
                id: config.custrecord_bb_prj_search_for_invoice[0].value
            });
            var cols = getSearchColumnNames(projSearch);
            log.debug('cols', cols);
            projSearch.run().each(function (result) {
                var projId = result.getValue(result.columns[cols['internal id']]);
                log.debug('projId', projId);
                if (!projectData[projId]) {
                    projectData[projId] = {
                        project: projId,
                        rateType: result.getValue(result.columns[cols['energy rate type']]),
                        customer: null,
                        subsidiary: result.getValue(result.columns[cols['subsidiary']]),
                        periodStartDate: result.getValue(result.columns[cols['start date']]),
                        periodEndDate: moment().format('M/D/YYYY'),
                        lines: {}
                    };
                }

                var detailInternalid = result.getValue(result.columns[cols['detailinternalid']]);
                var customrecord_bb_proj_energy_productionSearchObj = search.create({
                    type: "customrecord_bb_proj_energy_production",
                    filters:
                        [
                            ["internalid", "anyof", detailInternalid]
                        ],
                    columns:
                        [

                            search.createColumn({
                                name: "custrecord_bb_prj_en_prd_dtl_en_prdcd",
                                join: "CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD",
                                label: "Energy Produced(Units)"
                            }),
                            search.createColumn({
                                name: "internalid",
                                join: "CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD",
                                label: "Internal ID"
                            }),
                            search.createColumn({
                                name: "custrecord_bb_pr_en_prd_det_date",
                                join: "CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD",
                                label: "Date"
                            }),
                            search.createColumn({
                                name: "custrecord_bb_en_prod_dtl_time",
                                join: "CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD",
                                label: "Time"
                            })
                        ]
                });
                var energyProdDetails = [];
                var searchResultCount = customrecord_bb_proj_energy_productionSearchObj.runPaged().count;
                log.debug("customrecord_bb_proj_energy_productionSearchObj result count", searchResultCount);
                customrecord_bb_proj_energy_productionSearchObj.run().each(function (result) {
                    var energyProdDet = {};
                    energyProdDet.id = result.getValue({
                        name: 'internalid',
                        join: 'CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD'
                    });

                    energyProdDet.Date = result.getValue({
                        name: 'custrecord_bb_pr_en_prd_det_date',
                        join: 'CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD'
                    });
                    energyProdDet.energyproduced = parseFloat(result.getValue({
                        name: 'custrecord_bb_prj_en_prd_dtl_en_prdcd',
                        join: 'CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD'
                    })).toFixed(2);
                    energyProdDet.Time = result.getValue({
                        name: 'custrecord_bb_en_prod_dtl_time',
                        join: 'CUSTRECORD_BB_PR_EN_PRD_DET_PRJENPROD'
                    });
                    energyProdDetails.push(energyProdDet);
                    return true;
                });

                var energyProdId = result.getValue(result.columns[cols['detailinternalid']]);
                if (!projectData[projId])
                    return true;

                projectData[projId].lines[energyProdId] = {
                    itemId: config.custrecord_bb_energy_production_item[0].value,
                    energyProduced: parseFloat(result.getValue(result.columns[cols['energy produced']])).toFixed(2),
                    startDate: result.getValue(result.columns[cols['start date']]),
                    endDate: result.getValue(result.columns[cols['end date']]),
                    quantity: null,
                    rate: null,
                    unit:result.getValue(result.columns[cols['unit of measure']]),//stays null until map
                    site:result.getValue(result.columns[cols['project energy site id']]),
                    energyProdDetails: energyProdDetails

                };
                return true;
            });
            log.debug('projectData', projectData);
            return projectData;
        }

        /**
         * Function gets the energy rate type
         * @param {string} list the NS ID of the list 
         * @returns {Object} list
         */
        function getEnergyRateTypes(list) {
            return search.create({
                type: list,
                columns: ['name']
            }).run().getRange({
                start: 0,
                end: 1000
            }).reduce(function (map, current) {
                var itemName = current.id;
                map[itemName] = current.getValue({ name: 'name' }).toLowerCase();
                return map;
            }, {});
        };

        /**
         * Gets the input data for map reduce script to work on
         * @returns Array : projectFields - project data to be processed for invoice
         */
        function getInputData() {
            var projectFields = _getProjectData();
            return projectFields; //send key/object paits to map
        }

        /**
         * Function runs for each project and creates invoice for them
         * @param context
         */
        function map(context) {
            var projectData = JSON.parse(context.value);

            try {
                var rateTypes = getEnergyRateTypes('customlist_bb_proj_en_rate_engy_rt_typ');
                var projPlugin = _getPlugin(rateTypes[projectData.rateType]);
              log.debug('projPlugin',projPlugin);

                //add rate to each line of the project
                var ratesDetails = projPlugin.getRates(projectData.periodEndDate, projectData.project);
               
                projectData.schedulePartitions=ratesDetails.schedulePartitions;
                projectData.rateType=ratesDetails.rateType;
                projectData.customer = projPlugin.getOfftaker(projectData.project); //get customer

                projPlugin.createInvoice(projectData);
            } catch (error) {
                log.debug('Map Error', error);
            }
        };

        /**
         * Function creates object with the column names of the loaded search
         * @param projSearch
         * @returns {{}}
         */
        function getSearchColumnNames(projSearch) {
            return projSearch.columns.reduce(function(map, current, index) {
                var label = current.label.toLowerCase();
                map[label] = index;
                return map;
            }, {});
        }

        /**
         * Function summarizes the Input and map steps
         * @param context
         */
        function summarize(context) {
            //summarize results at the end
        }
      return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });