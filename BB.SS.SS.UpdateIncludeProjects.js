/**
* This is a one time scheduled script to populate the 'included projects' field on project statistics custom records
* @NApiVersion 2.x
* @NScriptType ScheduledScript
* @NModuleScope Public
*/
define(['N/record', 'N/runtime', 'N/search'], 
function(record, runtime, search) {
    var PROJ_STAT_SEARCH_ID = 'customsearch_bb_cashflow_projection_st_2';
    var PROJ_STAT_RECORDS_SEARCH_ID = 'customsearch_bb_cashflow_projection';
    var PROJ_STAT_RECORD_ID = 'customrecord_bb_project_statistics';
    var PROJ_STAT_SEARCH_FIELDS;
    var FINANCING_TYPE = {1:'Cash', 2:'Loan', 3:'TPO (lease, PPA)'};
    

    function execute(context) {
        var projStatSearch = search.load({
			id: PROJ_STAT_RECORDS_SEARCH_ID
        })

        PROJ_STAT_SEARCH_FIELDS = getSearchColumnNames(projStatSearch);
               
        projStatSearch.run().each(function(result) {
			record.load({
				type: PROJ_STAT_RECORD_ID,
				id: result.getValue(result.columns[0])
			}).setValue({
              fieldId: 'custrecord_bb_included_projects',
              value: getProjectIds(result),
              ignoreFieldChange: true
            }).save({
              enableSourcing: true,
              ignoreMandatoryFields: true
            });
            return true;
		});
			
	};
    
    
    /**
     * takes a search result that will become the project statistic record, and returns a list of project IDs to be included
     * in the included projects field. 
     * @param {result} projectStatResult - search result that will become the project statistic record
     * @returns {array} projIdList - array of project internal ID's to be included in the
     * included projects field 
     */
    function getProjectIds(projectStatResult) 
    {
      var projIdList = []; 
      
      var idSearch = search.create({
        type: record.Type.JOB,
        columns:['internalId'],
        filters: addFilterExpression(projectStatResult),
      });
      idSearch.run().each(function(result){
        projIdList.push(result.getValue(result.columns[0]));
		return true;
      });

      var str =  projIdList.join(",");
      log.debug({
          Title: 'Array Test',
          details: str
      });
      var arr1 = str.split(",");

      return arr1;
    }



    /**
     * Returns a date object for the current date
     * @returns {date} - today's date. 
     */
    function DateNow() { return new Date(); }
    


    function addFilterExpression(statResult)
    {
      var filterExpression = [ 
                   ['custentity_bb_project_start_date', 'onorbefore', addFilterValue(statResult.getValue(statResult.columns[PROJ_STAT_SEARCH_FIELDS['date']])) ], 
            'AND', ['jobtype', 'anyof', addFilterValue(statResult.getValue(statResult.columns[PROJ_STAT_SEARCH_FIELDS['project type']])) ],
            'AND', ['custentity_bb_financing_type', 'anyof', addFilterValue(statResult.getValue(statResult.columns[PROJ_STAT_SEARCH_FIELDS['financing type']])) ],
            'AND', ['custentity_bb_install_state', 'anyof', addFilterValue(statResult.getValue(statResult.columns[PROJ_STAT_SEARCH_FIELDS['installation state']])) ] 
        ];

      return filterExpression;
    }


    function addFilterValue(fieldValue) {return fieldValue ? fieldValue : '@NONE@'; }



    /**
     * turns saved search into a literal so columns can be referenced by label
     * @param {search} projSearch 
    */
    function getSearchColumnNames(projSearch) {
        return projSearch.columns.reduce(function(map, current, index) {
          var label = current.label.toLowerCase();
          map[label] = index;
          return map;
        }, {});
    }


    return{
        execute: execute
    }
    
});