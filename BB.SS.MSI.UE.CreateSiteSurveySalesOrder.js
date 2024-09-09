/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *
 * Deployed to Project Action
 */
define([
  'N/record',
  'N/search',
  'N/runtime',
  'N/https',
  'N/url',
  'N/error',

  './BB SS/SS Lib/BB_SS_MD_SolarConfig'
], function (
  record,
  search,
  runtime,
  https,
  url,
  error,

  bConfig) {

  function afterSubmit(context) {
    if (context.type == 'delete') return;
    log.debug('context', context);
    var typeparam = runtime.getCurrentScript().getParameter({ name: 'custscript_bb_sitesurveyordrtype' });
    var oldAction = context.oldRecord;
    var action = record.load({
      type: context.newRecord.type,
      id: context.newRecord.id
    });
    var actionid = context.newRecord.id;
    log.debug('action', action);

    // check the status - when ready, create the sales order for MSI
    var status = action.getValue({ fieldId: 'custrecord_bb_document_status' });
    var oldStatus = oldAction ? oldAction.getValue({ fieldId: 'custrecord_bb_document_status' }) : '';

    if (oldStatus == status) {
      // exit if status hasn't changed
      log.debug('status has not changed', { old: oldStatus, now: status });
      return;
    }

    var packageaction = action.getValue({ fieldId: 'custrecord_bb_project_package_action' });
    var projectid = action.getValue({ fieldId: 'custrecord_bb_project' });
    log.debug('project id', projectid + ' package action ' + packageaction);
    if (!packageaction) {
      log.error('No Package Action');
      return;
    }
    var packageitem;
    var templateparam;
    var customrecord_bb_package_taskSearchObj = search.create({
      type: "customrecord_bb_package_task",
      filters:
        [
          ["custrecord_bb_pkg_action_item.custitem_msi_inspection", "noneof", "@NONE@"],
          "AND",
          ["internalid", "is", packageaction]
        ],
      columns:
        [
          search.createColumn({ name: "custrecord_bb_pkg_action_item", label: "Action Item" }),
          search.createColumn({
            name: "custitem_msi_inspection",
            join: "CUSTRECORD_BB_PKG_ACTION_ITEM",
            label: "MSI Inspection Record"
          }),
          // search.createColumn({
          //     name: "custitem_msi_servicetemplate",
          //     join: "CUSTRECORD_BB_PKG_ACTION_ITEM",
          //     label: "MSI Service Template"
          // }),
          search.createColumn({
            name: "custitem_bb_msi_create_order_status",
            join: "CUSTRECORD_BB_PKG_ACTION_ITEM"
          })
        ]
    });
    var searchResultCount = customrecord_bb_package_taskSearchObj.runPaged().count;
    log.debug("customrecord_bb_package_taskSearchObj result count", searchResultCount);
    if (searchResultCount == 0) {
      log.debug('no action item', 'returning');
      return;
    }
    var createOrder = false;
    var statusToCreate = '';
    customrecord_bb_package_taskSearchObj.run().each(function (result) {
      packageitem = result.getValue('custrecord_bb_pkg_action_item');
      templateparam = result.getValue({
        name: "custitem_msi_servicetemplate",
        join: "CUSTRECORD_BB_PKG_ACTION_ITEM"
      })
      log.debug('template param', templateparam);
      statusToCreate = result.getValue({
        name: "custitem_bb_msi_create_order_status",
        join: "CUSTRECORD_BB_PKG_ACTION_ITEM"
      });
      if (statusToCreate == status) createOrder = true;
      return true;
    });

    if (!createOrder) {
      log.debug('exiting because of status', { statusToCreate: statusToCreate, status: status })
      return false;
    }

    // check for a sales order existing
    var transactionSearchObj = search.create({
      type: "transaction",
      filters: [["mainline", "is", "F"], "AND", ["custcol_bb_ss_proj_action.internalid", "anyof", actionid]],
      columns: ["internalid"]//["custcol_bb_ss_proj_action","tranid"]
    });
    var searchResultCount = transactionSearchObj.runPaged().count;
    if (searchResultCount > 0) {
      log.debug('exiting because sales order already created');
      return false;
    }

    if (packageitem && projectid) {
      try {
        var params = {
          projectid: projectid,
          packageitem: packageitem,
          typeparam: typeparam,
          actionid: actionid,
          templateparam: templateparam
        }
        log.debug('create survey sales order', params);
        //Update 14 Dec 2022: Request to move all the Survey Sales Order creation logic from the Suitelet into the User Event
        var salesOrderID = createSurveySalesOrder(params);
        log.audit('salesorder id', salesOrderID);

        /*In case we need to roll back uncomment below block of code and remove line: var salesOrderID = createSurveySalesOrder(params);
        var createOrderUrl = url.resolveScript({
            scriptId: 'customscript_bbss_msi_create_surveyorder',
            deploymentId: 'customdeploy_bbss_msi_create_surveyorder',
            returnExternalUrl: true,
            params: params
        });
        log.debug('suitelet url',createOrderUrl);
        var req = https.get({
            url: createOrderUrl
        });
        log.debug('SL response',req);
        var resp = JSON.parse(req.body);
        if(resp.success)
            log.audit('salesorder:'+resp.id);
        else
            log.error('Order Error',resp.error);*/
      } catch (e) {
        log.error(e.name, e.message);
      }
    }

  }

  function getItemData(itemId) {
    var lookup = search.lookupFields({
      type: 'item',
      id: itemId,
      columns: ['custitem_fsa_estimated_job_duration1', 'custitem_fsa_job_type']
    });

    return {
      type: (lookup) ? lookup.custitem_fsa_job_type : null,
      duration: (lookup) ? lookup.custitem_fsa_estimated_job_duration1 : null
    }
  }

  //New function that actually creastes the Survey Sales Order
  function createSurveySalesOrder(params) {
    var projectid = params.projectid;
    var packageitem = params.packageitem;
    var typeparam = params.typeparam;
    var actionid = params.actionid;
    var templateparam = params.templateparam;
    var syncFields = bConfig.getConfigurations(['custrecord_fsa_check_so_sync_field']).custrecord_fsa_check_so_sync_field.value;

    log.debug('syncFields', syncFields);

    log.debug('create survey sales order', {
      projectid: projectid,
      packageitem: packageitem,
      typeparam: typeparam,
      actionid: actionid
    });

    if (isEmpty(projectid) || isEmpty(packageitem) || isEmpty(typeparam) || isEmpty(actionid)) {
      throw error.create({
        name: 'MISSING_PARAM',
        message: 'One of the required parameters is missing to create this order.',
        notifyOff: false
      });
    }

    log.debug('rec', rec);

    log.debug('package item', packageitem);
    if (isEmpty(packageitem)) {
      log.error('no package item found');
      return;
    }

    var fieldLookUp = search.lookupFields({
      type: record.Type.JOB,
      id: projectid,
      columns: ['custentity_bb_financier_customer', 'custentity_bb_project_location', 'subsidiary']
    });
    var custentity_bb_financier_customer = fieldLookUp.custentity_bb_financier_customer[0] ? fieldLookUp.custentity_bb_financier_customer[0].value : '';
    var location = fieldLookUp.custentity_bb_project_location[0] ? fieldLookUp.custentity_bb_project_location[0].value : '';
    var subsidiary = fieldLookUp.subsidiary[0] ? fieldLookUp.subsidiary[0].value : '';

    log.debug('custentity_bb_financier_customer', custentity_bb_financier_customer);
    var rec = record.create({
      type: record.Type.SALES_ORDER,
      isDynamic: true
    });

    rec.setValue('entity', custentity_bb_financier_customer);
    rec.setValue({ fieldId: 'location', value: location });
    rec.setValue({ fieldId: 'custbody_bb_order_type', value: typeparam });

    if (!isEmpty(templateparam)) {
      rec.setValue({ fieldId: 'custbodyservicetemplate', value: templateparam });
    };

    log.debug('packageitem', packageitem);
    rec.setValue({ fieldId: 'custbody_bb_project', value: projectid });
    rec.selectNewLine({ sublistId: 'item' });

    rec.setCurrentSublistValue({
      sublistId: 'item',
      fieldId: 'item',
      value: packageitem
    });
    rec.setCurrentSublistValue({
      sublistId: 'item',
      fieldId: 'amount',
      value: 0
    });
    rec.setCurrentSublistValue({
      sublistId: 'item',
      fieldId: 'custcol_bb_ss_proj_action',
      value: actionid
    });
    rec.setCurrentSublistValue({
      sublistId: 'item',
      fieldId: 'subsidiary',
      value: subsidiary
    });
    rec.setCurrentSublistValue({
      sublistId: 'item',
      fieldId: 'location',
      value: location
    });
    rec.commitLine({
      sublistId: 'item'
    });

    rec.setValue({ fieldId: 'custbodysendtoservicepro', value: true });

    //Update 14 Dec 2022, checkin custbody_f4n_sync checkbox when creating Survey Sales Orders
    if (syncFields) {
      rec.setValue('custbody_f4n_sync', true);

      var itemData = getItemData(packageitem);

      log.debug('itemdata', itemData);

      itemData.type && rec.setValue('custbody_f4n_job_type', itemData.type);
      itemData.duration && rec.setValue('custbody_f4n_duration', itemData.duration);
    }

    var soid = rec.save();
    log.debug('salesorder:' + soid, "saved");
    // try to bind file from webpartner record related to project to sales order
    if (!isEmpty(soid)) {
      // get the document link for all the project actions public view
      var extDocLinkUrl = url.resolveScript({
        scriptId: 'customscript_bbss_msi_survey_puplic_docs',
        deploymentId: 'customdeploy_bbss_msi_survey_puplic_docs',
        returnExternalUrl: true,
        params: { "soid": soid }
      });
      log.debug('extDocLinkUrl', extDocLinkUrl);
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: soid,
        values: {
          custbody_bb_msi_doc_links: extDocLinkUrl
        },
        options: {
          enableSourcing: false,
          ignoreMandatoryFields: true
        }
      });

      record.submitFields({
        type: 'customrecord_bb_project_action',
        id: actionid,
        values: {
          custrecord_fsa_related_so: soid
        }
      });
    }

    return soid;
  }

  function isEmpty(stValue) {
    return ((stValue === '' || stValue == null || false) || (stValue.constructor === Array && stValue.length === 0) || (stValue.constructor === Object && (function (v) {
      for (var k in v)
        return false;
      return true;
    })(stValue)));
  };

  return {
    afterSubmit: afterSubmit
  }
});