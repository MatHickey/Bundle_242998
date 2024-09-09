/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime'], function(record, search, runtime) {

    function beforeLoad(scriptContext){
        try {
            var trigger = scriptContext.type;
            log.debug('trigger', trigger);
            switch (trigger) {
                case 'create':
                    log.debug('new record', scriptContext.newRecord);
                    var message = scriptContext.newRecord;
                    var entityType = scriptContext.newRecord.getValue({fieldId: 'entitytype'});
                    var entityId = scriptContext.newRecord.getValue({fieldId: 'entity'});
                    log.audit('entityType', entityType);
                    log.audit('entityId', entityId);
                    if (entityType == 'custjob') {
                        var homeownerEmail = getHomeownerEmail(entityId);
                        if (homeownerEmail) {
                            log.audit('homeownerEmail', homeownerEmail);
                            message.setValue({
                                fieldId: 'recipientemail',
                                value: homeownerEmail
                            });
                        }
                        var copyRecipients = getCopyRecipients(entityId);
                        if (copyRecipients.length > 0){
                          for(var x = 0; x < copyRecipients.length; x++){
                            message.setSublistValue({sublistId: 'otherrecipientslist', line: x, fieldId: 'email', value: copyRecipients[x]});
                            message.setSublistValue({sublistId: 'otherrecipientslist', line: x, fieldId: 'cc', value: true});
                          }   
                        }
                      log.debug('cc',message);
                    }
                break;
            }
        } catch (e) {
            log.error('error setting email address on email popup record', e);
        }
    }

    function getHomeownerEmail(projectId) {
        var  homeownerEmail = null;
        var jobSearchObj = search.create({
            type: "job",
            filters:
                [
                    ["internalid","anyof", projectId]
                ],
            columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "custentity_bb_home_owner_primary_email", label: "Homeowner Email"})
                ]
        });
        var result = jobSearchObj.run().getRange({start:0, end:1});
        if (result.length > 0) {
            homeownerEmail = result[0].getValue({name: 'custentity_bb_home_owner_primary_email'})
        }
        return homeownerEmail;
    }

    function getCopyRecipients(projectId){
      var copyRecipients = [];
      var spouseLookup = search.lookupFields({
          type: search.Type.JOB,
          id: projectId,
          columns: ['custentity_bb_home_owner_alt_email']
        });
      var spouseEmail = spouseLookup.custentity_bb_home_owner_alt_email;
      if (spouseEmail){
        copyRecipients.push(spouseEmail);
      }
      return copyRecipients;
    }

    return {
        beforeLoad: beforeLoad
    };

});
