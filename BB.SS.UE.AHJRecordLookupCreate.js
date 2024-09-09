/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime'], function(record, search, runtime) {
    function isValidURL(string) {
      var result = /^((http|https|ftp):\/\/(www\.)?|www\.)[a-zA-Z0-9\_\-]+\.([a-zA-Z]{2,4}|[a-zA-Z]{2}\.[a-zA-Z]{2})(\/[a-zA-Z0-9\-\._\?\&=,'\+%\$#~]*)*$/.test(string)
        //log.debug('Valid URL Result', result);
        return result;
    };

    function afterSubmit(scriptContext){
        try {
            var trigger = scriptContext.type;
            var id = scriptContext.newRecord.id;
            var recordType = scriptContext.newRecord.type;
            switch (trigger) {
                case 'edit':


                    var piRecord = record.load({
                        type:recordType,
                        id: id,
                        isDynamic: true
                    })
                    //log.debug('internalid', piRecord.id);
                    var ahjID = piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_ahjid'});
                    //var nsAHJRec = piRecord.getValue({fieldId:'custrecord_bb_ss_pi_ahj_record'});
                    if (!ahjID){
                        break;
                    }

                    var ahjRecSearch = search.create({
                        type: 'customrecord_bb_auth_having_jurisdiction',
                        columns: ['custrecord_bb_ahj_id_uuid'],
                        filters: [['custrecord_bb_ahj_id_uuid', 'is', ahjID]]
                    });
                    //log.debug('AHJ ID', ahjID);
                    var ahjRecordId;
                    ahjRecSearch.run().each(function(result){
                        //log.debug('result',result)
                        ahjRecordId = result.id
                        return true;
                    });
                    //log.debug('ahjRecordId', ahjRecordId);

                    if(ahjRecordId){
                        piRecord.setValue({
                           fieldId: 'custrecord_bb_ss_pi_ahj_record',
                            value : ahjRecordId
                        });
                        piRecord.save();

                    }
                    if(!ahjRecordId){
                        /*
                            Collect AHJ Values from PI
                         */
                        var ahjData = {
                            ahjCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_ahjcode_txt'}),
                             ahjName: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_ahjname_txt'}),
                             ahjBuildCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_buildingcode_txt'}),
                             ahjBuildCodeNotes: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_buildingcodenotes_t'}),
                             ahjElectricCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_electriccode_txt'}),
                             ahjElectricCodeNotes: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_electriccodenotes_t'}),
                             ahjFireCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_firecode_txt'}),
                             ahjFireCodeNotes: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_firecodenotes_txt'}),
                             ahjResCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_residentialcode_txt'}),
                             ahjWindCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_windcode_txt'}),
                             ahjWindCodeNotes: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_windcodenotes_txt'}),
                             ahjFileFolder: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_filefolderurl_url'}),
                             ahjUrl: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_url'}),
                             ahjDescription: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_description_long'}),
                             ahjLevelCode: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_ahjlevelcode_num'}),
                             ahjDataSourceComments: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_datasourcecomments'}),
                             ahjResCodeNotes: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_residentialcodenote'}),
                             ahjID: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_ahjid'}),
                             ahjDocSub: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_docsubmethod_txt'}),
                             ahjDocSubNotes: piRecord.getValue({fieldId:'custrecord_bb_pi_ahj_docsubmethodnotes_t'}),
                             ahjState: piRecord.getValue({fieldId:'custrecord_bb_pi_install_state'}),
                        }
                        //log.debug('ahjData', ahjData);

                        /*
                        Create AHJ for corresponding AHJ ID
                         */
                        var newAhjRecord = record.create({
                            type: 'customrecord_bb_auth_having_jurisdiction'
                            , isDynamic: true
                        })
                        newAhjRecord.setValue({fieldId:'name',value:ahjData.ahjName});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_code_uuid', value:ahjData.ahjCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_building_code_text', value:ahjData.ahjBuildCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_bldg_code_notes_text', value:ahjData.ahjBuildCodeNotes});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_electric_code_text',value:ahjData.ahjElectricCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_elec_code_notes_text',value:ahjData.ahjElectricCodeNotes});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_fire_code_text',value:ahjData.ahjFireCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_fire_code_notes_text',value:ahjData.ahjFireCodeNotes});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_residential_code_text', value:ahjData.ahjResCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_res_codes_notes_text',value:ahjData.ahjResCodeNotes});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_id_uuid',value:ahjData.ahjID});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_wind_code_text',value:ahjData.ahjWindCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_wind_code_notes_text',value:ahjData.ahjWindCodeNotes});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_doc_sub_method_text',value:ahjData.ahjDocSub});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_docsubmeth_notes_text',value:ahjData.ahjDocSubNotes});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_description_text',value:ahjData.ahjDescription});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_level_code_num',value:ahjData.ahjLevelCode});
                        newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_datasourcecomment_text',value:ahjData.ahjDataSourceComments});
                        newAhjRecord.setValue({fieldId:'custrecord_tsp_muni_state',value:ahjData.ahjState});

                        /*
                        Testing File Folder field as for valid URL, if valid sets field in AHJ Record, if invalid does not set field in AHJ Record.
                         */
                        var string = ahjData.ahjFileFolder;
                        var res = isValidURL(string)
                        //log.debug('res',res)
                        if(res == true){
                            newAhjRecord.setValue({fieldId:'custrecord_bb_ahj_file_folder_url_link', value:ahjData.ahjFileFolder});
                            var ahjRecordId = newAhjRecord.save();

                            piRecord.setValue({
                                fieldId: 'custrecord_bb_ss_pi_ahj_record',
                                value : ahjRecordId
                            });
                            piRecord.save();
                        }else {
                            var ahjRecordId = newAhjRecord.save();

                            piRecord.setValue({
                                fieldId: 'custrecord_bb_ss_pi_ahj_record',
                                value : ahjRecordId
                            });
                            piRecord.save();
                        }


                    }
                    /*
                    Sets AHJ Record to AHJ Field in Project Record
                     */
                    var project = piRecord.getValue({fieldId:'custrecord_bb_pi_project'})
                    //log.debug('project', project);
                    if(!project){
                        return;
                    }
                    record.submitFields({
                        type:record.Type.JOB,
                        id: project,
                        values: {
                            'custentity_bb_auth_having_jurisdiction' : ahjRecordId
                        }
                    });
                    break;
            }
        } catch (e) {
            log.error(e.name, e);
        }
    }


    return {
        afterSubmit: afterSubmit
    };

});
