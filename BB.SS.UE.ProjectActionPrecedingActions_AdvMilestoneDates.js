/**
 * SA-44630 SuiteScript Versioning Guidelines
 * SA-43522 SuiteScript 2.x JSDoc Validation
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * @description Set start dates based on preceeding actions
 *
 * Created by David Smith on 6/14/2022
 *
 * @copyright 2022 Blue Banyan Solutions
 */

define(
[
  'N/task',
  'N/query',
  './BB SS/SS Lib/BB.SS.ScheduledScript.BatchProcessing'
],
(
  task,
  query,
  batchProcessor
) => {

  function afterSubmit(context) {
    if(context.type=='delete') return;

    let paNew = context.newRecord;
    let paOld = context.oldRecord;

    let sqlQuery =
      `SELECT
        id, 
        custrecord_bb_recurrence_start_date as start, 
        custrecord_bb_project as project
      FROM
        customrecord_bb_project_action 
      WHERE
        id = ?
      AND
        isinactive='F'`;

    let prjQ = query.runSuiteQL({
      query: sqlQuery,
      params: [paNew.id]
    }).asMappedResults()[0];

    if(!prjQ?.start){
      log.debug('No start date on this action');
      return;
    }
    if(!prjQ?.project){
      log.debug('No project on this action');
    }

    if(!paOld){
      // create
      startUpdateScript(paNew.id);
      return;
    }

    if(paOld.getValue({fieldId:'custrecord_bb_recurrence_start_date'}) != prjQ?.start){
      // updated value
      startUpdateScript(paNew.id);
    }
  }

  function startUpdateScript(prjAct){
    let taskParameters = {};
    taskParameters['custscript_prj_action_id'] = prjAct;

    const scriptId = 'customscript_bbss_prj_act_milestone_date';
    const deploymentId = 'customdeploy_bbss_prj_act_milestone_date';
    const taskType = task.TaskType.SCHEDULED_SCRIPT;

    let taskId = batchProcessor.addToQueue(scriptId, deploymentId, taskParameters, taskType);
    log.audit('Scheduled Script Executed', 'Task ID: ' + taskId);
  }

  return {
    afterSubmit: afterSubmit
  }
});