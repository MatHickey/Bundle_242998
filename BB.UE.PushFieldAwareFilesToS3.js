/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
/**
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */
define(['N/record', 'N/search', 'N/runtime', 'N/https', 'N/task', 'N/query', './BBSS.FieldAware.S3'],
    function (record, search, runtime, https, task, query, s3) {

        function afterSubmit(context) {
            var newImages = context.newRecord.getValue('custbody_f4n_uuid');
            var oldImages = context.oldRecord.getValue('custbody_f4n_uuid');
            if (newImages == oldImages) {
                var filePath =  getNewFilePath(context.newRecord);

                var fileName =  newImages.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/g)[0];
                var sourcePath =  'fieldaware' + newImages.match(/com([\s\S]*)$/g)[0].substring(3);
                log.debug('fileName' , fileName);
                log.debug('FilePath' , filePath);
                log.debug('sourcePath' , sourcePath);


            }

            // parse string
            // get path
            // for each send request

            var S3 = new s3.Service();
            // var sourceFile = "fieldaware/8b50fe705b2b4f2899d8edd01bda8ccc/photo_7b68d8d5-7ba2-47b8-8246-6ba0d1cb3ace.jpeg";
            // var newFileName = "000726717765/solar-success-dev/PROJ-193/Substantial Completion/M2 Approval_1/test1.jpeg";
            var sourceFile = sourcePath;
            var newFileName = filePath +'/' + fileName
            log.debug('newFileName' , newFileName);
            var response = S3.copyObject2(sourceFile, newFileName)
            log.debug('response' , response);


        }

        function getNewFilePath(recordObj) {
            var sql = "SELECT sd.primarykey from scriptdeployment sd " +
                "left join userEventScript ue on sd.script=ue.id " +
                "where ue.scriptid='customscript_bludocs_file_field' and isdeployed='T' " +
                "and status='RELEASED' and recordtype ='CUSTOMRECORD_BB_PROJECT_ACTION'";
            var depIds = query.runSuiteQL({query: sql, params: []})
                .asMappedResults()
                .map(function (r) {
                    return r.primarykey
                });
            log.debug(depIds.length + ' _depIds', depIds);
            var deployment = record.load({type: 'scriptdeployment', id: depIds[0]});
            var primaryFolder = deployment.getValue('custscript_bludocs_bucket_folder_path');
            var projectactionPath;
            var itemLineCount = recordObj.getLineCount({
                sublistId:'item'
            });
            for( var i = 0 ; 0<  itemLineCount; i++ ) {
                var projectAction = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_bb_ss_proj_action',
                    line: i
                });
                log.debug('projectAction' , projectAction);
                if(projectAction){ //projectAction != '
                    projectactionPath = search.lookupFields({
                        type: 'customrecord_bb_project_action',
                        id: projectAction,
                        columns: ['custrecord_bb_bludocs_path']
                    }).custrecord_bb_bludocs_path
                    log.debug('projectactionPath' , projectactionPath);
                    break;
                }
            }

            return runtime.accountId + '/' + primaryFolder + '/' + projectactionPath

        }

        return {
            afterSubmit: afterSubmit
        };
    });