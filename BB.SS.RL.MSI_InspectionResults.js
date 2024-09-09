/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope Public
 *
 * Requires bundle 242998 (BB Solar Success)
 */

/**
 * NOTES:  custcol_linenumber is set by MSI and maps to the "Id" of the result object
 */

define(['./BB SS/API Logs/API_Log','N/search','N/record','N/format','N/url','N/task','N/error'],
    function(api, search, record, format, url, task, error) {

    function createLog(logData,apiLog){
        try {
            // AWS S3 bucket format: ns-<accountnumber>
            // TODO: make the S3 bucket a script parameter ???
            var AWS_S3 = "https://ns-tstdrv2058952.s3-us-west-1.amazonaws.com/";

            // get the SO number and find the line that goes with it
            var msiInspectionId = logData.Id; // this is set on the order line number
            if (!msiInspectionId) {
                apiLog.setValue({fieldId: 'error', value: {success: false, error:{name:"MISSING_INSPECTION_ID",message:"No inspection ID"}}});
                throw error.create({
                    name: 'MISSING_INSPECTION_ID',
                    message: "No inspection ID",
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_INSPECTION_ID",message:"No inspection ID"}};
            }
            var inspectionResultId = logData.InspectionResultId;
            var segment = logData.OrderSegment;
            if (!segment) {
                apiLog.setValue({fieldId: 'error', value: {name:"MISSING_ORDER_SEGMENT",message:"No order segment"}});
                throw error.create({
                    name: 'MISSING_ORDER_SEGMENT',
                    message: "No order segment",
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_ORDER_SEGMENT",message:"No order segment"}};
            }
            var order = segment.Order;
            if (!order) {
                apiLog.setValue({fieldId: 'error', value: {name:"MISSING_ORDER",message:"No order found in the segment"}});
                throw error.create({
                    name: 'MISSING_ORDER',
                    message: "No order found in the segment",
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_ORDER",message:"No order found in the segment"}};
            }
            var orderNumber = logData.OrderSegment.Order.OrderNumber;
            if (!orderNumber) {
                apiLog.setValue({fieldId: 'error', value: {name:"MISSING_ORDER_NUMBER",message:"No order number found"}});
                throw error.create({
                    name: 'MISSING_ORDER_NUMBER',
                    message: "No order number found",
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_ORDER_NUMBER",message:"No order number found"}};
            }

            var orderData = getSalesOrderData(msiInspectionId);

            if (!orderData) {
                // return error
                apiLog.setValue({fieldId: 'error', value: {name:"MISSING_ORDER",message:"Could not find the order with SP Line ID = "+msiInspectionId}});
                throw error.create({
                    name: 'MISSING_ORDER',
                    message: "Could not find the order with SP Line ID = "+msiInspectionId,
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_ORDER",message:"Could not find the order with SP Line ID = "+msiInspectionId}};
            }
            apiLog.setValue({fieldId: 'transaction', value: orderData.id});
            apiLog.setValue({fieldId: 'entity', value: orderData.values.entity[0].value});
            apiLog.setValue({fieldId: 'item', value: orderData.values.item[0].value});

            var msiServiceType = orderData.values["item.custitemservicetype"][0];
            var msiInspectionRec = orderData.values["item.custitem_msi_inspection"][0];
            msiInspectionRec.scriptId = search.lookupFields({
                type: 'customrecordtype',
                id: msiInspectionRec.value,
                columns: ['scriptid']
            }).scriptid;

            log.debug('custom record script id', msiInspectionRec);

            // create a new custom record
            if (!msiInspectionRec.scriptId) {
                // error - can't link to a custom record
                apiLog.setValue({
                    fieldId: 'error',
                    value: {
                        name: 'REC_NOT_FOUND',
                        message: 'The custom record was not found or linked properly',
                        msi: msiInspectionRec
                    }
                });
                throw error.create({
                    name: 'REC_NOT_FOUND',
                    message: 'The custom record was not found or linked properly',
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_CUSTOM_RECORD",message:"The custom record was not found or linked properly"}};
            }

            var inspectionLog = record.create({
                type: msiInspectionRec.scriptId,
                isDynamic: true
            });
            //log.debug(msiInspectionRec.scriptId,inspectionLog);
            var allFields = inspectionLog.getFields();

            var fieldArry = allFields.filter(function filterByID(field) {
                // this filters out netsuite's hidden fields that are included in the getFields()
                return field.indexOf('custrecord') == 0;
            });
            log.debug(msiInspectionRec.scriptId, fieldArry);

            var fields = {};
            for (var f = 0; f < fieldArry.length; f++) {
                var fieldId = fieldArry[f];
                // using labels to match by below
                var field = inspectionLog.getField({fieldId: fieldId});
                fields[field.label] = field;
            }
            log.debug('Fields', fields);

            // attempt to set the Sales Order field
            if(fields["Sales Order"]){
                inspectionLog.setValue({
                    fieldId: fields["Sales Order"].id,
                    value: orderData.id
                });
            }
            // attempt to set the Project field
            if(fields["Project"] && orderData.values.custbody_bb_project[0]){
                inspectionLog.setValue({
                    fieldId: fields["Project"].id,
                    value: orderData.values.custbody_bb_project[0].value
                });
            }
            // attempt to set the Project Action field
            if(fields["Project Action"] && orderData.values.custcol_bb_ss_proj_action[0]){
                inspectionLog.setValue({
                    fieldId: fields["Project Action"].id,
                    value: orderData.values.custcol_bb_ss_proj_action[0].value
                });
            }

            // While looping through the responses, store any that are images so we have them for the project action
            var allImages = [];
            // image viewer link
            var imageURL = '<a href="https://' + url.resolveDomain({
                hostType: url.HostType.APPLICATION
            }) + url.resolveScript({
                scriptId: 'customscript_bb_msi_s3_sl_showfile',
                deploymentId: 'customdeploy_bb_msi_s3_sl_showfile',
                params: {name:'file__link'},
                returnExternalUrl: false
            }) + '" target="_blank">file__name</a>';

            // create new mapping based on the labels
// all the pages...
            var pages = logData.InspectionResult.InspectionPageResult;
            for (var p = 0; p < pages.length; p++) {
// all the sections
                var sections = pages[p].InspectionSectionResult;
                for (var s = 0; s < sections.length; s++) {
                    var questions = sections[s].InspectionQuestionResult;
                    for (var q = 0; q < questions.length; q++) {
                        try{
                            var qResult = questions[q];
                            // now process this
                            log.debug('question result', qResult);
                            var question = qResult.InspectionQuestion;
                            var qLabel = question.QuestionLabel;
                            var qLinkId = question.InspectionQuestionLinkId;
                            var qAttachment = qResult.Attachment;
                            var qType = question.QuestionType.CodeNumber;

                            /** Example fields[qLabel]
                             "Subpanel": {
                                "id": "custrecord_bb_ss_subpanel",
                                "label": "Subpanel",
                                "type": "select"
                            },   */

                            // if this question's label exists in the NS custom record, try to process it
                            if (fields[qLabel]) {
                                //log.debug(qLabel+' = '+qType,fields[qLabel]);
                                // NS custom record is used for system of record (primary)
                                if (fields[qLabel].type == format.Type.SELECT) {
                                    // single select list - use first result here. If SP has more than one result the records do not match select type
                                    var choiceResult = qResult.InspectionQuestionChoiceResult[0];
                                    if (!choiceResult) {
                                        log.error(fields[qLabel], 'InspectionQuestionChoiceResult has no value or is missing. This question may not have been answered.');
                                        continue;
                                    }
                                    var choiceTxt = choiceResult.InspectionQuestionChoice.Value;

                                    // set the field based on text
                                    inspectionLog.setText({
                                        fieldId: fields[qLabel].id,
                                        text: choiceTxt
                                    });
                                } else if(qType=='Image' && qAttachment.S3FilePath){
                                    // qAttachment.S3FilePath

                                    //log.debug(fields[qLabel].id,qAttachment.S3FilePath);
                                    inspectionLog.setValue({
                                        fieldId: fields[qLabel].id,
                                        // value: AWS_S3 + qAttachment.S3FilePath
                                        value: imageURL
                                            .replace('file__link',qAttachment.S3FilePath)
                                            .replace('file__name',qLabel)
                                    });
                                    allImages.push({
                                        fieldId: fields[qLabel].id,
                                        value: qAttachment.S3FilePath
                                    });
                                } else if(qType=='Date'){
                                    var parsedDateStringAsRawDateObject = format.parse({
                                        value: qResult.Value,
                                        type: format.Type.DATE
                                    });
                                    inspectionLog.setValue({
                                        fieldId: fields[qLabel].id,
                                        value: parsedDateStringAsRawDateObject
                                    });
                                } else {
                                    // set the field value
                                    inspectionLog.setValue({
                                        fieldId: fields[qLabel].id,
                                        value: qResult.Value
                                    });
                                }
                            } else {
                                log.audit(msiInspectionRec.scriptId+' Question Label Not Found',qLabel)
                            }
                        } catch (qErr) {
                            log.error('error setting field '+qErr.name,qErr.message);
                        }
                    }
                }
            }
            var inspId = inspectionLog.save();
            log.debug(msiInspectionRec.scriptId + ':' + inspId, 'saved');

            // if the project action is in the order data, set the linkage to the site survey
            if(orderData.values.custcol_bb_ss_proj_action[0]){
                var surveyLink = 'https://' + url.resolveDomain({
                    hostType: url.HostType.APPLICATION
                }) + url.resolveRecord({
                    recordType: msiInspectionRec.scriptId,
                    recordId: inspId,
                    isEditMode: false
                });
                log.debug('survey link',surveyLink);
                record.submitFields({
                    type: 'customrecord_bb_project_action',
                    id: orderData.values.custcol_bb_ss_proj_action[0].value,
                    values: {
                        custrecord_msi_survey_link: surveyLink
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true,
                        disableTriggers: true
                    }
                });
            }


            // Kick off script to show image data on the project action
            if(orderData.values.custcol_bb_ss_proj_action[0] && allImages.length>0){
                log.debug('Image Files to copy',allImages);
                var paId = orderData.values.custcol_bb_ss_proj_action[0].value;
                try{
                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_bb_msi_copy_s3_files',
                        params: {
                            custscript_file_obj_array: allImages,
                            custscript_bb_msi_copyto_proj_action: paId
                        }
                    });
                    log.debug('M/R task',mrTask);
                    var mrTaskId = mrTask.submit();
                } catch (error){
                    if(error.name=='NO_DEPLOYMENTS_AVAILABLE'){
                        // create a new deployment and try again
                        createNewDeployment();
                        // attempt to schedule task again
                        var mrTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_bb_msi_copy_s3_files',
                            params: {
                                custscript_file_obj_array: allImages,
                                custscript_bb_msi_copyto_proj_action: paId
                            }
                        });
                        log.debug('M/R task',mrTask);
                        var mrTaskId = mrTask.submit();
                    }
                }

                log.debug('M/R is queued to copy files',mrTaskId);

            }

            return {success: true, inspectionId:inspId, inspectionRecord:msiInspectionRec.scriptId};


        } catch (e) {
            log.error(e.name,e.message);
            apiLog.setValue({fieldId: 'error', value: {name:e.name,message:e.message}});
            throw error.create({
                name: e.name,
                message: e.message,
                notifyOff: false
            });
            return {success: false, error:{name:e.name,message:e.message}};
        }
    }


    function setPDF(requestBody,apiLog){
        try{
            log.debug('setting PDF on sales order',requestBody);
            var orderLineId = requestBody.OrderLineId;
            var inspectionResultId = requestBody.InspectionResultId;
            var s3FilePath = requestBody.S3FilePath;

            var pdfURL = 'https://' + url.resolveDomain({
                hostType: url.HostType.APPLICATION
            }) + url.resolveScript({
                scriptId: 'customscript_bb_msi_s3_sl_showfile',
                deploymentId: 'customdeploy_bb_msi_s3_sl_showfile',
                params: {name:'file__link'},
                returnExternalUrl: false
            });
            pdfURL = pdfURL.replace('file__link',s3FilePath);
            log.debug('setting PDF link',pdfURL);

            var orderData = getSalesOrderData(orderLineId);

            if (!orderData) {
                // return error
                apiLog.setValue({fieldId: 'error', value: {name:"MISSING_ORDER",message:"Could not find the order with SP Line ID = "+orderLineId}});
                throw error.create({
                    name: 'MISSING_ORDER',
                    message: "Could not find the order with SP Line ID = "+orderLineId,
                    notifyOff: false
                });
                return {success: false, error:{name:"MISSING_ORDER",message:"Could not find the order with SP Line ID = "+orderLineId}};
            }
            apiLog.setValue({fieldId: 'transaction', value: orderData.id});
            apiLog.setValue({fieldId: 'entity', value: orderData.values.entity[0].value});
            apiLog.setValue({fieldId: 'item', value: orderData.values.item[0].value});

            // set the field to store the PDF link
            // RCRD_HAS_BEEN_CHANGED - MSI script is changing the same record
            for(var r=0; r<5; r++){
                // this needs to be done in a loop because MSI is updating the order at the same time
                try{
                    var so = record.load({
                        type: record.Type.SALES_ORDER,
                        id: orderData.id,
                        isDynamic: false
                    });
                    var lineNumber = so.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'line',
                        value: orderData.values.line
                    });
                    if(lineNumber>=0){
                        so.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_ss_msi_pdf',
                            line: lineNumber,
                            value: pdfURL
                        });
                        var soId = so.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                    }
                    log.debug('sales order updated with pdf');
                    break;
                } catch (e) {
                    log.error('sales order PDF '+e.name,e.message);
                }
            }

            if(orderData.values.custcol_bb_ss_proj_action[0] && s3FilePath){
                log.debug('PDF File to copy',s3FilePath);
                var paId = orderData.values.custcol_bb_ss_proj_action[0].value;

                try {
                    // takes first available deployment
                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_bb_msi_copy_s3_files',
                        params: {
                            custscript_file_obj_array: [{value:s3FilePath}],
                            custscript_bb_msi_copyto_proj_action: paId
                        }
                    });
                    log.debug('M/R task',mrTask);
                    var mrTaskId = mrTask.submit();

                } catch (error){
                    if(error.name=='NO_DEPLOYMENTS_AVAILABLE'){
                        // create a new deployment and try again
                        createNewDeployment();
                        // attempt to schedule task again
                        var mrTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_bb_msi_copy_s3_files',
                            params: {
                                custscript_file_obj_array: [{value:s3FilePath}],
                                custscript_bb_msi_copyto_proj_action: paId
                            }
                        });
                        log.debug('M/R task - second attempt',mrTask);
                        var mrTaskId = mrTask.submit();
                    }
                }

                log.debug('M/R is queued to copy files',mrTaskId);
            }

            return {success: (soId ? true : false), nsOrderId:orderData.id, nsOrderNumber:orderData.values.tranid};
        } catch (e) {
            log.error(e.name,e.message);
            apiLog.setValue({fieldId: 'error', value: {name:e.name,message:e.message}});
            throw error.create({
                name: e.name,
                message: e.message,
                notifyOff: false
            });
            return {success: false, error:{name:e.name,message:e.message}};
        }
    }

    function createNewDeployment(){
        // create a new deployment to use automatically
        var script = search.create({
            type: "script",
            columns:['internalid'],
            filters:['scriptid', 'is', 'customscript_bb_msi_copy_s3_files']
        }).run().getRange({start: 0, end: 1}) || [];
        var scriptId = script[0].id;
        var deployments=[];
        search.create({
            type: record.Type.SCRIPT_DEPLOYMENT,
            columns: ['internalid', 'title', 'scriptid'],
            filters: [['script', 'anyof', [scriptId]], 'and', ["status","anyof","NOTSCHEDULED"]]
        }).run().each(function (dep) {
            deployments.push(dep);
            return true;
        });

        var dep = record.create({
            type: record.Type.SCRIPT_DEPLOYMENT,
            defaultValues: {'script': scriptId}
        });
        var formattedDeployName = '_bb_msi_copy_s3_files';
        log.debug('deployment count', deployments.length);
        var scriptIdSuffix = deployments.length+1;
        dep.setValue('scriptid', formattedDeployName + scriptIdSuffix);
        dep.setValue('status', 'NOTSCHEDULED');
        var createdDepId = dep.save();
        log.debug(createdDepId+' new deployment created',formattedDeployName + scriptIdSuffix);
        return createdDepId;
    }


    function getSalesOrderData(msiInspectionId){
        var salesorderSearchObj = search.create({
            type: "salesorder",
            filters:
                [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["custbodysendtoservicepro", "is", "T"],
                    "AND",
                    ["custcol_linenumber", "is", msiInspectionId]
                ],
            columns:
                [
                    "linesequencenumber",
                    "line",
                    "custcol_linenumber",
                    "custcol_bb_ss_proj_action",
                    "item",
                    search.createColumn({
                        name: "custitem_msi_inspection",
                        join: "item"
                    }),
                    search.createColumn({
                        name: "custitemservicetype",
                        join: "item"
                    }),
                    "trandate",
                    "tranid",
                    "entity",
                    "custbodysendtoservicepro",
                    "custbody_bb_project",
                    "custbody_bb_milestone"
                ]
        });
        var searchResultCount = salesorderSearchObj.runPaged().count;
        log.debug("salesorderSearchObj result count", searchResultCount);
        var orderData = null;
        salesorderSearchObj.run().each(function (result) {
            orderData = result.toJSON();
            return false; // only first result
        });

        log.debug('orderData', orderData);
        return orderData;
    }

    /**
     * Function called upon sending a GET request to the RESTlet.
     *
     * @governance XXX
     *
     * @param requestParams
     *        {Object} Parameters from HTTP request URL; parameters will be
     *        passed into function as an Object (for all supported content
     *        types)
     *
     * @return {String|Object} HTTP response body; return string when request
     *         Content-Type is 'text/plain'; return Object when request
     *         Content-Type is 'application/json'
     *
     * @since 2015.1
     *
     * @static
     * @function doGet
     */
    function doGet(requestParams) {
        var out = '';
        var APILog = new api.APILog({"method":"GET","parameters":requestParams});

        if(requestParams.apilog){
            // load the log record data for testing
            var requestBody = search.lookupFields({
                type: 'customrecord_api_log',
                id: requestParams.apilog,
                columns: ['custrecord_api_body']
            }).custrecord_api_body;
            requestBody = JSON.parse(requestBody);
            APILog.setValue({fieldId:'body',value:requestBody});
        } else {
            return 'missing api log id';
        }

        // separate out the log data from the array
        if(util.isArray(requestBody)){
            // just taking the first object out
            requestBody = requestBody[0];
            log.debug('data is an array - taking first element');
        }

        if(APILog){
            // var successObj = createLog(requestBody,APILog);
            // log.debug('success',successObj);
            // successObj.connection = "Connection to this API was successful.";
            // APILog.setValue({fieldId:'response',value:successObj});
            // out += JSON.stringify(successObj);



            try{requestBody = JSON.parse(requestBody);} catch (e) {
                log.debug('requestBody = JSON.parse(requestBody);','already an object');
            }

            if(!requestBody.S3FilePath){
                var successObj = createLog(requestBody,APILog);
            } else {
                // if it's not an array it should be the PDF of the inspection
                log.debug('data is NOT an array', 'should be just the pdf');
                var successObj = setPDF(requestBody,APILog);
            }
            log.debug('success',successObj);
            //successObj.connection = "Connection to this API was successful.";
            APILog.setValue({fieldId:'response',value:successObj});
            out += JSON.stringify(successObj);
        } else {
            out += JSON.stringify({"success":false,
                error:{"name":"LOG_ERROR","message": "Unable to establish log file."}
            });
        }
        return out;
    }

    /**
     * Function called upon sending a POST request to the RESTlet.
     *
     * @governance XXX
     *
     * @param requestBody
     *        {String|Object} The HTTP request body; request body will be
     *        passed into function as a string when request Content-Type is
     *        'text/plain' or parsed into an Object when request Content-Type is
     *        'application/json' (in which case the body must be a valid JSON)
     *
     * @return {String|Object} HTTP response body; return string when request
     *         Content-Type is 'text/plain'; return Object when request
     *         Content-Type is 'application/json'
     *
     * @since 2015.2
     *
     * @static
     * @function doPost
     */
    function doPost(requestBody) {
        var APILog = new api.APILog({"method":"POST","body":requestBody});

        if(APILog){
            try{requestBody = JSON.parse(requestBody);} catch (e) {
                log.debug('requestBody = JSON.parse(requestBody);','already an object');
            }
            // separate out the log data from the array
            if(util.isArray(requestBody)){
                log.debug('data is an array');
                // just taking the first object out
                requestBody = requestBody[0];
                if(!requestBody.S3FilePath){
                    var successObj = createLog(requestBody,APILog);
                }
            }
            if(requestBody.S3FilePath) {
                // if it's not an array it should be the PDF of the inspection
                log.debug('data is NOT an array', 'should be just the pdf');
                var successObj = setPDF(requestBody,APILog);
            }
            log.debug('success',successObj);
            //successObj.connection = "Connection to this API was successful.";
            APILog.setValue({fieldId:'response',value:successObj});
            return successObj;
        } else {
            throw error.create({
                name: 'LOG_ERROR',
                message: "Unable to establish log file.",
                notifyOff: false
            });
            return {"success":false,
                error:{"name":"LOG_ERROR","message": "Unable to establish log file."}
            }
        }

    }

    return {
        get: doGet,
        post: doPost
    }
});
