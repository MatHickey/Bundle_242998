/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/redirect', 'N/task', 'N/ui/serverWidget', 'N/url', 'N/error'],
    /**
 * @param{record} record
 * @param{redirect} redirect
 * @param{task} task
 * @param{serverWidget} serverWidget
 * @param{url} url
 */
    (record, redirect, task, serverWidget, url, error) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try{
                const request = scriptContext.request;
                const response = scriptContext.response;
                const taskId = request.parameters.taskId;

                if (request.method === 'GET') {
                    if(isEmpty(taskId)){
                        throw error.create({
                            name: 'ERROR',
                            message: 'Task ID is empty',
                            notifyOff: false
                        });
                    }
                    // this can be used but is ment more as an example...
                    var form = serverWidget.createForm({
                        title: ' '
                    });
                    form.clientScriptModulePath = './BB.SS.CS.ProgressBar.v2';
                    let fldTaskId = form.addField({
                        id: 'custpage_taskid',
                        label: 'Task ID',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldTaskId.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    fldTaskId.defaultValue = taskId;
                    let fldMainSuiteletID = form.addField({
                        id: 'custpage_main_sl_id',
                        label: 'Main Suitelet ID',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldMainSuiteletID.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    fldMainSuiteletID.defaultValue = request.parameters.mainsuiteletid
                    let fldMainSuiteletDeploy = form.addField({
                        id: 'custpage_main_sl_deploy',
                        label: 'Main Suitelet Deploy',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldMainSuiteletDeploy.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    fldMainSuiteletDeploy.defaultValue = request.parameters.mainsuiteletdeploy;

                    let fldMainSuiteletParamas = form.addField({
                        id: 'custpage_main_sl_params',
                        label: 'Main Suitelet Params',
                        type: serverWidget.FieldType.LONGTEXT
                    });
                    fldMainSuiteletParamas.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    fldMainSuiteletParamas.defaultValue = request.parameters.mainsuiteletparams;
                    log.debug('request.parameters.mainsuiteletparams', request.parameters.mainsuiteletparams);

                    let fldMainRecordId = form.addField({
                        id: 'custpage_main_record_id',
                        label: 'Main Record Id',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldMainRecordId.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    fldMainRecordId.defaultValue = request.parameters.mainrecordid;

                    let fldMainRecordType = form.addField({
                        id: 'custpage_main_record_type',
                        label: 'Main Record Type',
                        type: serverWidget.FieldType.TEXT
                    });
                    fldMainRecordType.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    fldMainRecordType.defaultValue = request.parameters.mainrecordtype;
                    response.writePage(form);
                }else if(request.method === 'POST'){
                    const deploymentId = scriptContext.request.parameters.custpage_deploymentid;
                    var taskid = scriptContext.request.parameters.taskId;
                    var previousPercent = scriptContext.request.parameters.previousPercent;
                    var status = {};

                    //Search task id if request comes from Status Suitelet
                    if (!isEmpty(deploymentId) && isEmpty(taskid)) {
                        taskid = searchTask(deploymentId);
                    }

                    if(isEmpty(taskid)){
                        throw error.create({
                            name: 'ERROR',
                            message: 'Task ID is empty',
                            notifyOff: false
                        });
                    }

                    //get status of the task
                    if (!isEmpty(taskid)) {
                        var taskStatus = task.checkStatus({
                            taskId: taskid
                        });
                        let percent = 0;
                        log.debug('taskStatus.stage ' + taskStatus.stage, taskStatus);
                        if (taskStatus.stage === "GET_INPUT") {
                            percent = 5;
                            status = {
                                stage: taskStatus.stage,
                                status: taskStatus.status,
                                totalMapCount: 1,
                                pendingMapCount: 1,
                                processed: 0,
                                percentComplete: formatToNumber(percent)
                            }
                            log.debug('taskStatus.stage ' + taskStatus.stage, status);
                        } else if (taskStatus.stage === "MAP") {
                            percent = 10;
                            let percentRemainingForMap = 50 - percent;
                            let total = taskStatus.getTotalMapCount();
                            let pending = taskStatus.getPendingMapCount();
                            let processed = total - pending;
                            let mapPercent = total !== 0 ? ((processed / total) * 100).toFixed(2) : 100;
                            log.debug('mapPercent', mapPercent);
                            let mapComplete = percent + (percentRemainingForMap * (mapPercent / 100));
                            percent = mapComplete;
                            status = {
                                stage: taskStatus.stage,
                                status: taskStatus.status,
                                totalMapCount: total,
                                pendingMapCount: pending,
                                processed: processed,
                                percentComplete: formatToNumber(percent)
                            }
                            log.debug('taskStatus.stage ' + taskStatus.stage, status);

                        } else if (taskStatus.stage === "SHUFFLE") {
                            status = status = {
                                stage: taskStatus.stage,
                                status: taskStatus.status,
                                percentComplete: 50
                            };
                        }
                        else if (taskStatus.stage === "REDUCE") {
                            percent = 50;
                            let percentRemainingForReduce = 90 - percent;
                            let total = taskStatus.getTotalReduceCount();
                            let pending = taskStatus.getPendingReduceCount();
                            let processed = total - pending;
                            let reducePercent = total !== 0 ? ((processed / total) * 100).toFixed(2) : 100;
                            let reduceComplete = percent + (percentRemainingForReduce * (reducePercent / 100));

                            status = {
                                stage: taskStatus.stage,
                                status: taskStatus.status,
                                totalReduceCount: total,
                                pendingMapCount: pending,
                                processed: processed,
                                percentComplete: formatToNumber(reduceComplete)
                            }
                            log.debug('taskStatus.stage ' + taskStatus.stage, status);
                        } else if (taskStatus.stage === "SUMMARIZE") {
                            status = {
                                stage: taskStatus.stage,
                                status: taskStatus.status,
                                percentComplete: 95
                            }

                        } else {
                            if (taskStatus.status === task.TaskStatus.COMPLETE) {
                                status = {
                                    stage: taskStatus.stage,
                                    status: taskStatus.status,
                                    percentComplete: 100
                                }
                            }

                            if (taskStatus.status === task.TaskStatus.PENDING) {
                                status = {
                                    stage: taskStatus.stage,
                                    status: taskStatus.status,
                                    percentComplete: 0
                                }
                            }

                            if (taskStatus.status === task.TaskStatus.PROCESSING) {
                                let percentComplete = 15;
                                if(!isEmpty(previousPercent)){
                                    previousPercent = parseInt(previousPercent);
                                    if(previousPercent === 99){
                                        percentComplete = previousPercent;
                                    }else{
                                        percentComplete = previousPercent + 1;
                                    }
                                }
                                status = {
                                    stage: taskStatus.stage,
                                    status: taskStatus.status,
                                    percentComplete: formatToNumber(percentComplete)
                                }
                            }
                        }

                        log.debug('Status', status);
                    }

                    log.debug('status returned in JSON', status);
                    scriptContext.response.write({
                        output: JSON.stringify(status)
                    });
                }

            }catch(e){
                log.error('ERROR', e);
                pageHandler(scriptContext.response, e.message);
            }
        }

        const isEmpty = (stValue) => {
            return ((stValue === '' || stValue == null || false) || (stValue.constructor === Array && stValue.length === 0) || (stValue.constructor === Object && (function (v) {
                for (var k in v)
                    return false;
                return true;
            })(stValue)));
        };

        const pageHandler = (response, message) => {
            let form = serverWidget.createForm({
                title: "Something Went Wrong"
            });
            let script = "win = window.close();";
            form.addButton({
                id: 'custpage_btn_close',
                label: 'Close',
                functionName: script
            });
            let outputHTMLField = form.addField({
                id: 'custpage_output_html',
                label: 'Output',
                type: serverWidget.FieldType.INLINEHTML
            });
            outputHTMLField.defaultValue = message;
            outputHTMLField.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            });
            response.writePage(form);
        }

        /**
         * Function searches for any running instance of the deployment if provided
         *
         * @governance 10 Units
         * @param {String} deploymentId - deployment id
         * @returns {String} taskId - task id running for the deployment
         */
        const searchTask = (deploymentId) => {
            const scheduledscriptinstanceSearchObj = search.create({
                type: "scheduledscriptinstance",
                filters:
                    [
                        ["scriptdeployment.scriptid", "is", deploymentId], 'AND', ['status', 'anyof', SCHEDULED_SCRIPT_STATUS_PENDING, SCHEDULED_SCRIPT_STATUS_PROCESSING, SCHEDULED_SCRIPT_STATUS_RETRY]
                    ],
                columns:
                    [
                        search.createColumn({ name: "taskid", label: "Task ID" })
                    ]
            });
            const taskResult = scheduledscriptinstanceSearchObj.run().getRange(0, 1); //10 units
            let taskId = '';
            if (!isEmpty(taskResult[0])) {
                taskId = taskResult[0].getValue('taskid');
            }

            return taskId
        }

        const formatToNumber = (value) => {
            let returnedValue = value;
            try{
                returnedValue = parseFloat(value).toFixed(2);
            }catch (e) {
                log.debug('Warning', 'Could not parse to number '+ value);
            }

            return returnedValue;
        }

        return {onRequest}

    });
