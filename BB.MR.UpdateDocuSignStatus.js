/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime', './BB DS/DocuSign'],
    function (recordModule, searchModule, runtimeModule, docuSignModule) {

        function getSearchConfig(searchId) {
            var
                _searchId = searchId
                , _search
                , _filterFunc = function (columns, regexp) {
                    return columns.filter(function (c) {
                        return regexp.test(c.label);
                    });
                }
                , _columns = {}
            ;
            if (_searchId) {
                _search = searchModule.load({id: _searchId});
                _columns.envelopeId = _filterFunc(_search.columns, /^envelope$/i)[0];
                _columns.statusFieldId = _filterFunc(_search.columns, /^status$/i)[0];
            }
            return _columns;
        }

        function getConfigData() {
            var
                _script = runtimeModule.getCurrentScript()
                , _envelopeSearchId = _script.getParameter({name: 'custscript_envelopes_search'})
                , _result = {
                    searchId: _envelopeSearchId
                    , columns: getSearchConfig(_envelopeSearchId)
                }
            ;

            return _result;
        }

        function getInputData(context) {
            var
                _config = getConfigData()
                , _search
                , _envelopeIds
                , _envelopeApi
                , _result = []
                , _response
                , _envelopes = []
            ;

            _search = searchModule.load({id: _config.searchId});

            _search.run().each(function(row) {
                _envelopes.push({
                    envelopeId: row.getValue(_config.columns.envelopeId)
                    , statusFieldId: _config.columns.statusFieldId ? _config.columns.statusFieldId.name : undefined
                    , id: row.id
                    , type: _search.searchType
                });
                return true;
            });

            _envelopeIds = _envelopes.map(function(r) { return r.envelopeId; });

            if(_envelopeIds instanceof Array) {
                _envelopeApi = new docuSignModule.EnvelopesApi();
                _envelopeApi.apiClient.addAuthentication(new docuSignModule.OAuth()).setupFromRecord().setAutoAuth(true).authenticate();
                _response = _envelopeApi.listStatus({envelopeIdsRequest: { envelopeIds: _envelopeIds}, envelopeIds: 'request_body'});
                if(_response.envelopes instanceof Array) {
                    _response.envelopes.forEach(function(envelopeStatus){
                        var _found = _envelopes.filter(function(envelope){
                            return envelope.envelopeId == envelopeStatus.envelopeId;
                        })[0];
                        if(_found) {
                            _found.status = envelopeStatus.status;
                            _result.push(_found);
                        }
                    });
                }
            }

            return _result;
        }

        function map(context) {
            var
                _obj = JSON.parse(context.value)
                , _values = {}
                , _statusRecord = searchModule.create({
                    type: 'customrecord_docusign_envelope_status'
                    , filters: [
                        ['custrecord_docusign_status_envelope_id', 'is', _obj.envelopeId]
                    ]
                }).run().getRange({ start: 0, end: 1 })[0]
            ;

            log.debug('_obj', _obj);
            log.debug('_statusRecord', _statusRecord);

            if(_obj.status) {
                if(_obj.statusFieldId) {
                    _values[_obj.statusFieldId] = _obj.status;
                    log.debug('_values', _values);
                    recordModule.submitFields({
                        type: _obj.type
                        , id: _obj.id
                        , values: _values
                    });
                }

                if(_statusRecord) {
                    recordModule.submitFields({
                        type: 'customrecord_docusign_envelope_status'
                        , id: _statusRecord.id
                        , values: {
                            'custrecord_docusign_status' : _obj.status
                        }
                    });
                }
            }
        }

        return {
            getInputData: getInputData,
            map: map
        }

    });