/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime) => {

        const lineIDs = ['line', 'item', 'expense'];
        var sublistId = '';


        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            try{
                log.debug('scriptContext', scriptContext);
                let objRecord = scriptContext.newRecord;
                log.debug('objRecord', objRecord);
                let type = objRecord.type;//returns a string, need numeric for the search so using script parameters for it
                log.debug('type', type);
                const transactioType = runtime.getCurrentScript().getParameter({name: 'custscript_bb_ss_tran_type_mapping'});
                const recordType = runtime.getCurrentScript().getParameter({name: 'custscript_bb_ss_rec_type_mapping'});

                if (!transactioType && !recordType) {
                    log.error('Error', 'Both parameters are empty. Exit script');
                    return;
                }

                const objMappingRecords = getMappingRecords(transactioType, recordType);
                log.debug('objMappingRecords', objMappingRecords)
                if (!objMappingRecords) {
                    log.audit('Attention', 'No Mapping records for this record/transaction. Exit script');
                    return;
                }

                setGlobalSublistId(objRecord);

                var projectIdArray = [];
                if(objMappingRecords.projectFieldLevel === 'head') {
                    projectIdArray.push(objRecord.getValue(objMappingRecords.projectFieldId));
                }else{
                    //search lines to get the project
                    projectIdArray = getProjectsArrayFromLine(objRecord, objMappingRecords.projectFieldId);
                    // if(objMappingRecords.projectFieldId === 'cseg_bb_project') {
                    //     projectId = search.lookupFields({
                    //         type: 'customrecord_cseg_bb_project',
                    //         id: projectId,
                    //         columns: ['custrecord_seg_project']
                    //     }).custrecord_seg_project[0].value;
                    // }
                }
                log.debug('projectIdArray', projectIdArray);
                if (!projectIdArray) {
                    log.audit('Attention', 'projectIdArray is empty. Exit script');
                    return;
                }


                setDestinationRecordValues(objRecord, objMappingRecords, projectIdArray);
            }catch (e) {
                log.error('ERROR', e);
            }

        }


        const setGlobalSublistId = (objRecord) => {
            for(let i=0; i<lineIDs.length; i++){
                let numLines = objRecord.getLineCount(lineIDs[i]);
                if(numLines > 0){
                    sublistId = lineIDs[i];
                    break;
                }
            }
        }


        const getMappingRecords = (transactioType, recordType) => {
            var arrFilters = [
                ["isinactive","is","F"],
                "AND"
            ];
            if(!isEmpty(transactioType)){
                arrFilters.push(["custrecord_bbss_dcl_transaction_type","anyof",transactioType]);
            }else{
                arrFilters.push(["custrecord_bbss_dcl_record_type","anyof",recordType])
            }

            var objReturn = {
                'projectFieldId': '',
                'projectFieldLevel': '',
                'arrProjectFields': [],
                'objFieldsMapping': {},
                'destinationFieldLevel': ''
            }

            var customrecord_bbss_dcl_mappingSearchObj = search.create({
                type: "customrecord_bbss_dcl_mapping",
                filters: arrFilters,
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({name: "custrecord_bbss_dcl_record_type", label: "Record Type"}),
                        search.createColumn({name: "custrecord_bbss_dcl_transaction_type", label: "Transaction Type"}),
                        search.createColumn({name: "custrecord_bbss_dcl_proj_field_id", label: "Record field with Project id"}),
                        search.createColumn({name: "custrecord_bbss_dcl_field_from_proj", label: "Project field with DCL value"}),
                        search.createColumn({name: "custrecord_bbss_dcl_field_to_set", label: "Record field to set DCL value"}),
                        search.createColumn({name: "custrecord_bbss_dcl_field_level_to_get", label: "FIELD LEVEL TO GET"}),
                        search.createColumn({name: "custrecord_bbss_dcl_field_level_to_set", label: "FIELD LEVEL TO SET"})
                    ]
            });
            var searchResultCount = customrecord_bbss_dcl_mappingSearchObj.runPaged().count;
            log.debug("customrecord_bbss_dcl_mappingSearchObj result count",searchResultCount);
            customrecord_bbss_dcl_mappingSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                objReturn.projectFieldId = result.getValue('custrecord_bbss_dcl_proj_field_id');
                objReturn.projectFieldLevel = result.getText('custrecord_bbss_dcl_field_level_to_get');
                objReturn.arrProjectFields.push(result.getValue('custrecord_bbss_dcl_field_from_proj'));
                objReturn.objFieldsMapping[result.getValue('custrecord_bbss_dcl_field_from_proj')] = result.getValue('custrecord_bbss_dcl_field_to_set');
                objReturn.destinationFieldLevel = result.getText('custrecord_bbss_dcl_field_level_to_set');
                return true;
            });

            return objReturn;

        }

        const isEmpty = (stValue) => {
            return ((stValue === '' || stValue == null || false) || (stValue.constructor === Array && stValue.length === 0) || (stValue.constructor === Object && (function (v) {
                for (var k in v)
                    return false;
                return true;
            })(stValue)));
        };

        const getProjectsArrayFromLine = (objRecord, projectField) => {
            let projectsID = [];
            // for(let i=0; i<lineIDs.length; i++){
            //     let numLines = objRecord.getLineCount(lineIDs[i]);
            //     if(numLines > 0){
            //         for(let j=0; j<numLines; j++){
            //             let lineProject = objRecord.getSublistValue({
            //                 sublistId: lineIDs[i],
            //                 fieldId: projectField,
            //                 line: j
            //             });
            //             if(lineProject){
            //                 projectsID.push(lineProject);
            //             }
            //         }
            //     }
            // }
            for(let j=0; j<objRecord.getLineCount(sublistId); j++){
                let lineProject = objRecord.getSublistValue({
                    sublistId: sublistId,
                    fieldId: projectField,
                    line: j
                });
                if(lineProject){
                    projectsID.push(lineProject);
                }
            }
            return projectsID;
        }

        const setDestinationRecordValues = (objRecord, objMappingRecords, projectIdArray) => {
            const objFieldsMapping = objMappingRecords.objFieldsMapping;

            var jobSearchObj = search.create({
                type: "job",
                filters:
                    [
                        ["internalid","anyof",projectIdArray],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns: objMappingRecords.arrProjectFields
            });
            var searchResultCount = jobSearchObj.runPaged().count;
            log.debug("jobSearchObj result count",searchResultCount);
            log.debug("jobSearchObj",jobSearchObj);
            jobSearchObj.run().each(function(result){
                if(objMappingRecords.destinationFieldLevel === 'head') {
                    for (var key of Object.keys(objFieldsMapping)) {
                        objRecord.setValue(objFieldsMapping[key], result.getValue(key));
                    }
                }else{
                    for(let j=0; j<objRecord.getLineCount(sublistId); j++){
                        let lineProject = objRecord.getSublistValue({
                            sublistId: sublistId,
                            fieldId: objMappingRecords.projectFieldId,
                            line: j
                        });
                        if(lineProject === result.id) {
                            for (var key of Object.keys(objFieldsMapping)) {
                                objRecord.setSublistValue({
                                    sublistId: sublistId,
                                    fieldId: objFieldsMapping[key],
                                    line: j,
                                    value: result.getValue(key)
                                });
                            }
                        }
                    }
                }
                return true;
            });

        }


        return {beforeSubmit}

    });
