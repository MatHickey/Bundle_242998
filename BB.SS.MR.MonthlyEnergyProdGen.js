/**
 *@NApiVersion 2.1
 *@author
 *@NScriptType MapReduceScript
 *@author Suhail Akhtar
 */

define(['N/record', 'N/search', 'N/plugin', './BB SS/SS Lib/BB.SS.MD.SolarEdgeApiIIntegration.js',
        './BB SS/SS Lib/BB.MD.EnergyProductionCreation.js', 'N/format', './BB SS/SS Lib/moment.min', './BB SS/SS Lib/BB.SS.MD.AlsoEnergyPowerTrackApiIntegration.js', './BB SS/SS Lib/BB.SS.MD.PowerFactorsApiIntegration.js', 'N/runtime'],
    function (record, search, plugin, solarEdge, energyProdMod, format, moment, alsoEnergy, powerfactor, runtime) {
        var ALSOENERGY = 1; //to be used once also energy is configured
        var SOLAREDGE = 2;
        var POWERFACTOR = 4;
        var MIDNIGHT_TIME = ' 00:00:00';
        var CONFIG_REC_ID = '1'


        /**
         * Function gets all the project that has site/energy source filled in and process then for energy production record creation
         * @returns Array: projectList- List of projects to process
         */
        function getInputData() {
            var startDate = runtime.getCurrentScript().getParameter({
                name: 'custscript_energy_prod_start_date'
            });
            var endDate = runtime.getCurrentScript().getParameter({
                name: 'custscript_energy_prod_end_date'
            });
            var projects = runtime.getCurrentScript().getParameter({
                name: 'custscript_energy_prod_projects'
            });
            var energySource = runtime.getCurrentScript().getParameter({
                name: 'custscript_energy_source'
            });

            var energySuitelet = runtime.getCurrentScript().getParameter({
                name: 'custscript_bb_from_cons_energy_suitelet'
            });
            var energyNeededConsolidatedArray = runtime.getCurrentScript().getParameter({
                name: 'custscript_bb_consolidated_array'
            });
            var projectList;
            if(energySuitelet){
                projectList=JSON.parse(energyNeededConsolidatedArray)
            }else{
                if (startDate && endDate && projects && energySource) {
                    log.debug('insdie manual')
                     projectList = getProjectsFromManualProcess(startDate, endDate, projects, energySource);
                } else {
                    log.debug('insdie automatic')
                     projectList = _getProjects();
                    log.debug('projectList', projectList);
                }
            }

            return projectList; //send key/object paits to map
            // return [];
        }

        /**
         * Function call API modules and Energy production creation Modules to get the energy produced data and create respective records
         * @param context
         */
        function reduce(context) {
            var projectData = JSON.parse(context.values[0]);
            log.debug('projectData',projectData)


            var time = getStartAndEndDateTime(projectData.startDate, projectData.endDate);

            log.debug('time', time);
            log.debug('projectData', projectData);

            if (projectData.energySource == SOLAREDGE) {
                var powerDetails = solarEdge.getPowerDetails(projectData.id, projectData.site, time.startTime, time.endTime);
                powerDetails.energySource = projectData.energySource;
                log.debug('powerDetails before creation call for SOLAREDGE', powerDetails);
                energyProdMod.createEnergyProduction(powerDetails);
            } else if (projectData.energySource == ALSOENERGY) {
                var hardwareIdArr= getProjectProductionMeter(projectData.id);
                log.debug('hardwareIdArr',hardwareIdArr)
                alsoEnergy.login();
                for(var index in hardwareIdArr){
                    log.debug('hardwareId in hardwareIdArr',hardwareIdArr[index])
                    var powerDetails = alsoEnergy.getPowerDetails(projectData.id, projectData.site,hardwareIdArr[index], time.startTime, time.endTime);
                    powerDetails.energySource = projectData.energySource;
                    log.debug('powerDetails before creation call for ALSOENERGY', powerDetails);
                    energyProdMod.createEnergyProduction(powerDetails);
                }

            } else if (projectData.energySource == POWERFACTOR) {
                var powerDetails = powerfactor.getPowerDetails(projectData.id, projectData.site, time.startTime, time.endTime);
                powerDetails.energySource = projectData.energySource;
                log.debug('powerDetails before creation call for ALSOENERGY', powerDetails);
                energyProdMod.createEnergyProduction(powerDetails);
            }

        }


        /**
         * Function summarizes the map reduce process
         * @param summary
         */
        function summarize(summary) {
            summary.reduceSummary.errors.iterator().each(function (key, error) {
                log.error("Reduce Error for key: " + key, error);
                return true;
            });
        }


        /**
         *Function gets all the projects that has site/energy source filled in.
         * @returns Array: projects - Project list
         */
        function _getProjects() {
            var configRec = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: CONFIG_REC_ID
            });
            var projects = [];
            if (configRec.getValue('custrecord_bb_ss_alsoenergy_intergration')) {
                projects = loadProjectSearchAndListProjs(configRec.getValue('custrecord_bb_alsoener_ener_prod_search'), projects);
            }
            if (configRec.getValue('custrecord_bb_ss_solaredge_integration')) {
                projects = loadProjectSearchAndListProjs(configRec.getValue('custrecord_bb_solredge_ener_prod_search'), projects);
            }
            if (configRec.getValue('custrecord_bb_ss_powerfactor_integration')) {
                projects = loadProjectSearchAndListProjs(configRec.getValue('custrecord_bb_powerfactor_prod_search'), projects);
            }

            return projects

        };

        /**
         * Function loads the search and adds project in project list
         * @param String: searchToLoad - search to be usef to find the projects to process
         * @param Array: projList - Array to push all the projects
         * @returns Array: projList - List of projects
         */
        function loadProjectSearchAndListProjs(searchToLoad, projList, manualProjects, isManual) {
            var searchResult = search.load({
                id: searchToLoad
            });
            log.debug('manualProjects',manualProjects);
            if (isManual) {
                log.debug('loadProjectSearchAndListProjs', 'manual')
                var manualprojectsfilter = ["AND", ["internalid", "anyof", manualProjects]];

                var projectsFilter = searchResult.filterExpression.concat(manualprojectsfilter);
                searchResult.filterExpression = projectsFilter;

            }
            var projList = [];
            searchResult.run().each(function (result) {
                var site;
                var projectSitesArray;
                var energySource = result.getValue('custentity_bb_energy_production_source');
                var projectList = [];
                if (energySource == ALSOENERGY) {
                    site = result.getValue('custentity_bb_ss_alsoenergy_site_id');
                    projectSitesArray = site.split(",");
                    projectList = createProjectRecForMultipleSitesWithOneProject(projectSitesArray, result.id, energySource);
                    projList = projList.concat(projectList);
                } else if (energySource == SOLAREDGE) {
                    site = result.getValue('custentity_bb_ss_solaredge_site_id');
                    projectSitesArray = site.split(",");
                    projectList = createProjectRecForMultipleSitesWithOneProject(projectSitesArray, result.id, energySource);
                    projList = projList.concat(projectList);
                } else if (energySource == POWERFACTOR) {
                    site = result.getValue('custentity_bb_ss_powerfactors_site_id');
                    projectSitesArray = site.split(",");
                    projectList = createProjectRecForMultipleSitesWithOneProject(projectSitesArray, result.id, energySource);
                    projList = projList.concat(projectList);
                }
                return true;
            });
            return projList;
        }

        /**
         * Function returns object with yesterdays date and todays days with time as midnight yesterday and today
         * @returns {{startTime: string, endTime: string}} - Date and time to get the energy details for
         */
        function getStartAndEndDateTime(manualstartDate, manualendDate) {
            var startdate;
            if (manualstartDate) {
                startdate = new Date(manualstartDate);
            } else {
                startdate = new Date();
                startdate.setDate(startdate.getDate() - 1);
            }

            // gets yesterdays date as script runs next day for today.
            var startTime = (startdate.getFullYear().toString() + '-' + (startdate.getMonth() + 1).toString() + '-' + startdate.getDate().toString() + MIDNIGHT_TIME);

            if (manualendDate) {
                nextDate = new Date(manualendDate)
            } else {
                nextDate = new Date();
            }
            var endTime = (nextDate.getFullYear().toString() + '-' + (nextDate.getMonth() + 1).toString() + '-' + nextDate.getDate().toString() + MIDNIGHT_TIME);

            return {
                startTime: startTime,
                endTime: endTime
            }
        }


        /**
         * Functions creates project records for all the sites present in a project
         * @param projectSitesArray
         * @param projectId
         * @param energySource
         * @returns {[]}
         */
        function createProjectRecForMultipleSitesWithOneProject(projectSitesArray, projectId, energySource) {
            var projectList = [];
            for (var siteNum = 0; siteNum < projectSitesArray.length; siteNum++) {
                var project = {};
                project.id = projectId;
                project.energySource = energySource;
                project.site = projectSitesArray[siteNum];
                projectList.push(project);
            }
            return projectList;
        }

        function getProjectsFromManualProcess(startDate, endDate, projects, energySource) {
            var startDateObj = new Date(startDate);
            var endDateObj = new Date(endDate);
            var projArray = projects.split(',')
            var projectsINTArray = [];
            for (var index = 0; index < projArray.length; index++) {
                projectsINTArray.push(parseInt(projArray[index]))
            }

            var oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds


            var numberOfDaysRequested = Math.round(Math.abs((startDateObj - endDateObj) / oneDay));

            //  var numberOfDaysRequested = endDateObj.getDate() - startDateObj.getDate();
            var projectsList = [];
            var configRec = record.load({
                type: 'customrecord_bb_solar_success_configurtn',
                id: CONFIG_REC_ID
            });
            if (energySource == ALSOENERGY && configRec.getValue('custrecord_bb_ss_alsoenergy_intergration')) {
                projects = loadProjectSearchAndListProjs(configRec.getValue('custrecord_bb_alsoener_ener_prod_search'), projectsList, projectsINTArray, true);
            }
            if (energySource == SOLAREDGE && configRec.getValue('custrecord_bb_ss_solaredge_integration')) {
                projects = loadProjectSearchAndListProjs(configRec.getValue('custrecord_bb_solredge_ener_prod_search'), projectsList, projectsINTArray, true);
            }
            if (energySource == POWERFACTOR && configRec.getValue('custrecord_bb_ss_powerfactor_integration')) {
                projects = loadProjectSearchAndListProjs(configRec.getValue('custrecord_bb_powerfactor_prod_search'), projectsList, projectsINTArray, true);
            }

            log.debug('projects in getProjectsFromManualProcess', projects)
            var finalProjects = []
            var startDatetemp = new Date(startDate);
            log.debug('startDatetemp', startDatetemp);

            for (var days = 1; days <= numberOfDaysRequested; days++) {

                for (var num = 0; num < projects.length; num++) {
                    var proj=Object.assign({},projects[num]);
                    proj.startDate = new Date(startDatetemp.getTime());
                    proj.endDate = new Date(startDatetemp.getFullYear(), startDatetemp.getMonth(), startDatetemp.getDate()+1);
                    proj.loop=days
                    finalProjects.push(proj);
                }
                startDatetemp.setDate(startDatetemp.getDate() + 1);
            }

            log.debug('finalProjects', finalProjects);
            return finalProjects;
        }

        function getProjectProductionMeter(projectId){
            var customrecord_bb_ss_proj_site_devicesSearchObj = search.create({
                type: "customrecord_bb_ss_proj_site_devices",
                filters:
                    [
                        ["custrecord_bb_ss_device_proj.internalid","anyof",projectId],
                        "AND",
                        ["custrecord_bb_ss_site_device_type","anyof","2"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "scriptid",
                            sort: search.Sort.ASC,
                            label: "Script ID"
                        }),
                        search.createColumn({name: "custrecord_bb_ss_device_id"})
                    ]
            });
            var searchResultCount = customrecord_bb_ss_proj_site_devicesSearchObj.runPaged().count;
            log.debug("customrecord_bb_ss_proj_site_devicesSearchObj result count",searchResultCount);
            var hardwareIdArr=[];
            customrecord_bb_ss_proj_site_devicesSearchObj.run().each(function(result){
                hardwareIdArr.push(result.getValue({
                    name:'custrecord_bb_ss_device_id'
                }));
                return true;
            });
            return hardwareIdArr;
        }

        return {
            getInputData: getInputData,
            reduce: reduce,
            summarize: summarize
        };
    });