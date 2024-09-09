/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime'
  ],
  function (recordModule, searchModule, runtimeModule
  ) {


    function getInputData() {
      var
        _currentScript = runtimeModule.getCurrentScript()
        , _projectId = _currentScript.getParameter({name: 'custscript_bb_pp_project'})
        , _paSearch = searchModule.load({ id: 'customsearch_bb_proj_act_expect_days' })
        , _patsSearch = searchModule.load({ id: 'customsearch_bb_pats_pause' })
        , _process = []
      ;
      log.debug('project', _projectId);

      _paSearch.filters.push(searchModule.createFilter({
        name:'custrecord_bb_project',
        operator: 'anyof',
        values: _projectId
      }));

      _patsSearch.filters.push(searchModule.createFilter({
        name:'custrecord_bb_pats_project',
        operator: 'anyof',
        values: _projectId
      }));

      _patsSearch.run().each(function(row){
        _process.push({
          recordType: _patsSearch.searchType
          , id: row.id
          , fields: {
            'custrecord_bb_pats_commit_srt_day_num' : row.getValue('custrecord_bb_pats_commit_srt_day_num')
          , 'custrecord_bb_pats_delivery_fm_start_ct' : row.getValue('custrecord_bb_pats_delivery_fm_start_ct')
          }
        });
        return true;
      });

      _paSearch.run().each(function(row){
        _process.push({
          recordType: _paSearch.searchType
          , id: row.id
          , fields: {
            'custrecord_exp_duration_busn_day_count' : row.getValue('custrecord_exp_duration_busn_day_count')
          }
        });
        return true;
      });
      return _process;
    }

    function map(context) {
      var
        _currentScript = runtimeModule.getCurrentScript()
        , _data = JSON.parse(context.value)
        , _days = Number(_currentScript.getParameter({name: 'custscript_bb_pp_days'}))
        // , _count = Number(_data.values.custrecord_exp_duration_busn_day_count)
        , _record
      	, _startTime
      	, _loadTime
      	, _saveTime
      ;

      if(!isNaN(_days)) {
        //_count = _count + _days;

        _startTime = new Date();
        _record = recordModule.load({type: _data.recordType, id: _data.id});
		_loadTime = (new Date()) - _startTime;
        for(var key in _data.fields){
          if(_data.fields.hasOwnProperty(key)){
            var _count = Number(_data.fields[key]);
            if(isNaN(_count)){
              _count = 0;
            }
            _count = _count + _days;
            _record.setValue({fieldId: key, value: _count});
          }
        }

        //_record.setValue({fieldId: 'custrecord_exp_duration_busn_day_count', value: _count});
		_startTime = new Date();
        _record.save({ignoreMandatoryFields: true});
        _saveTime = (new Date()) - _startTime;
        log.debug([_data.recordType, _data.id].join(' '), ['load: ',_loadTime, ', ', 'save: ', _saveTime].join(''));
      }
    }


    return {
      getInputData: getInputData,
      map: map,
      //reduce: reduce,
      //summarize: summarize
    }
  });
