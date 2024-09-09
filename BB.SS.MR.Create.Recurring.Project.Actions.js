'use strict';
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author Melody Mattheis
 * @overview Create new Project Action records based on date logic using
 *           Project Action Recurrence Frequency field.  Recurrence Start Date
 *           must be today's date.  You'll be creating records for the future.
 *           Schedule execution before midnight.
 */
/**
 * Copyright 2017-2023 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */
define(['N/search', 'N/record', 'N/format', 'N/runtime'],
(nSearch, nRecord, nFormat, nRuntime) => {
  /**
  * Find all Project Action records where Recurrence Frequency on today
  * @returns object containing internal id and Recurrence Frequency for the Project Action record,
  *          Recurrence Start Date, and Action Group
  */
  const getInputData = () => {
    log.audit('SCRIPT START', '------------------------------');
    let projectActionObj = {};
    let projectActionArray = [];
    let projectActionSearchObj = nRuntime.getCurrentScript().getParameter({
        name: 'custscript_bb_ss_proj_action_search'
    });
    let search = nSearch.load({id: projectActionSearchObj});

    search.run().each((result) => {
      projectActionObj = {};
      projectActionObj.id = result.getValue('internalid');
      projectActionObj.recurFreq = result.getValue('custrecord_bb_recurrence_frequency');
      projectActionObj.recurStartDate = result.getValue('custrecord_bb_recurrence_start_date');
      projectActionObj.actionGroup = result.getValue('custrecord_bb_package');  //Action Group
      projectActionObj.actionTemplate = result.getText('custrecord_bb_project_package_action');  //Action Template
      projectActionObj.revisionNbr = result.getValue('custrecord_bb_revision_number');
      projectActionObj.projectId = result.getValue({name: 'entityid', join: 'CUSTRECORD_BB_PROJECT'});
      projectActionArray.push(projectActionObj);

      return true;
    });

    log.debug('projectActionArray', projectActionArray);
    return projectActionArray;
  }
  /**
  * Get Action Status Name where Status Type is In Progress and Name starts with 'Ready'
  * and Action Group matches Project Action- Action Group field
  * @returns Action Status to set on the new Project Action record
  * @param actionGroup is the value from the Project Action record being copied
  */
  const getActionStatus = (actionGroup) => {
    log.debug('in getActionStatus', actionGroup);
    let actionStatusId;
    let searchParam = nRuntime.getCurrentScript().getParameter({
      name: 'custscript_bb_ss_action_status_search'
    });
    let search = nSearch.load({id: searchParam});
    let newFilter = ["AND", ["custrecord_bb_doc_status_package", "anyof", actionGroup]];  //Action Group
    let allFilters = search.filterExpression.concat(newFilter);
    search.filterExpression = allFilters;
    log.debug('search', search);
    search.run().each(function (result) {
      actionStatusId = result.getValue('internalid');
      log.debug('actionStatusId', actionStatusId);
      return true;
    });
    return actionStatusId;
  }

  /**
   * Creates copy of current Project Action record, set recurrence start date to new value after copy is complete
   * @param id is the internal id of the Project Action record to be copied
   * @param actionStatus is the 'Ready' value to set on new Project Action record for the Action Group
   * @param recurStartDate is the future date of the new copied record
   * @param paName formatted name field
  */
  const createCopyOfProjectAction = (id, actionStatus, recurStartDate, paName) => {
    log.debug('in createCopyOfProjectAction');
    let result;
    try {
      let record = nRecord.copy({
        type: 'customrecord_bb_project_action',
        id: id,
        isDynamic: true
      });
      record.setValue({fieldId: "name", value: paName});
      record.setValue({fieldId: "custrecord_bb_document_status", value: actionStatus}); //action status
      record.setValue({fieldId: "custrecord_bb_document_status_date", value: new Date()}); //action status date
      record.setValue({fieldId: "custrecord_bb_recurrence_start_date", value: recurStartDate});

      try {
        result = record.save();
      }
      catch (e) {
        log.error('error on save', e);
      }
      log.debug('result', result);
    }
    catch (error) {
      log.error('error in save copy of new record', error);
    }
  }
  /**
  * Creates new Project Action record in Ready status
  */
  const reduce = (context) => {
    log.debug('in reduce');
    let data = JSON.parse(context.values);
    log.debug('data', data);
    let recurFreq = data.recurFreq;
    let actionGroup = data.actionGroup;
    let actionStatus = getActionStatus(actionGroup);
    let newDate;
    let currentDate = new Date();
    let paName = 'PROJ-' + data.projectId + ' - ' + data.actionTemplate + ' - Recurring ' + data.revisionNbr;
    log.debug('paName', paName);
    switch (recurFreq) {
      case '1':
        newDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
        break;
      case '2':
        newDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
        break;
      case '3':
        newDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        break;
      case '4':
        newDate = new Date(currentDate.setMonth(currentDate.getMonth() + 3));
        break;
      case '5':
        newDate = new Date(currentDate.setMonth(currentDate.getMonth() + 6));
        break;
      case '6':
        newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
        break;
      case '7':
        newDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 2));
    }
    let newDateFormatted = nFormat.parse({value: newDate, type: nFormat.Type.DATE});

    createCopyOfProjectAction(data.id, actionStatus, newDateFormatted, paName);
  }

  /**
   * Function summarizes the map reduce process
   * @param summary
   */
    const summarize = (summary) => {
    log.debug('in summarize');
    summary.reduceSummary.errors.iterator().each(function (key, error) {
      log.error("Reduce Error for key: " + key, error);
      return true;
    });
    log.audit('SCRIPT END', '------------------------------');
  }

  return {
    getInputData: getInputData,
    reduce: reduce,
    summarize: summarize
  }
});