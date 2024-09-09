/**
 *@NApiVersion 2.x
 *@author
 *@NScriptType MapReduceScript
 */
 
define(['N/record', 'N/search', 'N/format', './BB SS/SS Lib/BB.SS.MD.AlsoEnergy', './BB SS/SS Lib/moment.min', './BB SS/SS Lib/BB_SS_MD_SolarConfig'],
    function(record, search, format, alsoenergy, moment, solarConfigModule) {
    var FIELD_NAME = 'KWHnet',
        FUNCTION_NAME = 'Diff',
        INTERVAL = 'Bin15Min';

    function getExistingRecordIds(dataSource, timeInterval, bin){
        var _foundIds = undefined;

        var _currentDate = format.format({value: new Date(moment().subtract(1, 'days').format('M/D/YYYY')), type: format.Type.DATE});
        var _timeInterval = format.format({value: new Date(bin.timeInterval), type: format.Type.TIMEOFDAY});
        var _search = search.create({
            type: 'customrecord_bb_proj_energy_production',
            filters: [
                ['custrecord_bb_proj_en_prdct_project', search.Operator.ANYOF, [bin.project]],
                'AND',
                ['custrecord_bb_proj_en_prdct_meter', search.Operator.ANYOF, [bin.meterNsId]],
                'AND',
                ['custrecord_bb_proj_en_prdct_data_source', search.Operator.ANYOF, [dataSource]],
                'AND',
                ['custrecord_bb_proj_en_prdct_tim_intrvl', search.Operator.ANYOF, [timeInterval]],
                'AND',
                ['custrecord_bb_proj_en_prdct_date', search.Operator.ON, _currentDate],
                'AND',
                ['custrecord_bb_proj_en_prdct_start_time', search.Operator.EQUALTO, _timeInterval]
            ]
        });

        _search.run().each(function(row){
            if(typeof _foundIds === 'undefined'){
                _foundIds = [];
            }
            _foundIds.push(row.id);
            return true;
        });

        return _foundIds;
    }

    function updateExistingRecord(id, bin){
        record.submitFields({
            type: 'customrecord_bb_proj_energy_production',
            id: id,
            values: {
                'custrecord_bb_proj_en_prdct_kwrs' : bin.float
            }
        });

        log.debug('Project Energy Production Record Updated', 'id: ' + id);
    }

    function createNewRecord(name, dataSource, timeInterval, bin){
        var prod_energy_record = record.create({
            type: 'customrecord_bb_proj_energy_production',
            isDynamic: true
        });

        prod_energy_record.setValue({fieldId: 'name', value: name});
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_tim_intrvl', value: timeInterval});
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_kwrs', value: bin.float});
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_project', value: bin.project});
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_meter', value: bin.meterNsId});
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_start_time', value: new Date(bin.timeInterval) });
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_date', value: new Date(moment().subtract(1, 'days').format('M/D/YYYY'))});
        prod_energy_record.setValue({fieldId: 'custrecord_bb_proj_en_prdct_data_source', value: dataSource});

        var recId = prod_energy_record.save();

        log.debug('Project Energy Production Record Created', 'id: ' + recId);
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
        var session = alsoenergy.login();
        log.debug('login', session); 

        if(session.error){
            var errorCodes = alsoenergy.getErrorCodes();
            log.error({title:'Login Error', details:'Error Code: ' 
                    + session.error + ', ' + errorCodes[session.error] });
            throw 'Login Error, error code ' + session.error + ', ' + errorCodes[session.error];
        }
        
        var currDate = moment().format('M/D/YYYY');
        var prevDate = moment().subtract(1, 'days').format('M/D/YYYY'); 

        var bins = alsoenergy.getAllBinData(session, prevDate, currDate, INTERVAL, FIELD_NAME, FUNCTION_NAME );

        return bins;
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
        try {
            log.debug('raw context', context); 
            var bin = JSON.parse(context.value); //get values from getInputData
            log.debug('map context.value', bin); 
    
            var dataSource = alsoenergy.getListObject('customlist_bb_production_energy_source')['alsoenergy'];
            log.debug('dataSource list value', dataSource); 
            var timeInterval = alsoenergy.getListObject('customrecord_bb_time_interval')['15 minutes'];
            log.debug('timeInterval list value', timeInterval); 

            var _foundIds = getExistingRecordIds(dataSource, timeInterval, bin);

            if(_foundIds instanceof Array && _foundIds.length > 0){
                _foundIds.forEach(function(id){
                    updateExistingRecord(id, bin);
                });
            } else {
                createNewRecord(context.key, dataSource, timeInterval, bin);
            }

        } catch(error){
            log.debug('Create Record Error', error); 
        }
        
    }
                         
    function reduce(context) { }

    function summarize(context) {
        //log.debug('Logout', alsoenergy.logout(SESSION.id));
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});