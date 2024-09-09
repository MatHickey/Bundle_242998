/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @author Nicholas M. Schultz
 * @version 0.0.1
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 * 
 */


define(['/SuiteBundles/Bundle 242998/BB SS/API Logs/API_Log', '/SuiteBundles/Bundle 242998/ProjectInterfaceIntegrations/BB.SS.MD.FlatToObjConvert', '/SuiteBundles/Bundle 242998/BB SS/SS Lib/bb_framework_all']
    , function (apiLogModule, convertModule, bbFrameworkModule) {

        var _systemCredentials;

        var ENDPOINTS = {
            V2_GET_LOAN_BY_ID: '/loans/{id}'
            , V2_GET_LOAN_STATUS: '/loans/{id}/status'
            , V2_CREATE_LOAN: '/loans'
            , V2_GET_STIPULATIONS: '/loans/{id}/stipulations'
            , V2_TRANSITION_MILESTONE: '/loans/{id}/milestones'
            , V2_GET_PAYMENTS: '/payments?offerIds[]={offerId}&amount={amount}'
        };

        function setSystemCredentials(str) {
            log.debug('Started setSystemCredentials');
            if (typeof str === 'string' && str.trim().length > 0) {
                _systemCredentials = new APICredentialsSs2().init(str);
            }
        }

        function authenticate(endpoint, body) {
            log.debug('Started authenticate');
            var
                _url = _systemCredentials.getBaseUrl().replace(/^\/+|\/+$/g,'')
                , _token = _systemCredentials.getToken()
                , _request = {
                    url: [_url, endpoint].join('')
                    , body: body
                    , headers: {
                        'content-type': 'application/json'
                        , 'Authorization': ['Basic', _token].join(' ')
                        , 'User-Agent': 'NetSuite/BluBanyan'
                        , 'Accept': 'application/json'
                    }
                }
            return _request;
        }

        function genericGetPostPutDelete(func, endpoint, data, httpMethod) {
            log.debug('Started genericGetPostPutDelete');
            var
                _data = convertModule.flatToObject(data)
                , _request
                , _apiLogResponse
                , _response = null
                , _isValid = false
                , _endpoint = null
                , _result = null
            ;
          	
            if (_data) {
                _isValid = true;
                _endpoint = endpoint;
              	//log.debug('data before delete', _data);
                for(var key in _data){
                    if(_data.hasOwnProperty(key) && _endpoint.indexOf(['{', key, '}'].join(''))>=0 ){
                        _endpoint = _endpoint.replace(['{', key, '}'].join(''), _data[key]);
                      log.debug('httpMethod',httpMethod);
                      if(httpMethod == 'post'){
                        delete _data[key];
                      }
                    }
                }
              //log.debug('data after delete', _data)
                _request = authenticate(_endpoint, _data);
            }
            if (_isValid) {
                _apiLogResponse = func(_request);
                _response = _apiLogResponse.response;
                try {
                    // need to add update to code below into SS bundle. if([200, 201].indexOf(_response.code) < 0){
                    // if (_response.code === 200) {
                    log.debug('BB.SS.MD.Integration.LoanpalV2.js _response.code', {code:_response.code, type:typeof(_response.code)});
                    log.debug('BB.SS.MD.Integration.LoanpalV2.js _response.body', {code:_response.body, type:typeof(_response.body)});
                    if([200, 201, 204].indexOf(_response.code) >= 0){
                        try {
                            _result = util.extend({}, _response);
                            _result.body = JSON.parse(_result.body);
                        }
                        catch (e) {
                            log.debug('BB.SS.MD.Integration.OpenSolar _result.body JSON Parse Error', e);
                        }
                    } else {
                        log.debug('NON 20x RESPONSE', _response);
                      try {
                            _result = util.extend({}, _response);
                            _result.body = JSON.parse(_result.body);
                        }
                        catch (e) {
                            log.debug('BB.SS.MD.Integration.OpenSolar _result.body JSON Parse Error', e);
                        }
                    }
                } catch (ex) {
                    log.debug('RESPONSE_NOT_PROCESSED', _response);
                }
            }
            return convertModule.objectToFlat(_result);
        }

        function V2GetLoanById(data){
            log.debug('Started V2GetLoanById');
            return genericGetPostPutDelete(apiLogModule.get, ENDPOINTS.V2_GET_LOAN_BY_ID, data);
        }

        function V2GetLoanStatus(data) {
            log.debug('Started V2GetLoanStatus');
            return genericGetPostPutDelete(apiLogModule.get, ENDPOINTS.V2_GET_LOAN_STATUS, data);
        }

        function V2GetPayments(data) {
            log.debug('Started V2GetPayments');
            return genericGetPostPutDelete(apiLogModule.get, ENDPOINTS.V2_GET_PAYMENTS, data);
        }
  		
  		function V2TransitionMilestone(data) {
            log.debug('Started V2TransitionMilestone');
            return genericGetPostPutDelete(apiLogModule.post, ENDPOINTS.V2_TRANSITION_MILESTONE, data, 'post');
        }

        return {
            name: 'loanpal'
            , authenticate: authenticate
            , setSystemCredentials: setSystemCredentials
            , V2GetLoanById: V2GetLoanById
            , V2GetLoanStatus: V2GetLoanStatus
            , V2GetPayments: V2GetPayments
          	, V2TransitionMilestone : V2TransitionMilestone
        }
    }
);
