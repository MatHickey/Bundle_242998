/**
 *@NApiVersion 2.x
 *@author Ashley Wallace, Nick Weeks
 *@NScriptType MapReduceScript
 */
 
define(['N/record', 'N/search', 'N/runtime','./BB SS/SS Lib/BB.SS.MD.AlsoEnergy','./BB SS/SS Lib/moment.min', './BB SS/SS Lib/BB_SS_MD_SolarConfig'],
    function(record, search, runtime, alsoenergy, moment, solarConfigModule) {


    /**
     * @returns {array} - the list of projects that need meter readings
     */
    function _getProjects(){
        var projects = search.load({
            type:search.Type.JOB,
            id:'customsearch_bb_proj_energy_rate_type'
        });

        var projectIDs = [];
        
        projects.run().each(function(result){
            var projectID = result.id;
            projectIDs.push(projectID);
            return true;
        });

        return projectIDs;
    };


    
    /**
     * Adds meter reading data into an object with project and previous meter reading data.
     * To be used to create a new meter reading for the project
     * @param {object} meterReadings 
     * @param {object} projectFields
     * @returns {object} projectFields 
     */
    function _combineData(endMeterReadings, startMeterReadings){
        var meterData = {};
        for (meter in endMeterReadings){
            var meterId = endMeterReadings[meter].meterHID;
            //var startReadingEndDate = moment(endMeterReadings[meter].timeInterval).subtract(1,'month').format('LLL');
            var readingEndDate = moment(endMeterReadings[meter].timeInterval);
			log.debug('readingEndDate', readingEndDate);
            var year = readingEndDate.year();
            var nextMonth = readingEndDate.clone().add(1, 'month').month();
          	var nrDaysInMonth = new Date(year, nextMonth, 0).getDate();
          	var startReadingEndDate = readingEndDate.subtract(nrDaysInMonth, 'days').format('LLL');
            var startUniqueName =  meterId;// + ' - ' + startReadingEndDate;
            if(!startMeterReadings[startUniqueName])
            {
                startReadingEndDate = readingEndDate.subtract(1,'day').format('LLL');
                startUniqueName =  meterId + ' - ' + startReadingEndDate;
            }
            var startTimeZone = startMeterReadings[startUniqueName].timeZone;
            var endTimeZone = endMeterReadings[meter].timeZone;
            var startDateTime = moment(startMeterReadings[startUniqueName].timeInterval);
            startDateTime.zone(startTimeZone);
            var endDateTime = moment(endMeterReadings[meter].timeInterval);
            endDateTime.zone(endTimeZone);
            meterData[meterId] = {
                project: endMeterReadings[meter].project,
                meterNsId: endMeterReadings[meter].meterNsId,
                meterHID: endMeterReadings[meter].meterHID,
                periodStartDate: startDateTime.add(1,'day').format('M/D/YYYY'),
                periodEndDate: endDateTime.format('M/D/YYYY'),
                startingMeterReading: startMeterReadings[startUniqueName].float,
                endingMeterReading: endMeterReadings[meter].float
            };
            log.debug('meter ' + meterId, meterData[meterId]);
        }
        return meterData;
    }



    /**
     * Runs the soap call to get meter reading data from an array of projects
     * @param {string} startDate - a date in the form of a string
     * @param {string} endDate - a date in the form of a string
     * @param {array} projects - the list of projects that need meter readings
     * @returns {object} monthlyProdRec
     */
    function _getMonthlyProduction(startDate, endDate, projects) {
        var session = alsoenergy.login();
        var monthlyProdrec = alsoenergy.getBinDataByProject(session, startDate, endDate,
            'BinDay', 'KWHnet', 'Last', projects); 
        //alsoenergy.logout(session);
        return monthlyProdrec;
        
    };



    /**
     * Runs the soap call to get meter reading data for a single meter
     * @param {string} startDate - a date in the form of a string
     * @param {string} endDate - a date in the form of a string
     * @param {array} projects - the list of projects that need meter readings
     * @returns {object} monthlyProdRec
     */
    function _getProductionForMeter(startDate, endDate, meterId) {
        var session = alsoenergy.login();
        var monthlyProdrec = alsoenergy.getBinDataByMeter(session, startDate, endDate,
            'BinDay', 'KWHnet', 'Last', meterId); 
        //alsoenergy.logout(session);
        return monthlyProdrec;
    };



    /**
     * Creates a project energy meter reading record from an object
     * containing the necessary data
     * @param {object} projectData 
     */
    function createMeterReading(projectData) {
        
        //check for existing records
        if( existingMeterReading(projectData.periodEndDate, projectData.meterNsId) ){ 
            log.debug('Meter Reading Creation Error', 'A meter reading record for this end'
            + 'date and meter already exists. End Date: ' + projectData.periodEndDate + ', Meter ID: ' + projectData.meterNsId);
            return;
        }

        var meterReading = record.create({ //create new record
            type: 'customrecord_bb_proj_enrgy_meter_reading',
            isDynamic: true
        });

        //set values in new record
        meterReading.setValue({ fieldId: 'custrecord_bb_meter_reading_meter', value: projectData.meterNsId });
        meterReading.setValue({ fieldId: 'custrecord_bb_meter_reading_project', value: projectData.project });
        meterReading.setValue({ fieldId: 'custrecord_bb_meter_reading_start_date', value: new Date(projectData.periodStartDate) });
        meterReading.setValue({ fieldId: 'custrecord_bb_meter_reading_end_date', value: new Date(projectData.periodEndDate) });
        meterReading.setValue({ fieldId: 'custrecord_bb_meter_reading_start_readin', value: projectData.startingMeterReading });
        meterReading.setValue({ fieldId: 'custrecord_bb_meter_reading_end_reading', value: projectData.endingMeterReading });
        
        var meterID = meterReading.save(); //save the new record
        
        log.debug('Meter Reading created: ' + meterID);
    }



    /**
     * checks for an existing meter reading record for the meter and end date
     * @param {string} endDate - string representing the end date for the meter
     * @param {string} meterId - NS internal ID for the project meter 
     * @returns {integer} - the number of existing meter records
     */
    function existingMeterReading(endDate, meterId) {
        log.debug('endDate', endDate);
        log.debug('meterId', meterId);

        var templateLookup = search.create({
            type: 'customrecord_bb_proj_enrgy_meter_reading',
            columns: [
                { name: 'custrecord_bb_meter_reading_meter' },
                { name: 'custrecord_bb_meter_reading_end_date' }
            ],
            filters: [{
                name: 'custrecord_bb_meter_reading_meter',
                operator: 'is',
                values: [meterId]
            }, {
                name: 'custrecord_bb_meter_reading_end_date',
                operator: search.Operator.ONORAFTER,
                values: endDate
            }]
        }).run().getRange({ start: 0, end: 10 });
        return templateLookup.length;
    }



    /**
     * Gets the meter reading data for all available projects if there are no 
     * parameters. 
     * This should only be used during a scheduled run of the map/reduce. 
     * @returns {object} - key value pairs to send to the map function
     */
    function inputNoParameters(){
        var startDate = moment().subtract(1, 'days').format('M/D/YYYY'); //for soap call
        var endDate = moment().format('M/D/YYYY'); //for soap call
        var lastMonthStartDate = moment().subtract(1,'month').subtract(1,'day').format('M/D/YYYY');
        var lastMonthEndDate = moment().subtract(1,'month').format('M/D/YYYY');
        log.debug('Input w/out Parameters - Dates: ', 'Start Date: ' + startDate + ' End Date: ' + endDate 
                    + ' Last Month Start Date: ' + lastMonthStartDate + ' Last Month End Date: ' + lastMonthEndDate);

        var projectList = _getProjects(); //get list of projects that need meter readings

        var endMeterReadings = _getMonthlyProduction(startDate,endDate,projectList); //make the soap call to get meter readings
        var startMeterReadings = _getMonthlyProduction(lastMonthStartDate,lastMonthEndDate,projectList);
        var projectFields = _combineData(endMeterReadings, startMeterReadings); //combine the meter readings and project data
        return projectFields;
    }



    /**
     * Gets the meter reading data for one particular project energy meter record. 
     * This should only run when a button has been clicked on a project energy meter to 
     * create a meter reading record. The workflow action script should pass parameters 
     * into the script, and then run this getInput function. 
     * 
     * @returns {object} - key value pair to sent to the map function
     */
    function inputWithParameters(meterId, endDateRaw){
        var startDate = moment(endDateRaw).subtract(1,'days').format('M/D/YYYY');
        var endDate = moment(endDateRaw).format('M/D/YYYY');
        var lastMonthStartDate = moment(endDateRaw).subtract(1,'month').subtract(1,'day').format('M/D/YYYY');
        var lastMonthEndDate = moment(endDateRaw).subtract(1,'month').format('M/D/YYYY');
        log.debug('Input w/ Parameters - Dates: ', 'Start Date: ' + startDate + ' End Date: ' + endDate 
                    + ' Last Month Start Date: ' + lastMonthStartDate + ' Last Month End Date: ' + lastMonthEndDate);

        var endMeterReading = _getProductionForMeter(startDate,endDate,meterId);
        log.debug('Input w/ Parameters - End Meter Reading', JSON.stringify(endMeterReading));
        var startMeterReading = _getProductionForMeter(lastMonthStartDate,lastMonthEndDate,meterId);
        log.debug('Input w/ Parameters - Start Meter Reading', JSON.stringify(startMeterReading));
        
        var projectFields = _combineData(endMeterReading, startMeterReading);
        log.debug('Input w/ Parameters - Combined Readings', JSON.stringify(projectFields));

        return projectFields;
    }

    function getInputData() {
        var _isAlsoEnergyApiEnabled = solarConfigModule.getConfiguration('custrecord_bb_ss_alsoenergy_api_enabled');
        if(typeof _isAlsoEnergyApiEnabled === 'string'){
            _isAlsoEnergyApiEnabled = _isAlsoEnergyApiEnabled === 'T';
        } else if(typeof _isAlsoEnergyApiEnabled === 'boolean'){
            _isAlsoEnergyApiEnabled = false;
        }

        if(!_isAlsoEnergyApiEnabled){
            return undefined;
        }

        try{
            var script = runtime.getCurrentScript();
            var meterId = script.getParameter({name: 'custscript_bb_meter_id'});
            var endDate = script.getParameter({name: 'custscript_bb_end_date'});
            log.debug('Parameters', 'Meter Id: ' + meterId + ' End Date: ' + endDate);

            if(!meterId || !endDate){
                log.debug('Getting input with no parameters', '' );
                return inputNoParameters();//send key/object pairs to map
            }                
            else{
                log.debug('Getting input with parameters', '' );
                return inputWithParameters(meterId, endDate);//send key/object pairs to map
            }    
               

        } catch(error){
            log.debug('getInputData Error',error);
        }
    }



    //runs for each search result
    function map(context) {
        var _isAlsoEnergyApiEnabled = solarConfigModule.getConfiguration('custrecord_bb_ss_alsoenergy_api_enabled');
        if(typeof _isAlsoEnergyApiEnabled === 'string'){
            _isAlsoEnergyApiEnabled = _isAlsoEnergyApiEnabled === 'T';
        } else if(typeof _isAlsoEnergyApiEnabled === 'boolean'){
            _isAlsoEnergyApiEnabled = false;
        }

        if(!_isAlsoEnergyApiEnabled){
            return undefined;
        }
        log.debug('map context', context);
        log.debug('map context.value', context.value);
        var projectData = JSON.parse(context.value);
        
        try{
            createMeterReading(projectData); 
        } catch(error){
            log.debug('Map Error',error);
        }
    };

    

     
    function reduce(context) {   

        //add tasks for recId from map function  
    }
     

     
    function summarize(context) {
        //summarize results at the end
    }
      

     
    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});