/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime'], function(record, search, runtime) {

    function afterSubmit(scriptContext){
        try {
            var trigger = scriptContext.type;
            var id = scriptContext.newRecord.id;
            var recordType = scriptContext.newRecord.type;
            switch (trigger) {
                case 'edit':


                    var projectRecord = record.load({
                        type:recordType,
                        id: id,
                        isDynamic: true
                    })
                    log.debug('internalid', projectRecord.id);
                    var ahjRecId = projectRecord.getValue({fieldId:'custentity_bb_auth_having_jurisdiction'});
                    log.debug('ahjRecId', ahjRecId);

                    var ahjRec = record.load({
                        type: 'customrecord_bb_auth_having_jurisdiction',
                        id: ahjRecId,
                        isDynamic : true
                    });
                    log.debug('ahjRec', ahjRec);

                    var PISearch = search.create({
                        type: "customrecord_bb_ss_project_interface",
                        filters:
                            [
                                ["custrecord_bb_pi_project.internalidnumber","equalto", id]
                            ],
                        columns:
                            [
                                search.createColumn({
                                    name: "internalid",
                                    label: "Internal ID"
                                }),
                                search.createColumn({
                                    name: "custrecord_bb_ss_pi_ahj_record",
                                    label: "NS AHJ Record"
                                }),
                            ]
                    });
                    PISearch.run().each(function(result){
                         var resultValues = result.getAllValues();
                         var piAHJ = resultValues.custrecord_bb_ss_pi_ahj_record
                            log.debug('result',result)
                           PIRecordId = result.id

                           piAHJRec = piAHJ[0].value;


                        return true;
                        });
                        if (ahjRecId == piAHJRec) {
                            log.debug('Same AHJ Rec', 'Same AHJ Rec');
                            return;
                        }

                    var data = {
                        ahjCode : ahjRec.getValue({fieldId:'custrecord_bb_ahj_code_uuid'}),
                        ahjName: ahjRec.getValue({fieldId:'name'}),
                        ahjBuildCode: ahjRec.getValue({fieldId:'custrecord_bb_ahj_building_code_text'}),
                        ahjBuildCodeNotes: ahjRec.getValue({fieldId:'custrecord_bb_ahj_bldg_code_notes_text'}),
                        ahjElectricCode: ahjRec.getValue({fieldId:'custrecord_bb_ahj_electric_code_text'}),
                        ahjElectricCodeNotes: ahjRec.getValue({fieldId:'custrecord_bb_ahj_elec_code_notes_text'}),
                        ahjFireCode: ahjRec.getValue({fieldId:'custrecord_bb_ahj_fire_code_text'}),
                        ahjFireCodeNotes: ahjRec.getValue({fieldId:'custrecord_bb_ahj_fire_code_notes_text'}),
                        ahjResCode: ahjRec.getValue({fieldId:'custrecord_bb_ahj_residential_code_text'}),
                        ahjResCodeNotes: ahjRec.getValue({fieldId:'custrecord_bb_ahj_res_codes_notes_text'}),
                        ahjWindCode: ahjRec.getValue({fieldId:'custrecord_bb_ahj_wind_code_text'}),
                        ahjWindCodeNotes: ahjRec.getValue({fieldId:'custrecord_bb_ahj_wind_code_notes_text'}),
                        ahjFileFolder: ahjRec.getValue({fieldId:'custrecord_bb_ahj_file_folder_url_link'}),
                        ahjUrl: ahjRec.getValue({fieldId:'custrecord_bb_pi_ahj_url'}),
                        ahjDescription: ahjRec.getValue({fieldId:'custrecord_bb_ahj_description_text'}),
                        ahjLevelCode: ahjRec.getValue({fieldId:'custrecord_bb_ahj_level_code_num'}),
                        ahjDataSourceComments: ahjRec.getValue({fieldId:'custrecord_bb_ahj_datasourcecomment_text'}),
                        ahjResCodeNotes: ahjRec.getValue({fieldId:'custrecord_bb_pi_ahj_residentialcodenote'}),
                        ahjID: ahjRec.getValue({fieldId:'custrecord_bb_ahj_id_uuid'}),
                        ahjDocSub: ahjRec.getValue({fieldId:'custrecord_bb_ahj_doc_sub_method_text'}),
                        ahjDocSubNotes: ahjRec.getValue({fieldId:'custrecord_bb_ahj_docsubmeth_notes_text'}),
                    };

                    log.debug('data', data);

                    record.submitFields({
                        type:'customrecord_bb_ss_project_interface',
                        id: PIRecordId,
                        values: {
                            'custrecord_bb_pi_ahj_ahjid' : data.ahjID,
                            'custrecord_bb_pi_ahj_ahjcode_txt': data.ahjCode,
                            'custrecord_bb_pi_ahj_ahjname_txt': data.ahjName,
                            'custrecord_bb_ahj_building_code_text': data.ahjBuildCode,
                            'custrecord_bb_ahj_bldg_code_notes_text': data.ahjBuildCodeNotes,
                            'custrecord_bb_ahj_electric_code_text': data.ahjElectricCode,
                            'custrecord_bb_ahj_elec_code_notes_text': data.ahjElectricCodeNotes,
                            'custrecord_bb_ahj_fire_code_text': data.ahjFireCode,
                            'custrecord_bb_ahj_fire_code_notes_text': data.ahjFireCode,
                            'custrecord_bb_ahj_residential_code_text': data.ahjResCode,
                            'custrecord_bb_ahj_res_codes_notes_text': data.ahjResCodeNotes,
                            'custrecord_bb_ahj_wind_code_text': data.ahjWindCode,
                            'custrecord_bb_ahj_wind_code_notes_text': data.ahjWindCodeNotes,
                            'custrecord_bb_ahj_file_folder_url_link': data.ahjFileFolder,
                            'custrecord_bb_ahj_doc_sub_method_text': data.ahjDocSub,
                            'custrecord_bb_ahj_docsubmeth_notes_text': data.ahjDocSubNotes,
                            'custrecord_bb_ahj_description_text': data.ahjDescription,
                            'custrecord_bb_ahj_level_code_num': data.ahjLevelCode,
                            'custrecord_bb_ahj_datasourcecomment_text': data.ahjDataSourceComments,
                            'custrecord_bb_ss_pi_ahj_record': ahjRecId
                        }
                    });


            }
        } catch (e) {
            log.error(e.name, e);
        }
    }


    return {
        afterSubmit: afterSubmit
    };

});
