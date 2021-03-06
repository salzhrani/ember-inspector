import Ember from "ember";
import { module, test } from 'qunit';
/*globals require */
var EmberDebug = require("ember-debug/main")["default"];

var port, name, message;
var EmberDebug;
var run = Ember.run;
var App;

function setupApp() {
  App = Ember.Application.create();
  App.injectTestHelpers();
  App.setupForTesting();
}

module("Deprecation Debug", {
  beforeEach() {
    EmberDebug.Port = EmberDebug.Port.extend({
      init: function() {},
      send: function(n, m) {
        name = n;
        message = m;
      }
    });
    run(function() {
      setupApp();
      EmberDebug.set('application', App);
    });
    run(EmberDebug, 'start');
    port = EmberDebug.port;
    EmberDebug.deprecationDebug.reopen({
      fetchSourceMap: function() {},
      emberCliConfig: null
    });
  },
  afterEach() {
    name = null;
    message = null;
    EmberDebug.destroyContainer();
    Ember.run(App, 'destroy');
  }
});

test("deprecations are caught and sent", function(assert) {
  var messages = [];
  port.reopen({
    send: function(name, message) {
      messages.push({
        name: name,
        message: message
      });
    }
  });

  App.ApplicationRoute = Ember.Route.extend({
    setupController: function() {
      Ember.deprecate('Deprecation 1');
      Ember.deprecate('Deprecation 2', false, { url: 'http://www.emberjs.com' }) ;
      Ember.deprecate('Deprecation 1');
    }
  });

  visit('/');
  andThen(function() {
    var deprecations = messages.findBy('name', 'deprecation:deprecationsAdded').message.deprecations;
    assert.equal(deprecations.length, 2);
    var deprecation = deprecations[0];
    assert.equal(deprecation.count, 2, 'Correctly combined');
    assert.equal(deprecation.message, 'Deprecation 1');
    assert.equal(deprecation.sources.length, 2, 'Correctly separated by source');
    deprecation = deprecations[1];
    assert.equal(deprecation.count, 1);
    assert.equal(deprecation.message, 'Deprecation 2');
    assert.equal(deprecation.sources.length, 1);
    assert.equal(deprecation.url, 'http://www.emberjs.com');

    var count = messages.findBy('name', 'deprecation:count').message.count;
    assert.equal(count, 3, 'count correctly sent');
  });

});
