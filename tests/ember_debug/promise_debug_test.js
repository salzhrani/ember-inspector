import Ember from "ember";
import { module, test, stop, start } from 'qunit';
/*globals require */
var EmberDebug = require("ember-debug/main")["default"];

var port, name, message, RSVP = Ember.RSVP;
var EmberDebug;
var App;
let { run, K, A: emberA } = Ember;

function setupApp() {
  App = Ember.Application.create();
  App.injectTestHelpers();
  App.setupForTesting();
}

module("Promise Debug", {
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
    Ember.run(EmberDebug, 'start');
    EmberDebug.get('promiseDebug').reopen({
      delay: 5,
      session: {
        getItem: Ember.K,
        setItem: Ember.K,
        removeItem: Ember.K
      }
    });
    port = EmberDebug.port;
  },
  afterEach() {
    name = null;
    message = null;
    EmberDebug.destroyContainer();
    Ember.run(App, 'destroy');
  }
});

test("Existing promises sent when requested", function(assert) {
  var promise1, child1, promise2;

  run(function() {
    var p = RSVP.resolve('value', "Promise1")
    .then(function() {}, null, "Child1");

    // catch so we don't get a promise failure
    RSVP.reject('reason', "Promise2").catch(K);
  });

  // RSVP instrumentation is out of band (50 ms delay)
  Ember.run.later(function() {}, 100);

  wait();

  andThen(function() {
    port.trigger('promise:getAndObservePromises');

    assert.equal(name, 'promise:promisesUpdated');

    var promises = emberA(message.promises);

    promise1 = promises.findBy('label', 'Promise1');
    child1 = promises.findBy('label', 'Child1');
    promise2 = promises.findBy('label', 'Promise2');

    assert.equal(promise1.label, 'Promise1');
    assert.equal(promise1.state, 'fulfilled');
    assert.equal(promise1.children.length, 1);
    assert.equal(promise1.children[0], child1.guid);

    assert.equal(child1.label, 'Child1');
    assert.equal(child1.state, 'fulfilled');
    assert.equal(child1.parent, promise1.guid);

    assert.equal(promise2.label, 'Promise2');
    assert.equal(promise2.state, 'rejected');

  });

});

test("Updates are published when they happen", function(assert) {
  port.trigger('promise:getAndObservePromises');

  var p;

  run(function() {
    p = new RSVP.Promise(function() {}, "Promise1");
  });

  let done = assert.async();
  Ember.run.later(function() {
    assert.equal(name, 'promise:promisesUpdated');
    var promises = emberA(message.promises);
    var promise = promises.findBy('label', 'Promise1');
    assert.equal(promise.label, 'Promise1');
    p.then(function() {}, null, "Child1");
    Ember.run.later(function() {
      assert.equal(name, 'promise:promisesUpdated');
      assert.equal(message.promises.length, 2);
      var child = message.promises[0];
      assert.equal(child.parent, promise.guid);
      assert.equal(child.label, 'Child1');
      var parent = message.promises[1];
      assert.equal(parent.guid, promise.guid);
      done();
    }, 200);
  }, 200);
});


test("Instrumentation with stack is persisted to session storage", function(assert) {
  var withStack = false;
  var persisted = false;
  EmberDebug.get('promiseDebug').reopen({
    session: {
      getItem: function(key) {
        return withStack;
      },
      setItem: function(key, val) {
        withStack = val;
      }
    }
  });

  andThen(function() {
    port.trigger('promise:getInstrumentWithStack');
    return wait();
  });

  andThen(function() {
    assert.equal(name, 'promise:instrumentWithStack');
    assert.equal(message.instrumentWithStack, false);
    port.trigger('promise:setInstrumentWithStack', {
      instrumentWithStack: true
    });
    return wait();
  });

  andThen(function() {
    assert.equal(name, 'promise:instrumentWithStack');
    assert.equal(message.instrumentWithStack, true);
    assert.equal(withStack, true, 'persisted');
    port.trigger('promise:setInstrumentWithStack', {
      instrumentWithStack: false
    });
    return wait();
  });

  andThen(function() {
    assert.equal(name, 'promise:instrumentWithStack');
    assert.equal(message.instrumentWithStack, false);
    assert.equal(withStack, false, 'persisted');
  });

});
