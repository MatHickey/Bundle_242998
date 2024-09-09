/**
 * Copyright 2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 *
 * Version       Date               Author              Remarks
 * 1.00          11/14/2022         Santiago Ríos       Initial Commit
 *
 */

define(['N/search', 'N/record'], (search, record) => {

    const getInputData = (context) => {
        let logTitle = 'Get Input Data';
        try{
            let projectsToUpdate = [];
            let groupsToSearch = searchAccountGroups();
            if(groupsToSearch.length <= 0){
                log.audit(logTitle, 'There are no groups in the account or an error occurred when searching for them.');
                return [];
            }
            for (let i = 0; i < groupsToSearch.length; i++){
                projectsToUpdate = projectsToUpdate.concat(searchProjects(groupsToSearch[i].group, groupsToSearch[i].id, groupsToSearch[i].endDateField, groupsToSearch[i].startDateField));
            }
            if(projectsToUpdate.length <= 0){
                log.audit(logTitle, 'There are no projects to update or an error occurred when searching for them.');
                return [];
            }

            return projectsToUpdate;

        }catch(e){
            log.error(logTitle, e.message);
        }
    }

    const reduce = (context) => {
        let logTitle = 'Reduce';
        try{
            let mapResult = JSON.parse(context.values[0]);
            var objProjectActionRecord = record.load({
                type: 'customrecord_bb_project_action',
                id: mapResult.projectActionId,
                isDynamic: true,
            });
            objProjectActionRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            let traceData = {
                'Group': mapResult.groupName,
                'Project': mapResult.projectId,
                'UpdatedProjectAction': mapResult.projectActionId,
                'EndDate': mapResult.endDate
            }
            log.audit(logTitle, traceData);
        }catch(e){
            log.error(logTitle, e.message);
        }
    }

    const summarize = (context) => {
        let logTitle = 'Summarize';
    }

    const searchProjects = (groupName, groupId, endDateField, startDateField) => {
        let logTitle = 'searchProjects';
        try{
            let finalResult = [];
            let objProjectSearch = search.create({
                type: search.Type.JOB,
                filters:
                [
                    [endDateField,'isempty',''],
                    'AND',
                    //[startDateField,'isnotempty',''],
                    //'AND',
                    ['custrecord_bb_project.custrecord_bb_package','anyof',groupId],
                    'AND',
                    ['custrecord_bb_project.isinactive','is','F'],
                    'AND',
                    ['custrecord_bb_project.custrecord_bb_proj_doc_required_optional','anyof','1'],
                    'AND',
                    ['custentity_bb_project_status','anyof','@NONE@','2'],
                    'AND',
                    ['custentity_bb_cancellation_date','isempty',''],
                    'AND',
                    [['custentity_bb_install_scheduled_date','isempty',''],'OR',['custentity_bb_install_scheduled_date','onorafter','1/1/2022']],
                    'AND',
                    ['sum(formulanumeric: SUM(CASE WHEN {custrecord_bb_project.internalid} IS NOT NULL THEN 1 END) + SUM(CASE WHEN ({custrecord_bb_project.custrecord_bb_action_status_type.id} = 4) OR ({custrecord_bb_project.custrecord_bb_action_status_type.id} = 1 AND {custrecord_bb_project.custrecord_bb_proj_doc_required_optional.id} = 2) THEN -1 END))','equalto','0'],
                    'AND', 
                    ['sum(formulanumeric: SUM(CASE WHEN ({custrecord_bb_project.custrecord_bb_action_status_type.id} = 4 AND {custrecord_bb_project.custrecord_bb_proj_doc_required_optional.id} = 1) THEN 1 END))','greaterthan','0']
                ],
                columns:
                [
                    search.createColumn({
                        name: 'custrecord_bb_document_status_date',
                        join: 'CUSTRECORD_BB_PROJECT',
                        summary: 'MAX'
                    }),
                    search.createColumn({
                        name: 'internalid',
                        join: 'CUSTRECORD_BB_PROJECT',
                        summary: 'MAX'
                    }),
                    search.createColumn({
                        name: 'internalid',
                        summary: 'GROUP',
                        sort: search.Sort.ASC
                    }),
                    search.createColumn({
                        name: 'formulanumeric',
                        summary: 'SUM',
                        formula: 'SUM(CASE WHEN {custrecord_bb_project.internalid} IS NOT NULL THEN 1 END) + SUM(CASE WHEN ({custrecord_bb_project.custrecord_bb_action_status_type.id} = 4) OR ({custrecord_bb_project.custrecord_bb_action_status_type.id} = 1 AND {custrecord_bb_project.custrecord_bb_proj_doc_required_optional.id} = 2) THEN -1 END)'
                    }),
                    search.createColumn({
                        name: 'formulanumeric',
                        summary: 'SUM',
                        formula: 'SUM(CASE WHEN ({custrecord_bb_project.custrecord_bb_action_status_type.id} = 4 AND {custrecord_bb_project.custrecord_bb_proj_doc_required_optional.id} = 1) THEN 1 END)',
                        label: 'Formula (Numeric)'
                    })
                ]
            });
            objProjectSearch.run().each((result) => {
                let endDate = result.getValue({name: 'custrecord_bb_document_status_date', join: 'CUSTRECORD_BB_PROJECT', summary: 'MAX'});
                let projectActionId = result.getValue({name: 'internalid', join: 'CUSTRECORD_BB_PROJECT', summary: 'MAX'});
                let projectId = result.getValue({name: 'internalid', summary: 'GROUP'});
                finalResult.push({'projectId': projectId, 'projectActionId': projectActionId, 'endDate': endDate ? endDate : formatDate(new Date()), 'groupId': groupId, 'groupName': groupName, 'endDateField': endDateField});
                return true;
            });

            return finalResult;
        }catch(e){
            log.error(logTitle, e.message);
            return [];
        }
    }

    const searchAccountGroups = () => {
        let logTitle = 'searchAccountGroups';
        try{
            let finalResult = [];
            let objGroupsSearch = search.create({
                type: 'customrecord_bb_package',
                filters:
                [
                    ['isinactive','is','F']
                ],
                columns:
                [
                    search.createColumn('name'),
                    search.createColumn('internalid'),
                    search.createColumn('custrecord_bb_act_group_end_date_id'),
                    search.createColumn('custrecord_bb_act_group_start_date_id')
                ]
            });
            objGroupsSearch.run().each((result) => {
                let name = result.getValue('name');
                let id = result.getValue('internalid');
                let endDate = result.getValue('custrecord_bb_act_group_end_date_id');
                let startDate = result.getValue('custrecord_bb_act_group_start_date_id');
                finalResult.push({'group': name, 'id': id, 'endDateField': endDate, 'startDateField': startDate});
                return true;
            });

            return finalResult;
        }catch(e){
            log.error(logTitle, e.message);
            return [];
        }
    }

    const formatDate = (date) => {
        return [
            date.getMonth() + 1,
            date.getDate(),
            date.getFullYear(),
        ].join('/');
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    }
});