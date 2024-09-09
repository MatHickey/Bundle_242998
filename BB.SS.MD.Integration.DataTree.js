/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 * @author Taos Transue, Michael Golichenko
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
 */

define(['N/cache', '../libs/typedarray', '../../BB SS/API Logs/API_Log', '../BB.SS.MD.FlatToObjConvert'
    , '../../BB SS/SS Lib/bb_framework_all']
  , function (cacheModule, typedArrayModule, apiLogModule, convertModule
    , bbFrameworkModule) {

    const
      ENDPOINT = {
        AUTH: '/Login/Authenticate'
        , GET_REPORT: '/Report/GetReport'
        , SEARCH_LITE: '/Search/PropertySearch'
      }
    ;

    var
      _datatreeSystemCredentials
    ;
  
	function getSearchLiteData(data) {
      log.debug('data', data);
      var
        _path
        , _data = convertModule.flatToObject(data)
        , _request
        , _apiLogResponse
        , _response = null
        , _isValid = false
      ;
      if (_data) {
        log.debug('_data', _data);
        _path = [_datatreeSystemCredentials.getBaseUrl(), ENDPOINT.SEARCH_LITE].join('');
        _request = authenticate(_path, _data);
        if (_request) {
          _isValid = true;
        }
      }
      if (_isValid) {
        // log.debug('_request', _request);
        _apiLogResponse = apiLogModule.post(_request);
        _response = _apiLogResponse.response;
        try {
          if (_response.code === 200) {
            _response = JSON.parse(_response.body);
            _response = convertModule.objectToFlat(_response);
            log.debug('_response', _response);
          } else {
            log.debug('RESPONSE_INVALID_RESPONSE', _response);
            _response = null;
          }
        } catch (ex) {
          log.debug('RESPONSE_NOT_PROCESSED', _response);
          _response = null;
        }
      }
      return _response;
    }
  
    function getReportData(data) {
      log.debug('data', data);
      var
        _path
        , _data = convertModule.flatToObject(data)
        , _request
        , _apiLogResponse
        , _response = null
        , _isValid = false
      ;
      if (_data) {
        log.debug('_data', _data);
        _path = [_datatreeSystemCredentials.getBaseUrl(), ENDPOINT.GET_REPORT].join('');
        _request = authenticate(_path, _data);
        if (_request) {
          _isValid = true;
        }
      }
      if (_isValid) {
        // log.debug('_request', _request);
        _apiLogResponse = apiLogModule.post(_request);
        _response = _apiLogResponse.response;
        try {
          if (_response.code === 200) {
            _response = JSON.parse(_response.body);
            _response = convertModule.objectToFlat(_response);
            log.debug('_response', _response);
          } else {
            log.debug('RESPONSE_INVALID_RESPONSE', _response);
            _response = null;
          }
        } catch (ex) {
          log.debug('RESPONSE_NOT_PROCESSED', _response);
          _response = null;
        }
      }
      return _response;
    }

    function authenticate(path, body) {
      var
        _apiToken = getApiToken()
        , _request = {
          url: path
          , body: body
          , headers: {
            'Content-Type': 'application/json'
            , 'Authorization': ['Bearer', _apiToken].join(' ')
          }
        };
      if(!_apiToken) {
        return null;
      }
      return _request;
    }

    function getApiToken() {
      var
        _apiToken
        , _basePath = _datatreeSystemCredentials.getBaseUrl()
        , _username = _datatreeSystemCredentials.getUsername()
        , _request = {
          url: [_basePath, ENDPOINT.AUTH].join('')
          , body: {
            'Username': _username,
            'Password': _datatreeSystemCredentials.getPassword()
          }
          , headers: {
            'Content-Type': 'application/json'
          }
        }
        , _response
        , _cache
      ;
      // log.debug('cache name', ['datatree', _datatreeSystemCredentials.getSystem()].join('-'));
      _cache = cacheModule.getCache({
        name: ['datatree', _datatreeSystemCredentials.getSystem()].join('-'),
        scope: cacheModule.Scope.PUBLIC
      });

      _apiToken = _cache.get({
        key: _username,
        loader: function () {
          // log.debug('request', _request);
          _response = apiLogModule.post(_request);
          _response = _response.response;
          try {
            if (_response.code === 200) {
              _response = _response.body.replace(/^"|"$/g, '');
            } else {
              log.debug('RESPONSE_API_TOKEN_INVALID_RESPONSE', _response);
              _response = null;
            }
          } catch (ex) {
            log.debug('RESPONSE_API_TOKEN_NOT_PROCESSED', _response);
            _response = null;
          }
          return _response;
        },
        ttl: 60 * 60 * 1.9
      });

      if (!_apiToken) {
        _cache.remove({key: _username});
      }

      return _apiToken;
    }

    function setSystemCredentials(str) {
      if (typeof str === 'string' && str.trim().length > 0) {
        _datatreeSystemCredentials = new APICredentialsSs2().init(str);
      }
    }

    return {
      name: 'datatree'
      , setSystemCredentials: setSystemCredentials
      , getReportData: getReportData
    }
  });