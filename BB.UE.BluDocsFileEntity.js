/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/query', 'N/record'], function(query, record) {

    function beforeLoad(context) {
        
    }

    function beforeSubmit(context) {
        
    }

    function afterSubmit(context) {
        var rec = context.newRecord;
        var recid = rec.id;
        log.debug('context type', {context:context.type, recid: recid});
        if (context.type == 'delete'){
            return;
        };
        //checking to see if utility bill doc is missing entity
        var utilitybilldoc = rec.getValue('custentity_bb_util_bill_doc_bb_file_sys');
        log.debug('utility bill doc', utilitybilldoc);
      if(!utilitybilldoc) return;
        var sql = `select id, custrecord_bludocs_record FROM customrecord_bb_file WHERE id = ? AND custrecord_bludocs_record is NULL`;
        var results = query.runSuiteQL({ query: sql, params: [utilitybilldoc] });
        results = results.asMappedResults();
        if (results == 0){
            return;
        }
        log.debug('results', results);
        var bludocid = results[0].id;
        log.debug('blu docs id', bludocid);
        if (results.length == 1 && bludocid){
            var submit = record.submitFields({
                type: 'customrecord_bb_file',
                id: bludocid,
                values: {
                    'custrecord_bludocs_record': recid
                }               
            });
            log.debug('submit', submit);
        }
    };

    return {
        //beforeLoad: beforeLoad,
       // beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    }
});
