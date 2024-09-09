/* jshint unused:true, undef:true */
define( // jshint ignore:line
    ['N/url', 'N/https', './util.js', 'N/search','N/runtime'],

    function (url, https, util, search,runtime) {
        var intervalId = null;
        /**
         * Function gets the response body from the suitelet and sets the percentage to the progress bar
         *
         * @governance 0 Units
         * @param {Object} body - response from the suitelet
         */
        function addPercentInProgressBar(body) {
            console.log(body);
            jQuery('#file').attr('value', body.percentComplete);
        }

        /**
         * Function adds the progress bar and sends request to suitelet to get the task status
         *
         * @governance 0 Units
         * @param {String} taskId - Task id of the Map reduce script
         * @param {Object} context - Context object of the current request
         */
        function callMapReduceStatusCheck(taskId, context,scriptId,depId) {

            if (taskId) {

                var txt1 = "<label for='file'>Status:</label>";
                var txt2 = "<progress id='file' value='' max='100'> 32% </progress>";

                jQuery('#body').append(txt1, txt2);
                intervalId = setInterval(function () { callSuitelet(taskId, context,scriptId,depId) }, 10000);

            }
        }


        /**
         * Function sends request to suitelet to get the task status and redirects to new Project upon completion of copy
         *
         * @governance 0 Units
         * @param {String} taskId - Task id of the Map reduce script
         * @param {Object} context - Context object of the current request
         */
        function callSuitelet(taskId, context,suitletId,suiteletDepId) {
            var headerObj = {
                name: 'Content-Type',
                value: 'application/json'
            };
            var param = {
                taskId: taskId
            }

            var scriptStatusUrl=url.resolveScript({
                scriptId: 'customscript_bb_sl_scriptrunningstatus',
                deploymentId: 'customdeploy_bb_sl_scriptrunningstatus'
            });
            var response = https.post({
                url: scriptStatusUrl,
                headers: headerObj,
                body: param
            });
            var respObj = JSON.parse(response.body);
            if (respObj.status == 'COMPLETE' || respObj.status == 'FAILED') {
                clearInterval(intervalId);
            }

            if (respObj.status == 'COMPLETE') {

                var output = url.resolveScript({
                    scriptId: suitletId,
                    deploymentId: suiteletDepId,
                });

                window.location = output;
            }
            addPercentInProgressBar(respObj);

        }

        return {
            addPercentInProgressBar: addPercentInProgressBar,
            callMapReduceStatusCheck: callMapReduceStatusCheck,
            callSuitelet: callSuitelet,
        };
    })
