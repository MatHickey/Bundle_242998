/**
 *@NApiVersion 2.1
 *@author
 *@NScriptType MapReduceScript
 *@author Suhail Akhtar
 */

define(['N/record', 'N/search', 'N/runtime','./BB.MD.JournalEntryCreation.js'],
    function (record, search, runtime, jeModule) {

        /**
         */
        function getInputData() {
            var arr = runtime.getCurrentScript().getParameter({
                name: 'custscript_bbss_comm_array'
            });

            log.debug('array', arr);
            var array = JSON.parse(arr);

            return array;
        }

        /**
         * Function call API modules and Energy production creation Modules to get the energy produced data and create respective records
         * @param context
         */
        function map(context) {
            log.debug('context', context);
            var obj = JSON.parse(context.value);
            log.debug('Map Stage object', obj);

            var processType = obj.recordType
            var commrecord
            if (processType == 'EditSnapShot') {
                commrecord = record.load({
                    id: obj.internalid,
                    type: 'customrecord_bb_commission_snap_shot'
                })
                for (var field in obj) {
                    commrecord.setValue({
                        fieldId: field,
                        value: obj[field]
                    })
                }
                log.debug('commrecord', commrecord)
                 commrecord.save()
            } else if (processType == 'CreateSnapShot') {
                var commrecord = record.create({
                    type: 'customrecord_bb_commission_snap_shot'
                })
                for (var field in obj) {
                    commrecord.setValue({
                        fieldId: field,
                        value: obj[field]
                    })
                }
                log.debug('commrecord', commrecord)
                 commrecord.save()
            } else if (processType == 'DeleteSnapShot') {
                record.delete({
                    type: 'customrecord_bb_commission_snap_shot',
                    id: obj.internalid,
                });
            } else if (processType == 'SnapShotJE') {

                var project = obj[obj['isGroup']]
                var amount = obj[obj['isAmount']]

                var subsidiary=search.lookupFields({
                    type:'job',
                    id:project,
                    columns: ['subsidiary']
                })

               var accountDetails= search.lookupFields({
                    type:'customrecord_bb_solar_success_configurtn',
                    id:1,
                    columns: ['custrecord_bb_comm_payable_account','custrecord_bb_comm_expense_account']
                })
                var jeID = jeModule.createJournalEntry(project, amount, accountDetails.custrecord_bb_comm_payable_account[0].value, accountDetails.custrecord_bb_comm_expense_account[0].value, subsidiary.subsidiary[0].value)
           log.debug('jeID',jeID)
                record.submitFields({
                    type: 'customrecord_bb_commission_snap_shot',
                    id: obj['internalid'],
                    values: {
                        'custrecord_bb_comm_snap_shot_journal': jeID
                    }
                })
            }
            context.write({
                key: obj[obj['isGroup']],
                //value: obj[obj['isAmount']]
                value: obj
            });
        }



        /**
         * Function call API modules and Energy production creation Modules to get the energy produced data and create respective records
         * @param context
         */
        function reduce(context) {

            var customrecord_bb_commission_snap_shotSearchObj = search.create({
                type: "customrecord_bb_commission_snap_shot",
                filters:
                    [
                        ["custrecord_bb_comm_snap_shot_project", "anyof", context.key]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "custrecord_bb_comm_snap_shot_comm_amt",
                        })
                    ]
            });
            var searchResultCount = customrecord_bb_commission_snap_shotSearchObj.runPaged().count;
            log.debug("customrecord_bb_commission_snap_shotSearchObj result count", searchResultCount);
            var total = 0
            customrecord_bb_commission_snap_shotSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                total = total + parseFloat(result.getValue({
                    name: 'custrecord_bb_comm_snap_shot_comm_amt'
                }))
                return true;
            });

            log.debug('total',total)
            log.debug('context.key',context.key)
            record.submitFields({
                type: 'job',
                id: context.key,
                values: {
                    'custentity_bbss_total_comm_paid': total
                }
            })
        }


        /**
         * Function summarizes the map reduce process
         * @param summary
         */
        function summarize(summary) {
            summary.mapSummary.errors.iterator().each(function (key, error) {
                log.error("Map Error for key: " + key, error);
                return true;
            });

            summary.reduceSummary.errors.iterator().each(function (key, error) {
                log.error("Reduce Error for key: " + key, error);
                return true;
            });
        }


        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });