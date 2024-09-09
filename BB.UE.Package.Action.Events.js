/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @overview UserEvent script on the Action Template record
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/record', 'N/search', 'N/task'],
function(record, search, task) {
  //BS-196 begin
  /**
   * Function creates Action Template Queue records for later processing
   * @param actionTemplateName Action Template Name field value
   * @param actionGroup Action Template Action Group field value
   * @param actionTemplateRecurFreqNew Action Template Recurrence Frequency field value
   */
  function createQueueRecord(actionTemplateName, actionGroup, actionTemplateRecurFreqNew) {
    log.debug('in createQueueRecord');
    var qRecord = record.create({
      type: 'customrecord_bb_ss_action_template_queue'
    });
    qRecord.setValue('custrecord_bb_ss_atq_name', actionTemplateName);
    qRecord.setValue('custrecord_bb_ss_atq_action_group', actionGroup);
    qRecord.setValue('custrecord_bb_ss_atq_recur_freq', actionTemplateRecurFreqNew);
    var qRecordId = qRecord.save();
    log.debug('qRecordId', qRecordId);
  }
 /**
 * If Recurrence Frequency field changed, trigger script to update this field on all Project Action records that have the same
 * Name and Action Group.  If the map/reduce script deployment is busy, create an Action Template Queue record
 * for later processing.
 */
  function setRecurrenceFrequency(context) {
    log.debug('in setRecurrenceFrequency', context);

//BS-268 start
    if (context.type === context.UserEventType.CREATE) {
      return;
    }
//BS-268 end

    var actionTemplateRecurFreqOld = context.oldRecord.getValue({fieldId: 'custrecord_bb_pack_act_recur_frequency'});
    log.debug('actionTemplateRecurFreqOld', actionTemplateRecurFreqOld);
    var actionTemplateRecurFreqNew = context.newRecord.getValue({fieldId: 'custrecord_bb_pack_act_recur_frequency'});
    log.debug('actionTemplateRecurFreqNew', actionTemplateRecurFreqNew);
    if (actionTemplateRecurFreqNew !== actionTemplateRecurFreqOld) {
      var actionTemplateName = context.newRecord.getValue({fieldId: 'name'});
      var actionGroup = context.newRecord.getValue({fieldId: 'custrecord_bb_package_detail'});
      log.debug('actionTemplateName', actionTemplateName);  //this is the text value
      log.debug('actionGroup', actionGroup);
      log.debug('calling map/reduce');
      // call map/reduce script instead of scheduled script because of the possible number of records to be processed
      try {
        task.create({
          taskType: task.TaskType.MAP_REDUCE,
          scriptId: 'customscript_bb_ss_mr_projact_recurfreq', //BB.SS.MR.Project.Action.Recur.Freq.js
          deploymentId: 'customdeploy_bb_ss_mr_proj_actn_rec_freq',
          params: {
            custscript_bb_ss_actiontmpl_name: actionTemplateName,
            custscript_bb_ss_actiontmpl_group: actionGroup,
            custscript_bb_ss_actiontmpl_recur_freq: actionTemplateRecurFreqNew,
            custscript_bb_ss_actiontmpl_queue: null
          }
        }).submit();
      } catch (e) {
        createQueueRecord(actionTemplateName, actionGroup, actionTemplateRecurFreqNew);
      }
    }
  }
  //BS-196 end
  function beforeLoad(context) {}
  function beforeSubmit(context) {}
  function afterSubmit(scriptContext) {
      setExternalId(scriptContext);
      setRecurrenceFrequency(scriptContext);
  }

  function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (dt + Math.random()*16)%16 | 0;
      dt = Math.floor(dt/16);
      return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
  }


  function setExternalId(context){
    if(context.newRecord) {
      var _extId = context.newRecord.getValue({fieldId: 'externalid'});
      log.debug('_extId', _extId);
      if(!_extId) {
        try{
          var rec = context.newRecord;
          rec = record.load({
            type: rec.type,
            id: rec.id,
            isDynamic: true
          });
          log.debug('externalid', rec.getValue({fieldId: 'externalid'}));
          rec.setValue({
            fieldId:'externalid',
            value: create_UUID(),
            ignoreFieldChange: true
          });

          rec.save();
        } catch(e){
          log.error(e.name, e.message);
        }
      }
    }
  }

  return {
      //beforeLoad: beforeLoad,
      //beforeSubmit: beforeSubmit,
      afterSubmit: afterSubmit
  };

});