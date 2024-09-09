/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(['N/currentRecord', 'N/https', 'N/ui/dialog', 'N/ui/message', 'N/url', 'N/runtime'],
/**
 * @param{currentRecord} currentRecord
 * @param{https} https
 * @param{dialog} dialog
 * @param{message} message
 * @param{url} url
 */
function(currentRecord, https, dialog, message, url, runtime) {
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {
        try{
            var currRecord = currentRecord.get();
            var taskID = currRecord.getValue('custpage_taskid');
            var scriptStatusUrl = url.resolveScript({
                scriptId: 'customscript_bb_ss_sl_progressbar_v2',
                deploymentId: 'customdeploy_bb_ss_sl_progressbar_v2'
            });
            if(!isEmpty(taskID)){
                callMapReduceStatusCheck(taskID, scriptContext, scriptStatusUrl);
            }

        }catch (e) {
            log.error('ERROR', e);
        }
    }




    function callMapReduceStatusCheck(taskId, scriptContext, scriptStatusUrl) {

        if (!isEmpty(taskId)) {
            var body = `<div style="width: 700px;margin: 30px auto 0;padding: 15px 15px;border-radius: 3px;background-color: #fff;box-shadow:  0px 1px 2px 0px rgba(0, 0, 0, .2);">
                <div class="progress-bar-wrapper">
                    <span>Automation status: </span><span class="progress-status">NOT STARTED</span>
                    <progress style="background-color: #4E85C1;border: 0;width: 80%;height: 18px;border-radius: 9px;" id="progressbar" value="0" max="100"></progress>
                    <span class="progress-value" style="padding: 0px 5px;line-height: 20px;margin-left: 5px;font-size: .8em;color: #4E85C1;height: 18px;float: right;"> %0 </span>
                </div>
            </div>`;
            jQuery('#body').append(body);

            var progressbar = jQuery('#progressbar'),
                max = progressbar.attr('max'),
                time = (1000/max)*10;

            var loading = function() {
                var status = jQuery('.progress-status').val().toUpperCase();
                if (status === 'FAILED') {
                    alert('FAILED: Process failed. Redirecting to main page.')
                    clearInterval(animate);
                    redirectToSuitelet();
                }
                var value = progressbar.val();
                console.log('value: '+ JSON.stringify(value));
                if (value == max) {
                    alert('COMPLETE: Process is completed. Redirecting to main page.');
                    clearInterval(animate);
                    redirectToSuitelet();
                }
                var scriptInfo = callSuitelet(taskId, scriptStatusUrl, value);
                console.log('scriptInfo: '+ JSON.stringify(scriptInfo));

            };

            var animate = setInterval(function() {
                loading();
            }, time);

        }
    }


    function callSuitelet(taskId, scriptStatusUrl, previousPercent) {
        return jQuery.post(scriptStatusUrl, {taskId: taskId, previousPercent: previousPercent}, function( data ) {
            data = JSON.parse(data);
            console.log('data.status: '+data.status);
            console.log('data.percentComplete: '+data.percentComplete);
            jQuery('#progressbar').val(data.percentComplete);
            jQuery('.progress-value').html(data.percentComplete + '%');
            jQuery('.progress-status').html(data.status);
        });
    }

    function redirectToSuitelet(){
        var currRecord = currentRecord.get();
        var scriptID = currRecord.getValue('custpage_main_sl_id');
        var deployID = currRecord.getValue('custpage_main_sl_deploy');
        var paramValues = currRecord.getValue('custpage_main_sl_params');

        var recordID = currRecord.getValue('custpage_main_record_id');
        var recordType = currRecord.getValue('custpage_main_record_type');

        //Redirects to a suitelet
        if(!isEmpty(scriptID) && !isEmpty(deployID)) {

            var suiteletURL = url.resolveScript({
                scriptId: scriptID,
                deploymentId: deployID
            });

            if (!isEmpty(paramValues)) {
                suiteletURL += paramValues;
            }
            window.open(suiteletURL, '_self', false);
        }

        //Redirects to a record
        if(!isEmpty(recordID) && !isEmpty(recordType)) {
            var output = url.resolveRecord({
                recordType: recordType,
                recordId: recordID,
                isEditMode: false
            });

            window.open(output, '_self', false);
        }
    }

    function isEmpty (stValue) {
        return ((stValue === '' || stValue == null || false) || (stValue.constructor === Array && stValue.length === 0) || (stValue.constructor === Object && (function (v) {
            for (var k in v)
                return false;
            return true;
        })(stValue)));
    };

    return {
        pageInit: pageInit
    };
    
});
