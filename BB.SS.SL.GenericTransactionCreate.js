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

define(['N/record', 'N/redirect'], function (recordModule, redirectModule) {

  const
    // https://blog.prolecto.com/2014/03/24/netsuite-transaction-type-internal-id-numbers/
    _typeMapping = {
      17: recordModule.Type.VENDOR_BILL
      , 7: recordModule.Type.INVOICE
      , 15: recordModule.Type.PURCHASE_ORDER
      , 31: recordModule.Type.SALES_ORDER
    }
    , _entityMapping = {
      17: 'custentity_bb_originator_vendor'
      , 7: 'custentity_bb_financier_customer'
    }
  ;

  function createTransaction(pats) {

    var
      _type = pats.getValue({fieldId: 'custrecord_bb_pats_transaction_type'})
      , _transaction
      , _projectId = pats.getValue({fieldId: 'custrecord_bb_pats_project'})
      , _itemId =  pats.getValue({fieldId: 'custrecord_bb_pats_item'})
      , _amount =  pats.getValue({fieldId: 'custrecord_bb_pats_amount_num'})
      , _projectActionId =  pats.getValue({fieldId: 'custrecord_bb_pats_project_action'})
      , _project = recordModule.load({type: 'job', id: _projectId})
    ;
    _type = _typeMapping[_type];
    _transaction = recordModule.create({
      type: _type,
      isDynamic: false
    });
    _transaction.setValue({fieldId: 'custbody_bb_project', value: _projectId});
    _transaction.setValue({fieldId: 'custbody_bb_project_action', value: _projectActionId});
    _transaction.setValue({fieldId: 'entity', value: pats.getValue({fieldId: 'custrecord_bb_pats_entity'})});
    _transaction.setValue({fieldId: 'subsidiary', value: _project.getValue({fieldId: 'subsidiary'})});
    _transaction.setValue({fieldId: 'location', value: _project.getValue({fieldId: 'custentity_bb_project_location'})});
    _transaction.insertLine({sublistId: 'item', line: 0});
    _transaction.setSublistValue({sublistId: 'item', line: 0, fieldId: 'item', value: _itemId});
    _transaction.setSublistValue({sublistId: 'item', line: 0, fieldId: 'amount', value: _amount});
    _transaction.setSublistValue({sublistId: 'item', line: 0, fieldId: 'rate', value: _amount});
    return _transaction.save({
      ignoreMandatoryFields: true
    });
  }

  function onRequest(context) {
    const
      _request = context.request
      , _response = context.response
      , _params = _request.parameters
    ;
    var
      _pats = _params.id
      , _soId = false
      , _type
    ;
    if (_pats) {
      // log.debug('_project', _project);
      // log.debug('_amount', _amount);
      // log.debug('_item', _item);
      // log.debug('_type', _type);
      _pats = recordModule.load({type: 'customrecord_proj_action_transaction_sch', id: _pats});
      _type = _pats.getValue({fieldId: 'custrecord_bb_pats_transaction_type'});
      _soId = createTransaction(_pats);
      if (_soId) {
        recordModule.submitFields({
          type: 'customrecord_proj_action_transaction_sch'
          , id: _pats.id
          , values: {
            custrecord_bb_pats_transaction: _soId
          }
        });

        redirectModule.toRecord({
          id: _soId
          , type: _typeMapping[_type]
          , isEditMode: true
        });
        return;
      }
      _response.write({
        output: JSON.stringify({
          pats: _params.id
        })
      });
    }


  }

  return {
    onRequest: onRequest
  };

});