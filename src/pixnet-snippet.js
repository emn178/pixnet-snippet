/*
 * pixnet-snippet v0.2.0
 * https://github.com/emn178/pixnet-snippet
 *
 * Copyright 2015, emn178@gmail.com
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */
;(function($, window, document, undefined) {
  'use strict';

  var localStorage = window.localStorage || {};

  var user = $.query.get('pix.user') || 'guest';
  var proxy_url = $.query.get('proxy_url') + '?addon_id=' + $.query.get('addon_id') + '&pToken=' + $.query.get('pToken');
  var windowProxy = new Porthole.WindowProxy( proxy_url );
  var loaded = false;

  angular.module('pixnet-snippet', ['ngRoute', 'ngResource', 'firebase'])
  .value('fbURL', 'https://pixnet-snippet.firebaseIO.com/')
  .service('fbRef', function(fbURL) {
    return new Firebase(fbURL);
  })
  .service('Snippets', function($firebaseArray, fbRef) {
    var self = this, snippets;
    var fetchFromFireBase = function(load) {
      var ref = fbRef.child(user + '/snippets');
      ref.on('value', load);
      return $firebaseArray(ref);
    };
    var fetchFromLocal = function() {
      if(!localStorage.snippets) {
        return null;
      }
      var cacheTime = new Date(localStorage.cacheTime || 0)
      if(new Date().getTime() - cacheTime > 6000 * 5) {
        return null;
      }
      return angular.fromJson(localStorage.snippets);
    };
    var saveToLocal = function() {
      localStorage.cacheTime = new Date().getTime();
      localStorage.snippets = angular.toJson(snippets);
    };
    this.fetch = function (load) {
      if (snippets) {
        return snippets;
      }
      var ref = fbRef.child(user + '/snippets');
      ref.on('value', function(a) {
        if(load) {
          load.call(self);
        }
      });
      snippets = $firebaseArray(ref);
      snippets.$loaded(saveToLocal);
      var cache = fetchFromLocal();
      if (cache) {
        if(load) {
          load.call(self);
        }
        return cache;
      }
      return snippets;
    };
    this.add = function(snippet) {
      return snippets.$add(snippet).then(saveToLocal);
    };
    this.get = function(id) {
      var index = snippets.$indexFor(id);
      return snippets[index];
    };
    this.remove = function(snippet, callback) {
      snippets.$remove(snippet).then(callback).then(saveToLocal);
    };
    this.save = function(snippet, callback) {
      snippets.$save(snippet).then(callback).then(saveToLocal);
    }
  })
   
  .config(function($routeProvider) {
    $routeProvider
      .when('/', {
        controller:'SnippetListController',
        templateUrl:'list.html'
      })
      .when('/edit/:snippetId', {
        controller:'EditSnippetController',
        templateUrl:'detail.html'
      })
      .when('/new', {
        controller:'NewSnippetController',
        templateUrl:'detail.html'
      })
      .otherwise({
        redirectTo:'/'
      });
  })
   
  .controller('SnippetListController', function($scope, Snippets) {
    $scope.loaded = loaded;
    $scope.snippets = Snippets.fetch(function() {
      loaded = $scope.loaded = true;
    });

    $scope.choose = function(html) {
      var ret = $.query.get('addon_id') + "||PIXNET||" + html;
      windowProxy.postMessage(ret);
    };
  })
   
  .controller('NewSnippetController', function($scope, $location, Snippets) {
    $scope.snippet = {};
    $scope.save = function() {
      Snippets.add($scope.snippet).then(function(data) {
        $location.path('/');
      });
    };
  })
   
  .controller('EditSnippetController',
    function($scope, $location, $routeParams, Snippets) {
      var id = $routeParams.snippetId;
      $scope.snippet = Snippets.get(id);

      $scope.destroy = function() {
        if(confirm('確定刪除？')) {
          Snippets.remove($scope.snippet, function(data) {
            $location.path('/');
          });
        }
      };
   
      $scope.save = function() {
        Snippets.save($scope.snippet, function(data) {
          $location.path('/');
        });
      };
  });
})(jQuery, window, document);
