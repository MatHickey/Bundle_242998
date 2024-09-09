/**
 * @author Michael Golichenko <mgolichenko@bluebanyansolutions.com>
 * @version 0.0.1
 * @NScriptType Suitelet
 * @NApiVersion 2.x
 * @NModuleScope public
 **/

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/task', './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'], function (taskModule, batchProcessor) {

  function onRequest(context) {
    const
      _request = context.request
      , _response = context.response
      , _params = _request.parameters
    ;
    var
      _days = _params.days
      , _projectId = _params.project
      , _wfId = false
      , _task
    ;
    if (_days && _projectId) {
      // here logic to trigger workflow
      // _wfId = workflowModule.trigger({
      //   recordType: 'customrecord_bb_project_action',
      //   workflowId: 'customworkflow_bb_test_workflow_trigger',
      //   // defaultValues: {
      //   //   custwfstate_bb_wff_proj_pause: _days
      //   //   , custwfstate_bb_wff_project_pause: _projectId
      //   // }
      // });

      batchProcessor.addToQueue(
        'customscript_bb_ss_mr_pause_project'
        , 'customdeploy_bb_ss_mr_pause_project'
        , {
          'custscript_bb_pp_project': _projectId
          , 'custscript_bb_pp_days': _days
        }
        , taskModule.TaskType.MAP_REDUCE);
      _response.write({output: JSON.stringify({status: 'OK'})});
    }


  }

  return {
    onRequest: onRequest
  };

});