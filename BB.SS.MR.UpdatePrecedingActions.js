/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(
  [
    'N/search',
    'N/record'
  ],
  (
    nSearch,
    nRecord
  ) => {

    let DOCSTATUS;

    const getAllResults = (s) => {
      let results = s.run();
      let searchResults = [];
      let searchid = 0;
      let resultsSlice = [];
      do {
        resultsSlice = results.getRange({start:searchid,end:searchid+1000});
        resultsSlice.forEach((slice) => {
          searchResults.push(slice);
          searchid++;
        });
      } while (resultsSlice.length >= 1000);

      return searchResults;
    }   
  
    const getInputData = () => {
      let config = nRecord.load({
        type: 'customrecord_bb_solar_success_configurtn',
        id: 1
      });

      let configStatus = config.getValue({fieldId: 'custrecord_bb_config_preceding_status_ty'});
      let searchId = config.getValue({fieldId: 'custrecord_bb_updt_preceding_action_srch'});

      if (configStatus && searchId) {
        let search = nSearch.load({
          id: searchId
        });

        let columns = search.columns;

        let results = getAllResults(search).map((res) => {
          return {
            id: res.getValue(columns[0]),
            preceding: res.getValue(columns[1]) || 0,
            completed: res.getValue(columns[2]) || 0,
            package: res.getValue(columns[3])
          }
        }).filter((res) => {
          return (res.preceding && res.completed) && (res.preceding == res.completed)
        });

        return results;
      }
      return;
    }
  
    const map = (context) => {
      let val = JSON.parse(context.value);
  
      let id = val.id;
      let package = val.package;

      if (!DOCSTATUS) {
        let config = nRecord.load({
          type: 'customrecord_bb_solar_success_configurtn',
          id: 1
        });
  
        DOCSTATUS = config.getValue({fieldId: 'custrecord_bb_config_preceding_status_ty'});
      }

      let status = getDocumentStatusByPackage(package, DOCSTATUS);

      if (package && status) {
        nRecord.submitFields({
          type: 'customrecord_bb_project_action',
          id: id,
          values: {
            'custrecord_bb_document_status': status,
            'custrecord_bb_document_status_date': new Date()
          },
          options: {
            ignoreMandatoryFields: true
          }
        });
      }

      log.debug('val', val);
/*
      let id = val.values['GROUP(internalid)']; 
      let totalCompPreceding = val.getValue({name: 'formulanumeric', summary: 'SUM'});
      let totalPreceding = val.getValue(result.columns[1]);
      let package = val.getValue({name: 'custrecord_bb_package', summary: 'GROUP'});

      log.debug('internalId', id);
      log.debug('package', package);
      log.debug('totalPreceding', totalPreceding);
      log.debug('totalCompPreceding', totalCompPreceding);

      let docStatus = getDocumentStatusByPackage(package, configStatus);
      log.debug('docstatus', docStatus);

      if (id && package && totalPreceding == totalCompPreceding) {
        log.debug('record submitting ', id);
        nRecord.submitFields({
          type: 'customrecord_bb_project_action',
          id: id,
          values: {
            'custrecord_bb_document_status': docStatus,
            'custrecord_bb_document_status_date': new Date()
          },
          options: {
            ignoreMandatoryFields: true
          }
        });
        log.debug('record successfully updated ', internalId);
      }*/
    }

    const getDocumentStatusByPackage = (package, configStatus) => {
      let docStatusId;

      if (package && configStatus) {
        let search = nSearch.create({
          type: "customrecord_bb_document_status",
          filters:
            [
              ["custrecord_bb_doc_status_package", "anyof", package],
              "AND",
              ["custrecord_bb_doc_status_type", "anyof", configStatus],
              "AND",
              ["isinactive", "is", "F"]
            ],
          columns:
            [
              nSearch.createColumn({name: "internalid", label: "Internal ID"}),
              nSearch.createColumn({
                name: "custrecord_bb_doc_status_seq",
                sort: nSearch.Sort.ASC,
                label: "Sequence"
              }),
              nSearch.createColumn({name: "custrecord_bb_doc_status_package", label: "Action Group"}),
              nSearch.createColumn({name: "custrecord_bb_doc_status_type", label: "Status Type"})
            ]
        });

        let resultSet = search.run().getRange({start: 0, end: 1});

        if (resultSet.length > 0) {
          docStatusId = resultSet[0].getValue({name: 'internalid'});
        }
      }

      return docStatusId;
    }
  
    const summarize = (summary) => {
      //if (runtime.envType != runtime.EnvType.PRODUCTION) 
          //return;
  
      // ErrorHandling.initialize(summary);
  
      if (summary.inputSummary.error) {
        log.debug('Input Error: ', summary.inputSummary.error);
      }
  
      summary.mapSummary.errors.iterator().each(function (key, error)
      {
        log.debug('error', error);
  
        return true;
      });
  
      summary.output.iterator().each(function (key, value)
      {
        return true;
      });
  
      log.debug('SCRIPT END', '------------------------------');
    }
  
    return {
      getInputData: getInputData,
      map: map,
      summarize: summarize
    }
  });