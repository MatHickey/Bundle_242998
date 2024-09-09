/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['./BB.MD.JournalEntryCreation.js'],
    function (jeModule) {
        function onRequest(context) {
            if (context.request.method === 'GET') {

                var jeID = jeModule.createJournalEntry(1030348, 100, 1,131, 1)
                log.debug('jeID', jeID)
            }
        }

        return {
            onRequest: onRequest
        };
    });