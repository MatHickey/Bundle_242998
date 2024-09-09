/**
 *@NApiVersion 2.x
 *@NScriptType WorkflowActionScript
 *@NModuleScope Public
 *@author Matt Lehman
 *@overview - Generate PDF Document
 */

define(['N/render', 'N/file', 'N/email', 'N/runtime', 'N/record', 'N/search', './BB SS/SS Lib/BB.SS.MD.UploadNSFileToAWS'],
    function(render, file, email, runtime, record, search, awsModule) {

        function onAction(scriptContext) {
            try {
                var recordId = scriptContext.newRecord.id;
                var recordType = scriptContext.newRecord.type;
                
                log.debug('recordId', recordId);
                log.debug('recordType', recordType);

                //get path from config object
                var objectString = getCustomFolderPathFromConfig();
                log.debug('object string', objectString);
                var configObj = null;
                if (objectString) {
                    configObj = JSON.parse(objectString);
                }

                // text value of document name
                var documentName = runtime.getCurrentScript().getParameter({name: 'custscript_bb_print_pdf_doc_name'});
                // advanced pdf template id
                var advancedPDFTemplateId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_print_adv_pdf_temp_id'}); 

                var savedSearchId = runtime.getCurrentScript().getParameter({name: 'custscript_bb_adv_pdf_search_id'}); 

                //log.debug('advanced pdf template id', advancedPDFTemplateId);

                if (advancedPDFTemplateId && documentName && configObj) {
                    var pdfDocument = render.create();
                    if (savedSearchId) {
                        var savedSearch = search.load({
                            id: savedSearchId
                        });

                        var additionalFilters = ["AND", ["internalid","anyof", scriptContext.newRecord.id]];
                        log.debug('filters edit sublist', additionalFilters);
                        var newFilterExpression = savedSearch.filterExpression.concat(additionalFilters);
                        savedSearch.filterExpression = newFilterExpression;

                        // var results = savedSearch.run().getRange({start:0, end: 1});
                        // pdfDocument.addSearchResults({
                        //     templateName: 'results', 
                        //     searchResult: results
                        // });

                        var results = getJSONSearchResult(savedSearch);
                        log.debug('result json object', results);
                        pdfDocument.addCustomDataSource({
                            format: render.DataSource.OBJECT,
                            alias: 'result',
                            data: results
                        });
                    } else {
                        pdfDocument.setTemplateById(advancedPDFTemplateId);
                        pdfDocument.addRecord({
                            templateName: 'record',
                            record: record.load({
                                type: recordType,
                                id: recordId
                            })
                        });
                    }

                    var pdfDocument = pdfDocument.renderAsPdf();
                    pdfDocument.name = documentName + '.pdf';

                    if (recordType == 'customrecord_bb_project_action') {
                        var awsFolderPath = scriptContext.newRecord.getValue({fieldId: 'custrecord_bb_proj_task_dm_folder_text'});
                        try {
                            awsModule.uploadSingleNSFileToAWS(pdfDocument, awsFolderPath);
                        } catch (err) {
                            log.error('error uploading single ns file to aws', err);
                        }
                    }

                    pdfDocument.folder = setFolderPath(scriptContext, recordType, configObj) 
                    var id = pdfDocument.save();

                    record.attach({
                        record: {
                            type: 'file',
                            id: id
                        },
                        to: {
                            type: recordType,
                            id: recordId
                        }
                    });

                }

            } catch (e) {
                log.error('error sending email ', e);
            }
        }


        function setFolderPath(scriptContext, recordType, configObj) {
            var projectFolderName, recordTypeName, folderName, folderName2;

            if (recordType && configObj && scriptContext) {
                projectFolderName = getProjectEntityId(scriptContext, configObj[recordType].projectFolderName);
                recordTypeName = configObj[recordType].recordTypeName;
                folderName = scriptContext.newRecord.getText({fieldId: configObj[recordType].folderName});
                folderName2 = scriptContext.newRecord.getText({fieldId: configObj[recordType].folderName2});

                var id = getFolder('projects',-20);
     
                id = getFolder(projectFolderName,id);

                id = getFolder(recordTypeName,id);

                if (recordType == 'customrecord_bb_project_action' && folderName) {
                    var projActionFolderName = (folderName2) ? folderName + '_' + folderName2 : folderName;
                    id = getFolder(projActionFolderName, id);
                } else {
                    id = getFolder(folderName,id);
                    if (folderName2) {
                        id = getFolder(folderName2,id);
                    }
                }
                return id;
            }
        }


        function getProjectEntityId(scriptContext, projectFieldId) {
            var projectName = '';
            if (projectFieldId) {
                var projectId = scriptContext.newRecord.getValue({fieldId: projectFieldId});
                if (projectId) {
                    var entityObj = search.lookupFields({
                        type: search.Type.JOB,
                        id: projectId,
                        columns: ['entityid']
                    })
                    projectName = entityObj.entityid;
                }
            }
            return projectName;
        }


        function createFolder(name,id){
            return record.create({type: record.Type.FOLDER}).setValue({fieldId:'name',value:name})
                .setValue({fieldId:'parent',value:id}).save();
        }


        function getFolder(name,parent){
            var id;
            search.create({
               type: "folder",
               filters:[["name","is",name],'and',['parent','is',parent]],
               columns: ["parent"]
            }).run().each(function(r){id=r.id});
            if(!id) id = createFolder(name,parent);
            return id;
        }

        function getCustomFolderPathFromConfig() {
            var configObjectString = null;
            search.create({
               type: "customrecord_bb_solar_success_configurtn",
               filters:[["internalid","anyof",1]],
               columns: ["custrecord_bb_cust_folder_path_text"]
            }).run().each(function(result){
                configObjectString = result.getValue({name: 'custrecord_bb_cust_folder_path_text'})
            });
            return configObjectString;
        }

        function getJSONSearchResult(savedSearch) {
            var object = {};
            if (savedSearch) {
                savedSearch.run();
                var start = 0;
                var end = 1;
                var resultSet = savedSearch.run();
                var results = resultSet.getRange({
                    start: start,
                    end: end
                });
                for (var i = 0; i < results.length; i++) {
                    for (var c = 0; c < resultSet.columns.length; c++) {
                        if (!resultSet.columns[c].join) {
                            object[resultSet.columns[c].name] = (results[i].getText({name: resultSet.columns[c].name})) ? 
                                results[i].getText({name: resultSet.columns[c].name}) : results[i].getValue({name: resultSet.columns[c].name});
                        } else {
                            object[resultSet.columns[c].name] = (results[i].getText({name: resultSet.columns[c].name, join: resultSet.columns[c].join})) ? 
                                results[i].getText({name: resultSet.columns[c].name, join: resultSet.columns[c].join}) : results[i].getValue({name: resultSet.columns[c].name, join: resultSet.columns[c].join});
                        }
                    }
                }
            }
            return object;
        }
        

        return {
            onAction: onAction
        }
    }
);