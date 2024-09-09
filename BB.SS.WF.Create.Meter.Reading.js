/**
 *@NApiVersion 2.x
 *@NScriptType WorkflowActionScript
 */
define(['N/record','N/search','./BB SS/SS Lib/moment.min','./BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing','N/task', './BB SS/SS Lib/BB_SS_MD_SolarConfig'],
    function(record, search, moment, batchProcessing, task, solarConfigModule) {
        
        function getEndDate(day){
            log.debug('Invoice Day',day);
            var currentDay = moment().format('D');
            var month, year;
          	log.debug('Current year', moment().format('YYYY'));
            if (currentDay >= day){
                year = moment().format('YYYY');
                month = moment().format('M');
                return new Date(month + '/' + day + '/' + year);
            } else {
                year = moment().subtract(1,'month').format('YYYY');
                month = moment().subtract(1,'montn').format('M');
                return new Date(month + '/' + day + '/' + year);
            }
        }
        function createMeterReading(context){
            var _isAlsoEnergyApiEnabled = solarConfigModule.getConfiguration('custrecord_bb_ss_alsoenergy_api_enabled');
            if(typeof _isAlsoEnergyApiEnabled === 'string'){
                _isAlsoEnergyApiEnabled = _isAlsoEnergyApiEnabled === 'T';
            } else if(typeof _isAlsoEnergyApiEnabled === 'boolean'){
                _isAlsoEnergyApiEnabled = false;
            }

            if(!_isAlsoEnergyApiEnabled){
                return;
            }
            var curRec = context.newRecord;
            var projId = curRec.getValue({fieldId:'custrecord_bb_proj_en_meter_project'});
            log.debug('Project ID',projId + typeof(projId));
            var invoiceDay = search.lookupFields({
                type: search.Type.JOB,
                id: projId,
                columns: 'custentity_bb_ss_invoice_day'
            });
            var endDate = getEndDate(invoiceDay.custentity_bb_ss_invoice_day);
            //schedule the script
            var params = {custscript_bb_end_date:endDate, custscript_bb_meter_id:curRec.id};
            log.debug('Parameters for MapReduce',JSON.stringify(params));
            batchProcessing.addToQueue('customscript_bb_ss_meter_reading','customdeploy_bb_ss_meter_reading', params, task.TaskType.MAP_REDUCE);
        }


        return {
            onAction: createMeterReading
        }
    }
);