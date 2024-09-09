/**
 * SA-44630 SuiteScript Versioning Guidelines
 * SA-43522 SuiteScript 2.x JSDoc Validation
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 *
 * @description
 *
 * Created by David Smith on 6/29/2022
 *
 * @copyright 2022 Blue Banyan Solutions
 */

define(['N/log','N/runtime','N/record','N/query','N/format'], function (l,runtime,record, query, format) {

    /**
     * Definition of the Scheduled script trigger point.
     *
     * @governance XXX
     *
     * @param scriptContext
     *        {Object}
     * @param scriptContext.type
     *        {InvocationType} The context in which the script is executed. It
     *        is one of the values from the scriptContext.InvocationType enum.
     *
     * @return {void}
     *
     * @since 2015.2
     *
     * @static
     * @function execute
     */

    function execute(ctx) {
        /************** script parameters **************/
        var scriptObj = runtime.getCurrentScript();
        var prjAct = scriptObj.getParameter({name: "custscript_prj_action_id"});
        if (!prjAct) {
            //exit
            log.error('MISSING PARAM', 'custscript_prj_action_id is required');
            return;
        }
        /************** end script parameters **************/
        let prjQ = query.runSuiteQL({
            query: `SELECT name, custrecord_bb_project as project
                            from customrecord_bb_project_action 
                            where id=? 
                            AND isinactive='F'`,
            params: [prjAct]
        }).asMappedResults()[0];
        let prj=prjQ.project;
        if(!prj) {
            log.error('no project found on project action');
            return;
        }

        _logRecId = prjQ.name || prjAct;

        // check if "create" or old vs new updates

        // in case this is xedit we'll pull data with a query so we don't have issues with null data

        let paObj = query.runSuiteQL({
            query: `SELECT id,NVL(custrecord_bb_proj_action_duration,1) as duration,
                        custrecord_bb_proj_act_sch_end_date as end_date,
                        custrecord_bb_recurrence_start_date as start,
                        custrecord_bb_recurrence_start_date + NVL(custrecord_bb_proj_action_duration,1) as end,
                        custrecord_bb_projact_preced_proj_action as preaction
                        from customrecord_bb_project_action 
                        where id=? 
                        AND isinactive='F'`,
            params: [prjAct]
        }).asMappedResults()[0];
        log.debug('THIS PA',paObj);
        if(!paObj.start) return;
        // set this end if not already
        record.submitFields({
            type:'customrecord_bb_project_action',
            id:prjAct,
            values:{
                custrecord_bb_proj_act_exp_milestone_dt: paObj.end
            },
            options: {
                enablesourcing: false,
                ignoreMandatoryFields: true,
                disableTriggers: true
            }
        })
        log.debug('PA END DATE',paObj.end);

        let custTermsSql = `SELECT 
                      BUILTIN_RESULT.TYPE_INTEGER(customrecord_bb_adv_billing_milestone.ID) AS ID, 
                      regexp_replace(BUILTIN.DF(job_SUB.terms),'[^0-9]') as terms
                    FROM 
                      customrecord_bb_adv_billing_milestone, 
                      (SELECT 
                        JOB.ID AS ID, 
                        JOB.ID AS id_join, 
                        Customer.terms AS terms
                      FROM 
                        JOB, 
                        Customer
                      WHERE 
                        JOB.customer = Customer.ID(+)
                      ) job_SUB
                    WHERE 
                      customrecord_bb_adv_billing_milestone.custrecord_bb_abm_project = job_SUB.ID(+)
                       AND customrecord_bb_adv_billing_milestone.custrecord_bb_abm_project IN ('${prj}')
                    ORDER BY
                        ID DESC
                    FETCH NEXT 1 ROWS ONLY
                    `
        ;

            let _custTerms = query.runSuiteQL({
            query: custTermsSql,
            params: []
        }).asMappedResults()[0];
        _custTerms = _custTerms ? _custTerms.terms : 0;

        setAdvMilestone(prjAct, _custTerms, paObj.start, paObj.end);
        setAdvBillingMilestone(prjAct, _custTerms, paObj.start, paObj.end);

        // find any actions with this action as it's preceding ...
        let _nextAction = getNextAction(paObj,prj);
        while(_nextAction){
            log.debug('next',{next:_nextAction,pa:'customrecord_bb_project_action:'+_nextAction.id});

            let _newVals = {
                custrecord_bb_proj_act_exp_milestone_dt: _nextAction.end,
                custrecord_bb_recurrence_start_date: paObj.end
            }
            log.debug('new vals',_newVals);
            // set the next action's data
            record.submitFields({
                type:'customrecord_bb_project_action',
                id:_nextAction.id,
                values:_newVals,
                options: {
                    enablesourcing: false,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                }
            });

            setAdvMilestone(_nextAction.id, _custTerms, paObj.end, _nextAction.end);
            setAdvBillingMilestone(_nextAction.id, _custTerms, paObj.end, _nextAction.end);

            paObj = _nextAction;

            // find the next one after this
            _nextAction = getNextAction(_nextAction,prj);
        }
        log.debug('Remaining governance units',scriptObj.getRemainingUsage());
        log.debug('done');
    }

    function getNextAction(paObj,project){
        log.debug('paObj',[paObj,project]);
        if(!paObj) return null;

        // filter by action template ???
        // custrecord_bb_project_package_action = Prelim Milestone (1309)

        // this assumes a linear path
        // TODO: adjust for spider affect when more than one PA has the same preceding action
        let sql = `SELECT id, NVL(custrecord_bb_proj_action_duration,1) as duration,
                        TO_DATE ('${paObj.end}') as start,
                        TO_DATE ('${paObj.end}') + NVL(custrecord_bb_proj_action_duration,1) as end 
                        from customrecord_bb_project_action 
                        where custrecord_bb_projact_preced_proj_action=? 
                        AND isinactive='F'
                        AND custrecord_bb_project=?
                        AND custrecord_bb_projact_preced_proj_action != id
                        `;//AND custrecord_bb_proj_action_duration IS NOT NULL
        let _n = query.runSuiteQL({
            query: sql,
            params: [paObj.id,project]
        }).asMappedResults();
        log.debug('get next results',_n);
        let precedingAction = _n.length>0 ? _n[0] : null;
        // do not let it loop onto itself
        //if(precedingAction && precedingAction.id == paObj.id) precedingAction==null;
        return precedingAction;
    }

    function setAdvMilestone(paId, terms, start, end){
        // find the Advanced Milestone Schedule (customrecord_bbss_adv_sub_pay_schedule) with this PA
        // set the dates on that record too
        // let sql = `SELECT adv.id,
        //                  adv.custrecord_bbss_advmile_financier_list as cust,
        //                  regexp_replace(BUILTIN.DF(c.terms),'[^0-9]') as terms,
        //                  to_date('${end}')+regexp_replace(BUILTIN.DF(c.terms),'[^0-9]') as paydate
        //                from customrecord_bbss_adv_sub_pay_schedule adv
        //                left join customer c ON adv.custrecord_bbss_advmile_financier_list = c.id
        //                where
        //                  adv.isinactive='F'
        //                  AND adv.custrecord_bbss_advmile_financier_list is not null
        //                  AND custrecord_bbss_adv_subpay_proj_act_link=? `; //Project Action Link

        let sql = `SELECT id 
                    from customrecord_bbss_adv_sub_pay_schedule
                    where isinactive='F' 
                    AND custrecord_bbss_adv_subpay_proj_act_link=? `; //Project Action Link
        let _n = query.runSuiteQL({
            query: sql,
            params: [paId]
        }).asMappedResults();

        log.audit('Advanced Milestone Schedule',_n);
        if(_n){
            let payDate=addDays(end, terms);
            for(var n=0; n<_n.length; n++) {
                let values = {
                    custrecord_bbss_adv_start_date: start,
                    custrecord_bbss_adv_mile_date: end,
                    custrecord_bbss_adv_pay_date: payDate
                }
                record.submitFields({
                    type: 'customrecord_bbss_adv_sub_pay_schedule',
                    id: _n[n].id,
                    values: values,
                    options: {
                        enablesourcing: false,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });
            }
        }
    }

    function setAdvBillingMilestone(paId, terms, start, end){

        let sql = `SELECT id 
                    from customrecord_bb_adv_billing_milestone
                    where isinactive='F' 
                    AND custrecord_bb_abm_project_action_link=? `; //Project Action Link
        let _n = query.runSuiteQL({
            query: sql,
            params: [paId]
        }).asMappedResults();
        log.emergency('Advanced Billing Milestone',_n);
        if(_n){
            let payDate=addDays(end, terms);
            for(var n=0; n<_n.length; n++) {
                let values = {
                    custrecord_bb_abm_exp_start_date: start,
                    custrecord_bb_abm_exp_milestone_date: end,
                    custrecord_bb_abm_exp_milestone_pmt_date: payDate
                }
                record.submitFields({
                    type: 'customrecord_bb_adv_billing_milestone',
                    id: _n[n].id,
                    values: values,
                    options: {
                        enablesourcing: false,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });
            }
        }
    }

    function  addDays(start,duration){
        if(!start) return;
        if(!duration) return start;
        let d=new Date(start);
        d.setDate(d.getDate() + Number(duration));
        let endDt=format.format({
            value: d,
            type: format.Type.DATE
        });
        log.debug('add days',[start,duration,endDt,d])
        return endDt;
    }


    /* custom log to add the record ID to each log statement */
    /* requires N/log with var l in define */
    let _logRecId;
    const log = {
        debug: function () {
            l.debug(this.args(arguments));
        }
        , audit: function () {
            l.audit(this.args(arguments));
        }
        , error: function () {
            l.error(this.args(arguments));
        }
        , emergency: function () {
            l.emergency(this.args(arguments));
        }
        , args: function (a) {
            let _title = _logRecId ? _logRecId + ' ' : '',
                _details;
            if (util.isObject(a[0]) && a[0].title) {
                _title += a[0].title;
                _details = a[0].details ? a[0].details : '';
            } else {
                _title += a[0];
                _details = a[1];
            }
            return {title: _title, details: _details}
        }
    }

    return {
        execute: execute
    }
});