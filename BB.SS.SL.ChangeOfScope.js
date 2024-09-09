/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Michael Golichenko
 * @overview - Change of Scope suitelet form
 */


define(['N/record', 'N/search', 'N/redirect', 'N/ui/serverWidget', 'N/runtime', './BB SS/SS Lib/BB.SS.ProjectAction.Service', './BB SS/SS Lib/BB.SS.ProjectAction.Model'],
    function(record, search, redirect, serverWidget, runtime, projectActionService, projectActionModel) {



      /**
       * Definition of the Suitelet script trigger point.
       *
       * @param {Object} context
       * @param {ServerRequest} context.request - Encapsulation of the incoming request
       * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
       * @Since 2015.2
       */
      function onRequest(context) {
        if (context.request.method === 'GET') {
          var _projectId = context.request.parameters.project;

          var _form = serverWidget.createForm({
            title: 'Project Change of Scope'
          });
          var _projectField = _form.addField({
            id: 'custpage_project',
            label: 'Project',
            type: serverWidget.FieldType.SELECT,
            source: 'job'
          });
          _projectField.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.INLINE
          });
          var _socReasonField = _form.addField({
            id: 'custpage_soc_reason',
            type: serverWidget.FieldType.SELECT,
            label: 'Change of Scope Reason',
            source: 'customlist_bb_cos_reason'
          });
          _socReasonField.isMandatory = true;
          var _socReasonCommentField = _form.addField({
            id: 'custpage_soc_reason_comment',
            type: serverWidget.FieldType.TEXTAREA,
            label: 'Change of Scope Reason Comment'
          });
          _socReasonCommentField.isMandatory = true;

          var _packageSublist = _form.addSublist({
            id: 'custpage_packages_list',
            type: serverWidget.SublistType.LIST,
            label: 'Packages'
          });
          var _packageId = _packageSublist.addField({
            id: 'custpage_package_id',
            type: serverWidget.FieldType.INTEGER,
            label: 'Package ID'
          });
          _packageId.updateDisplayType({
            displayType : serverWidget.FieldDisplayType.HIDDEN
          });
          var _selectPackageField = _packageSublist.addField({
            id: 'custpage_select_package',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Select'
          });
          var _packageNameField = _packageSublist.addField({
            id: 'custpage_package_name',
            type: serverWidget.FieldType.TEXT,
            label: 'Name'
          });
          var _packageRejectionReasonField = _packageSublist.addField({
            id: 'custpage_rejection_reason',
            type: serverWidget.FieldType.SELECT,
            label: 'Rejection Reason',

          });
          _packageRejectionReasonField.addSelectOption({
            text: '',
            value: ''
          });
          _form.addSubmitButton({
            label: 'Submit Change of Scope'
          });

          var _searchActionPackages = search.create({
            type: 'customrecord_bb_project_action',
            filters:
                [
                  ['isinactive', search.Operator.IS, 'F'],
                  'AND',
                  ['custrecord_bb_project', search.Operator.ANYOF, _projectId]
                ],
            columns: [
                'custrecord_bb_document_status',
                search.createColumn({
                  name: 'internalid',
                  join: 'custrecord_bb_package'
                }),
                search.createColumn({
                  name: 'custrecord_bb_package'
                }),
                //custrecord_bb_document_status
                search.createColumn({
                  name: 'custrecord_bb_doc_status_type',
                  join: 'custrecord_bb_document_status'
                })
            ]
          });
          // only use internal and submitted status type filter
          _searchActionPackages.filters.push(search.createFilter({
            name: 'custrecord_bb_doc_status_type',
            join: 'custrecord_bb_document_status',
            operator: search.Operator.ANYOF,
            values: [2, 3, 4]
          }));
          var _actionPackagesData = [];
          _searchActionPackages.run().each(function(result){
            var _id = result.getValue({name: 'internalid', join: 'custrecord_bb_package'});
            var _packageName = result.getText({name: 'custrecord_bb_package'});
            var _notInList = _actionPackagesData.filter(function(d){
              return d.id === _id;
            }).length === 0;
            if(_notInList){
              _actionPackagesData.push({id: _id, name: _packageName});
            }
            return true;
          });

          var _searchRejectionReason = search.create({
            type: 'customrecord_bb_rejection_reason',
            filters:
                [
                  ['isinactive', search.Operator.IS, 'F']
                ],
            columns: [
              'name',
              'custrecord_bb_rej_package'
            ]
          });

          _searchRejectionReason.run().each(function(rejection){
            var _name = rejection.getValue({name: 'name'});
            var _packageId = rejection.getValue({name: 'custrecord_bb_rej_package'});
            _packageRejectionReasonField.addSelectOption({
              text: _name,
              value: [_packageId, rejection.id].join('_')
            });
            return true;
          });


          _projectField.defaultValue = _projectId;
          _actionPackagesData.forEach(function(package, idx){
            _packageSublist.setSublistValue({id: 'custpage_package_id', line: idx, value: package.id});
            _packageSublist.setSublistValue({id: 'custpage_package_name', line: idx, value: package.name});
          });

          _form.clientScriptModulePath = './BB.SS.CS.ChangeOfScope';

          context.response.writePage(_form);

        } else if(context.request.method === 'POST') {

          var _recordData = context.request;
          var _projectId = _recordData.parameters.custpage_project;
          var _reason = _recordData.parameters.inpt_custpage_soc_reason;
          var _reasonId = _recordData.parameters.custpage_soc_reason;
          var _comment = _recordData.parameters.custpage_soc_reason_comment;
          var _rejectComment = [_reason, _comment].join(' - ');
          var _selectedPackages = [];
          var _selectedPackageIds = [];
          // var _status = projectActionService.getDocumentStatusByName('^rejected .* reviewer$');
          var _lineCount = _recordData.getLineCount({
            group: 'custpage_packages_list'
          });
          for (var i = 0; i < _lineCount; i++) {
            var _id = _recordData.getSublistValue({
              group: 'custpage_packages_list',
              name: 'custpage_package_id',
              line: i
            });
            var _selected = _recordData.getSublistValue({
              group: 'custpage_packages_list',
              name: 'custpage_select_package',
              line: i
            });
            var _rejectionReasonId = _recordData.getSublistValue({
              group: 'custpage_packages_list',
              name: 'custpage_rejection_reason',
              line: i
            });

            if(/T/i.test(_selected)){
              _rejectionReasonId = _rejectionReasonId.split('_')[1];
              _selectedPackages.push({id: _id, rejectionReasonId: _rejectionReasonId});
            }
          }
          _selectedPackageIds = _selectedPackages.map(function(v){
            return v.id;
          });

          var _searchProjActions = search.create({
            type: 'customrecord_bb_project_action',
            filters:
                [
                  ['isinactive', search.Operator.IS, 'F'],
                  'AND',
                  ['custrecord_bb_project', search.Operator.ANYOF, _projectId]
                ],
            columns: [
              search.createColumn({
                name: 'internalid',
                join: 'custrecord_bb_package'
              }),
              search.createColumn({
                name: 'custrecord_bb_doc_status_type',
                join: 'custrecord_bb_document_status'
              })
            ]
          });
          _searchProjActions.filters.push(search.createFilter({
            name: 'internalid',
            join: 'custrecord_bb_package',
            operator: search.Operator.ANYOF,
            values: _selectedPackageIds
          }));
          // only use internal and submitted status type filter
          _searchProjActions.filters.push(search.createFilter({
            name: 'custrecord_bb_doc_status_type',
            join: 'custrecord_bb_document_status',
            operator: search.Operator.ANYOF,
            values: [2, 3, 4]
          }));

          var _projectActionsToProcess = [];
          _searchProjActions.run().each(function(result){
            var _packageId = result.getValue({name: 'internalid', join: 'custrecord_bb_package'});
            log.debug('_packageId', _packageId);
            var _statusTypeId = result.getValue({name: 'custrecord_bb_doc_status_type', join: 'custrecord_bb_document_status'});

            var _documentStatus = projectActionService.getDocumentStatusByPackageAndStatusType(_packageId, 5); // status type id = 5
            log.debug('_documentStatus', _documentStatus);
            var _selectedPackage = _selectedPackages.filter(function(v){
              return v.id === _packageId;
            })[0];
            log.debug('_selectedPackage', _selectedPackage);
            _statusTypeId = parseInt(_statusTypeId);
            _statusTypeId = isNaN(_statusTypeId) ? -1 : _statusTypeId;
            log.debug('_statusTypeId', _statusTypeId);
            switch (_statusTypeId) {
              case 2:
              case 3:
                if(_selectedPackage){
                  _projectActionsToProcess.push({id: result.id, rejectionReasonId: _selectedPackage.rejectionReasonId, docStatus: _documentStatus});
                }
                break;
              case 4:
                _projectActionsToProcess.push({id: result.id});
                break;
            }
            return true;
          });

          log.debug('_projectActionsToProcess', _projectActionsToProcess);

          _projectActionsToProcess.forEach(function(r){
            var _projectActionRec = record.load({
              type: projectActionModel.Type,
              id: r.id
            });
            projectActionService.createNewRevision(_projectActionRec);
            if(r.rejectionReasonId){
              _projectActionRec.setValue({fieldId: 'custrecord_bb_document_status', value: r.docStatus});
              _projectActionRec.setValue({fieldId: 'custrecord_bb_rejection_reason', value: r.rejectionReasonId});
              _projectActionRec.setValue({fieldId: 'custrecord_bb_rejection_comments', value: _rejectComment});
            }
            _projectActionRec.setValue({fieldId: 'isinactive', value: true});
            _projectActionRec.save();
          });

          // update project fields
          record.submitFields({
            type: record.Type.JOB,
            id: _projectId,
            values: {
              'custentity_bb_change_of_scope_reason': _reasonId,
              'custentity_bb_change_of_scope_date': (new Date()),
              'custentity_bb_change_of_scope_comments': _comment
            }
          });


          redirect.toRecord({
            id: _projectId,
            type: record.Type.JOB,
            isEditMode: false
          });
        }
      }


      return {
        onRequest: onRequest
      };
    });